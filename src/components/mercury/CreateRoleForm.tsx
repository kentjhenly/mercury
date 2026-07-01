"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Create-role affordance. Two collapsed triggers:
 *  - "button" — the compact mercury button (used inline next to a heading).
 *  - "card"   — the dashed grid card from the Mercury Workspace dashboard.
 * The form itself opens as a centered modal so it works from either trigger.
 */
export function CreateRoleForm({ variant = "button" }: { variant?: "button" | "card" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillsRaw, setSkillsRaw] = useState("");
  const [location, setLocation] = useState("");
  const [exp, setExp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // setState setters are stable, so close is safe to memoize with no deps.
  const close = useCallback(() => {
    setOpen(false);
    setTitle("");
    setDescription("");
    setSkillsRaw("");
    setLocation("");
    setExp("");
    setError(null);
  }, []);

  // Close the modal on Escape (matches ResponseModal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const required_skills = skillsRaw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/mercury/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          required_skills,
          location: location || null,
          experience_target: exp ? Number(exp) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create role");
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const trigger =
    variant === "card" ? (
      <button
        onClick={() => setOpen(true)}
        className="group flex min-h-[208px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-dim transition-colors hover:border-border-strong hover:text-muted"
      >
        <span className="grid size-10 place-items-center rounded-lg border border-border text-2xl font-light leading-none group-hover:border-border-strong">
          +
        </span>
        <span className="text-sm">New role</span>
        <span className="label text-[10px] tracking-[0.16em]" style={{ letterSpacing: "0.16em" }}>
          Get a forwarding address
        </span>
      </button>
    ) : (
      <button onClick={() => setOpen(true)} className="mercury-btn px-4 py-2 text-xs tracking-wider">
        + NEW ROLE
      </button>
    );

  return (
    <>
      {trigger}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/70 p-4 backdrop-blur-sm"
          onMouseDown={close}
          role="dialog"
          aria-modal="true"
          aria-label="New role"
        >
          <form
            onSubmit={submit}
            onMouseDown={(e) => e.stopPropagation()}
            className="panel rise flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-6"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">New role</h2>
              <button type="button" onClick={close} className="text-dim hover:text-text-2" aria-label="Close">
                ✕
              </button>
            </div>

            <L label="Title" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={120}
                placeholder="Senior Frontend Engineer"
                className="input"
                autoFocus
              />
            </L>
            <L label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="What the role involves. Used for the optional relevance sort aid."
                className="input resize-y"
              />
            </L>
            <L label="Required skills" hint="Comma-separated. Synonyms like “JS” are normalized to “JavaScript”.">
              <input
                value={skillsRaw}
                onChange={(e) => setSkillsRaw(e.target.value)}
                placeholder="React, TypeScript, Node.js"
                className="input"
              />
            </L>
            <div className="grid grid-cols-2 gap-4">
              <L label="Location">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={120}
                  placeholder="Hong Kong"
                  className="input"
                />
              </L>
              <L label="Experience target (yrs)">
                <input
                  value={exp}
                  onChange={(e) => setExp(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="5"
                  className="input tnum"
                />
              </L>
            </div>

            {error && (
              <p role="alert" className="rounded tone-negative px-3 py-2 text-xs">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={close} className="text-xs text-muted hover:text-text-2">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="mercury-btn px-5 py-2.5 text-xs tracking-wider disabled:opacity-60"
              >
                {saving ? "CREATING…" : "CREATE ROLE"}
              </button>
            </div>

            <style>{`
              .input { width:100%; border-radius:4px; border:1px solid var(--border); background:var(--bg); padding:8px 12px; font-size:13px; color:var(--text); outline:none; }
              .input:focus { border-color: var(--signal); }
              .input::placeholder { color: var(--dim); }
            `}</style>
          </form>
        </div>
      )}
    </>
  );
}

function L({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">
        {label}
        {required && <span className="text-signal"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </label>
  );
}
