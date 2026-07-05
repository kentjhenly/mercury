"use client";

import { useState, useEffect } from "react";
import type { MercuryApplicant, MercuryRole, MercuryStage } from "@/lib/supabase/types";
import { STAGES, STAGE_LABEL, STAGE_TONE, STAGE_COLOR } from "@/lib/mercury/stages";
import type { ResponseType } from "@/lib/mercury/templates";
import { canonicalizeSkill } from "@/lib/mercury/skills";
import { estimateSalary, formatSalaryBand, formatSalaryFull } from "@/lib/mercury/salary";
import { getMetro } from "@/lib/mercury/metro";
import { SalaryFeedback } from "./SalaryFeedback";
import { OfferLetterDraft } from "./OfferLetterDraft";

interface Props {
  applicant: MercuryApplicant;
  role: MercuryRole;
  companyName: string | null;
  onClose: () => void;
  onMoveStage: (id: string, stage: MercuryStage) => void;
  onRespond: (applicant: MercuryApplicant, type?: ResponseType) => void;
  onUpdate: (applicant: MercuryApplicant) => void;
}

// The four templated quick-actions, matching the Mercury Workspace design.
// Colors mirror the instrument status palette (signal / waiting / muted / negative).
const RESPONSE_CARDS: { type: ResponseType; title: string; desc: string; color: string }[] = [
  {
    type: "invite-to-interview",
    title: "Invite to interview",
    desc: "Propose times and share what to expect.",
    color: "var(--signal)",
  },
  {
    type: "request-info",
    title: "Request more info",
    desc: "Ask for a portfolio link or a missing detail.",
    color: "var(--waiting)",
  },
  {
    type: "keep-warm",
    title: "Keep warm",
    desc: "Let them know they're still in consideration.",
    color: "var(--muted)",
  },
  {
    type: "polite-decline",
    title: "Polite decline",
    desc: "A kind, prompt no — so no one is left waiting.",
    color: "var(--negative)",
  },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) {
    const m = Math.floor(diff / 60000);
    return m <= 1 ? "1m ago" : `${m}m ago`;
  }
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

