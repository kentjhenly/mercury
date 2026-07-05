"use client";

import { useEffect, useState } from "react";
import type { MercuryApplicant } from "@/lib/supabase/types";
import type { MetroConfig } from "@/lib/mercury/metro/types";
import { formatSalaryFull } from "@/lib/mercury/salary";
import { OfferLetterDraft } from "./OfferLetterDraft";

interface Props {
  applicant: MercuryApplicant;
  roleTitle: string;
  companyName: string | null;
  metro: MetroConfig;
  onClose: () => void;
  onSaved: (applicant: MercuryApplicant) => void;
}

// Lightweight prompt shown when an applicant is moved to "hired". Optionally
// records the agreed monthly salary (private, feeds the HK dataset later) and
// offers a templated offer-letter draft. Everything here is optional — "Skip"
// closes it cleanly.
export function HireModal({ applicant: a, roleTitle, companyName, metro, onClose, onSaved }: Props) {
  const [salary, setSalary] = useState(a.hired_salary_hkd?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const periodWord = metro.salaryPeriod === "annual" ? "year" : "month";
  const salaryLine = salary ? `${formatSalaryFull(metro, Number(salary))} / ${periodWord}` : null;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/mercury/applicants/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hired_salary_hkd: salary ? Number(salary) : null }),
      });
      const json = await res.json();
      if (res.ok && json.applicant) {
        onSaved(json.applicant);
        setSaved(true);
      } else {
        alert(json.error || "Could not save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-bg-deep/60 backdrop-blur-[3px]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
        <div
          className="flex w-full max-w-[460px] flex-col gap-4 rounded-xl border border-border bg-bg p-6"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2 className="text-lg font-semibold text-text">Hired — nice work.</h2>
            <p className="mt-1 text-sm text-muted">
              {a.name || "This applicant"} is now marked hired for {roleTitle}.
            </p>
          </div>

          {/* Optional private salary capture */}
          <div>
            <div className="label mb-2 text-[10px]">Agreed salary · optional, private to you</div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1.5">
                <span className="text-xs text-dim">{metro.currency}</span>
                <input
                  value={salary}
                  onChange={(e) => {
                    setSalary(e.target.value.replace(/[^0-9]/g, ""));
                    setSaved(false);
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  autoFocus
                  className="tnum w-24 bg-transparent text-sm text-text outline-none"
                  aria-label={`Agreed monthly ${metro.currency}`}
                />
                <span className="text-xs text-dim">/{periodWord === "year" ? "yr" : "mo"}</span>
              </div>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded border border-border px-3 py-1.5 text-xs text-text-2 hover:border-border-strong disabled:opacity-50"
              >
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-dim">
              Recorded privately if you choose — it sharpens {metro.marketLabel} data over time. Never
              shown to candidates.
            </p>
          </div>

          {/* Post-hire value attach: offer-letter draft */}
          <div>
            <div className="label mb-2 text-[10px]">Offer letter · optional draft</div>
            <OfferLetterDraft
              candidateName={a.name}
              roleTitle={roleTitle}
              companyName={companyName}
              salaryLine={salaryLine}
            />
          </div>

          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-muted hover:text-text-2"
            >
              {saved ? "Done" : "Skip"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
