"use client";

import { useState } from "react";
import type { MercuryApplicant, MercuryRole, MercuryStage } from "@/lib/supabase/types";
import { STAGES, STAGE_LABEL } from "@/lib/mercury/stages";
import { canonicalizeSkill } from "@/lib/mercury/skills";
import { formatDate, initials } from "@/lib/utils/formatters";

interface Props {
  applicant: MercuryApplicant;
  role: MercuryRole;
  onMoveStage: (id: string, stage: MercuryStage) => void;
  onRespond: (applicant: MercuryApplicant) => void;
  onDragStart?: (id: string) => void;
}

export function ApplicantCard({ applicant: a, role, onMoveStage, onRespond, onDragStart }: Props) {
  const [fileBusy, setFileBusy] = useState<"cv" | "raw" | null>(null);
  const required = new Set(role.required_skills.map((s) => canonicalizeSkill(s).toLowerCase()));

  async function openFile(kind: "cv" | "raw") {
    setFileBusy(kind);
    try {
      const res = await fetch(`/api/mercury/applicants/${a.id}/files?kind=${kind}`);
      const json = await res.json();
      if (res.ok && json.url) window.open(json.url, "_blank", "noopener,noreferrer");
      else alert(json.error || "Could not open file");
    } finally {
      setFileBusy(null);
    }
  }

  return (
    <article
      draggable={Boolean(onDragStart)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", a.id);
        onDragStart?.(a.id);
      }}
      className="panel rise group flex flex-col gap-2.5 p-3.5"
    >
      <div className="flex items-start gap-2.5">
        <div
          aria-hidden
          className="tnum mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-surface-3 text-[11px] font-semibold text-text-2"
        >
          {initials(a.name, a.email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-text">{a.name || "Unknown applicant"}</h3>
          </div>
          {a.email && <p className="truncate text-xs text-muted">{a.email}</p>}
        </div>
        <span className="tnum shrink-0 text-[10px] text-dim">{formatDate(a.created_at)}</span>
      </div>

      {/* Flags */}
      {(a.needs_review || a.response_owed) && (
        <div className="flex flex-wrap gap-1.5">
          {a.needs_review && (
            <span className="rounded tone-waiting px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
              Needs review
            </span>
          )}
          {a.response_owed && (
            <span className="rounded tone-active px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
              Reply owed
            </span>
          )}
        </div>
      )}

      {/* Parsed facts — visible & factual, never a hidden score */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Fact label="Experience" value={a.parsed_years_exp != null ? `${a.parsed_years_exp} yrs` : "—"} />
        <Fact label="Location" value={a.parsed_location || "—"} />
        <div className="col-span-2">
          <Fact label="Current role" value={a.parsed_current_role || "—"} />
        </div>
      </dl>

      {a.parsed_skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {a.parsed_skills.slice(0, 8).map((s) => {
            const isReq = required.has(canonicalizeSkill(s).toLowerCase());
            return (
              <span
                key={s}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  isReq ? "tone-active" : "tone-neutral"
                }`}
                title={isReq ? "Listed in the role's required skills" : undefined}
              >
                {s}
              </span>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <button
          onClick={() => openFile("cv")}
          disabled={!a.cv_file_path || fileBusy === "cv"}
          className="text-signal hover:underline disabled:text-dim disabled:no-underline"
        >
          {fileBusy === "cv" ? "Opening…" : a.cv_file_path ? "CV" : "No CV"}
        </button>
        <button
          onClick={() => openFile("raw")}
          disabled={!a.raw_email_path || fileBusy === "raw"}
          className="text-muted hover:text-text-2 disabled:text-dim"
        >
          {fileBusy === "raw" ? "Opening…" : "Email"}
        </button>
        <button onClick={() => onRespond(a)} className="text-muted hover:text-text-2">
          Respond
        </button>
      </div>

      {/* Stage move — keyboard accessible (drag is an enhancement) */}
      <label className="flex items-center gap-2 border-t border-border-soft pt-2.5">
        <span className="text-[10px] uppercase tracking-wider text-dim">Stage</span>
        <select
          value={a.stage}
          onChange={(e) => onMoveStage(a.id, e.target.value as MercuryStage)}
          className="flex-1 rounded border border-border bg-bg px-2 py-1 text-xs text-text-2 outline-none focus:border-signal"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className="truncate text-text-2">{value}</dd>
    </div>
  );
}