export function ApplicantPanel({ applicant: a, role, companyName, onClose, onMoveStage, onRespond, onUpdate }: Props) {
  const [fileBusy, setFileBusy] = useState<"cv" | "raw" | null>(null);
  const [salaryDraft, setSalaryDraft] = useState(a.hired_salary_hkd?.toString() ?? "");
  const [salarySaving, setSalarySaving] = useState(false);
  const required = new Set(role.required_skills.map((s) => canonicalizeSkill(s).toLowerCase()));

  // Market context for this applicant's experience level — information about the
  // market, clearly labelled as an estimate; never a verdict on the person.
  const metro = getMetro(role.metro_id);
  const market = estimateSalary(metro, role, a);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveHiredSalary() {
    setSalarySaving(true);
    try {
      const res = await fetch(`/api/mercury/applicants/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hired_salary_hkd: salaryDraft ? Number(salaryDraft) : null }),
      });
      const json = await res.json();
      if (res.ok && json.applicant) onUpdate(json.applicant);
      else alert(json.error || "Could not save");
    } finally {
      setSalarySaving(false);
    }
  }

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
    <>
      {/* Scrim — dims and blurs the board behind the panel */}
      <div
        className="fixed inset-0 z-40 bg-bg-deep/50 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Slide-in panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex w-[520px] max-w-[90vw] flex-col overflow-y-auto border-l border-border bg-bg"
        style={{ boxShadow: "-24px 0 60px rgba(0,0,0,0.55)" }}
        role="dialog"
        aria-modal
        aria-label={`Applicant: ${a.name || "Unknown"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-6 pb-4 pt-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-semibold text-text">{a.name || "Unknown applicant"}</h2>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-0.5 text-[10px] tracking-wider tone-${STAGE_TONE[a.stage]}`}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: STAGE_COLOR[a.stage] }}
                  aria-hidden
                />
                {STAGE_LABEL[a.stage]}
              </span>
            </div>
            {a.email && <p className="mt-1 text-sm text-muted">{a.email}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1 text-dim hover:bg-surface-2 hover:text-text-2"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-6 py-5">
          {/* Owed banner — bordered amber notice, mono */}
          {a.response_owed && (
            <div
              className="flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 font-mono text-[11px] tracking-wide tone-waiting"
              style={{ borderColor: "rgba(214, 192, 138, 0.35)" }}
            >
              <span
                className="size-1.5 shrink-0 rounded-full bg-waiting"
                style={{ boxShadow: "0 0 6px var(--waiting)" }}
                aria-hidden
              />
              OWED A REPLY — don&apos;t leave them waiting
            </div>
          )}

          {a.needs_review && (
            <div
              className="rounded-md border px-3.5 py-2.5 font-mono text-[11px] tracking-wide tone-waiting"
              style={{ borderColor: "rgba(214, 192, 138, 0.35)" }}
            >
              NEEDS REVIEW — parse may be incomplete
            </div>
          )}

          {/* Parsed facts — one unified box: facts, most-recent, and skills */}
          <div>
            <div className="label mb-3 text-[10px]">Parsed from CV · factual, not scored</div>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="grid grid-cols-2">
                <div className="border-r border-border-soft px-4 py-3.5">
                  <div className="label text-[10px]">Experience</div>
                  <div className="mt-1.5 text-lg font-medium text-text">
                    {a.parsed_years_exp != null ? `${a.parsed_years_exp}y` : "—"}
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="label text-[10px]">Location</div>
                  <div className="mt-1.5 text-lg font-medium text-text">
                    {a.parsed_location || "—"}
                  </div>
                </div>
              </div>

              {a.parsed_current_role && (
                <div className="border-t border-border-soft px-4 py-3.5">
                  <div className="label text-[10px]">Most recent</div>
                  <div className="mt-1.5 text-sm font-medium text-text">{a.parsed_current_role}</div>
                </div>
              )}

              {a.parsed_skills.length > 0 && (
                <div className="border-t border-border-soft px-4 py-3.5">
                  <div className="label mb-2 text-[10px]">Skills present</div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.parsed_skills.map((s) => {
                      const isReq = required.has(canonicalizeSkill(s).toLowerCase());
                      return (
                        <span
                          key={s}
                          className={`rounded px-2 py-0.5 text-[11px] ${isReq ? "tone-active" : "tone-neutral"}`}
                          title={isReq ? "Required skill for this role" : undefined}
                        >
                          {s}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Market context — estimate + visible basis, never a verdict */}
          <div>
            <div className="label mb-3 text-[10px]">Know the market before you offer · estimate, not a verdict</div>
            <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
              {market ? (
                <>
                  <div className="tnum flex flex-wrap items-baseline gap-x-2.5">
                    <span className="text-lg font-medium text-text">{formatSalaryBand(metro, market)}</span>
                    <span className="text-xs text-muted">median {formatSalaryFull(metro, market.p50)}</span>
                    {market.confidence === "medium" && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] tracking-wide tone-neutral">
                        rough estimate
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-dim">{market.basis}</p>
                  <SalaryFeedback
                    roleId={role.id}
                    family={market.family}
                    yearsUsed={market.years}
                    metro={metro}
                  />
                </>
              ) : (
                <p className="text-xs text-muted">
                  Market estimate unavailable — role family or experience unknown, or too few
                  reference points to be confident. Mercury never guesses a number.
                </p>
              )}
            </div>
          </div>

          {/* Agreed salary on hire — optional, private; feeds the HK dataset */}
          {a.stage === "hired" && (
            <div>
              <div className="label mb-3 text-[10px]">Agreed salary · optional, private to you</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded border border-border bg-bg px-2.5 py-1.5">
                  <span className="text-xs text-dim">{metro.currency}</span>
                  <input
                    value={salaryDraft}
                    onChange={(e) => setSalaryDraft(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder="0"
                    className="tnum w-20 bg-transparent text-sm text-text outline-none"
                    aria-label="Agreed monthly salary in HKD"
                  />
                  <span className="text-xs text-dim">/mo</span>
                </div>
                <button
                  onClick={saveHiredSalary}
                  disabled={salarySaving || salaryDraft === (a.hired_salary_hkd?.toString() ?? "")}
                  className="rounded border border-border px-3 py-1.5 text-xs text-text-2 hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {salarySaving ? "Saving…" : a.hired_salary_hkd != null ? "Update" : "Save"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-dim">
                Recorded privately if you choose — it sharpens Mercury&apos;s {metro.marketLabel} data
                over time. Never shown to candidates.
              </p>

              <div className="mt-3">
                <div className="label mb-2 text-[10px]">Offer letter · optional draft</div>
                <OfferLetterDraft
                  candidateName={a.name}
                  roleTitle={role.title}
                  companyName={companyName}
                  salaryLine={
                    a.hired_salary_hkd
                      ? `${formatSalaryFull(metro, a.hired_salary_hkd)} / ${
                          metro.salaryPeriod === "annual" ? "year" : "month"
                        }`
                      : null
                  }
                />
              </div>
            </div>
          )}

          {/* File buttons */}
          <div className="grid grid-cols-2 gap-2">
            <FileBtn
              label="Original CV"
              meta="SIGNED LINK · PDF"
              icon="doc"
              disabled={!a.cv_file_path}
              busy={fileBusy === "cv"}
              onClick={() => openFile("cv")}
            />
            <FileBtn
              label="Original email"
              meta={`RAW · ${timeAgo(a.created_at)}`}
              icon="mail"
              disabled={!a.raw_email_path}
              busy={fileBusy === "raw"}
              onClick={() => openFile("raw")}
            />
          </div>

          {/* Stage selector — colored dot on every stage, active one filled */}
          <div>
            <div className="label mb-3 text-[10px]">Pipeline stage — you move it</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => onMoveStage(a.id, s)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
                    a.stage === s
                      ? "bg-surface-3 font-medium text-text"
                      : "bg-[rgba(255,255,255,0.03)] text-muted hover:text-text-2"
                  }`}
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: STAGE_COLOR[s] }}
                    aria-hidden
                  />
                  {STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Response — 2×2 grid of templated quick-actions */}
          <div>
            <div className="label mb-3 text-[10px]">Reply in one click · look professional, in your name</div>
            <div className="grid grid-cols-2 gap-2">
              {RESPONSE_CARDS.map((c) => (
                <button
                  key={c.type}
                  onClick={() => onRespond(a, c.type)}
                  className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3.5 text-left transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-[7px] shrink-0" style={{ background: c.color }} aria-hidden />
                    <span className="text-sm font-semibold text-text">{c.title}</span>
                  </div>
                  <p className="text-xs leading-snug text-muted">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FileBtn({
  label,
  meta,
  icon,
  disabled,
  busy,
  onClick,
}: {
  label: string;
  meta: string;
  icon: "doc" | "mail";
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="flex items-center gap-2.5 rounded border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="shrink-0 text-dim">
        {icon === "doc" ? <DocIcon /> : <MailIcon />}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-text-2">{busy ? "Opening…" : label}</div>
        <div className="label mt-0.5 text-[9px]">{meta}</div>
      </div>
    </button>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5H3a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1v-6L8 1.5z"/>
      <path d="M8 1.5V5.5h4"/>
      <line x1="4.5" y1="7.5" x2="9.5" y2="7.5"/>
      <line x1="4.5" y1="9.5" x2="7.5" y2="9.5"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="12" height="9" rx="1"/>
      <path d="M1 4.5l6 4 6-4"/>
    </svg>
  );
}
