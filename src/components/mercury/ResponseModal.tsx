"use client";

import { useEffect, useState } from "react";
import type { MercuryApplicant } from "@/lib/supabase/types";
import {
  RESPONSE_TYPES,
  renderTemplate,
  responseLabel,
  type ResponseType,
} from "@/lib/mercury/templates";

interface Props {
  applicant: MercuryApplicant;
  roleTitle: string;
  companyName: string | null;
  onClose: () => void;
  onSent: (updated: MercuryApplicant) => void;
}

const TYPES: ResponseType[] = [...RESPONSE_TYPES, "custom"];

export function ResponseModal({ applicant, roleTitle, companyName, onClose, onSent }: Props) {
  const draftFor = (t: ResponseType) =>
    renderTemplate(t, { applicantName: applicant.name, roleTitle, companyName });

  const initial = draftFor("invite-to-interview");
  const [type, setType] = useState<ResponseType>("invite-to-interview");
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [advance, setAdvance] = useState(Boolean(initial.advanceTo));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the editable draft when the user picks a different template type.
  // React's documented "adjust state when a value changes" pattern (set during
  // render via a tracked previous value) — not an effect, so no cascading render.
  const [draftType, setDraftType] = useState<ResponseType>("invite-to-interview");
  if (type !== draftType) {
    const t = draftFor(type);
    setDraftType(type);
    setSubject(t.subject);
    setBody(t.body);
    setAdvance(Boolean(t.advanceTo));
  }

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/mercury/applicants/${applicant.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subject, body, advance_stage: advance }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not send");
      onSent(json.applicant as MercuryApplicant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Send response"
    >
      <div
        className="panel flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-6"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">
              Respond to {applicant.name || applicant.email || "applicant"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Sent via Mercury · replies go to your address. Edit before sending.
            </p>
          </div>
          <button onClick={onClose} className="text-dim hover:text-text-2" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded px-2.5 py-1 text-xs ${
                type === t ? "tone-active" : "tone-neutral hover:text-text"
              }`}
            >
              {responseLabel(t)}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            className="rounded border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-signal"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            maxLength={10000}
            className="resize-y rounded border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text outline-none focus:border-signal"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-text-2">
          <input
            type="checkbox"
            checked={advance}
            onChange={(e) => setAdvance(e.target.checked)}
            className="accent-[var(--signal)]"
          />
          Advance stage to match this response
        </label>

        {error && (
          <p role="alert" className="rounded tone-negative px-3 py-2 text-xs">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-xs text-muted hover:text-text-2">
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending || !subject.trim() || !body.trim()}
            className="mercury-btn px-5 py-2.5 text-xs tracking-wider disabled:opacity-60"
          >
            {sending ? "SENDING…" : "SEND RESPONSE"}
          </button>
        </div>
      </div>
    </div>
  );
}
