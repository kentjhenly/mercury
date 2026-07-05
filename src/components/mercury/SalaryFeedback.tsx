"use client";

import { useState } from "react";
import type { MetroConfig } from "@/lib/mercury/metro/types";

type Verdict = "looks_right" | "too_low" | "too_high";

interface Props {
  roleId: string;
  family: string;
  yearsUsed: number;
  metro: MetroConfig;
}

// The correction loop next to a shown band. One tap says whether the market
// number looks right; "too low/high" optionally takes an expected figure. It's a
// quiet data-collection affordance — no free text, no workflow, no candidate
// involvement. Feedback is about the *market data*, never the applicant.
export function SalaryFeedback({ roleId, family, yearsUsed, metro }: Props) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [suggested, setSuggested] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function submit(v: Verdict, withAmount: boolean) {
    if (state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/mercury/salary-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: roleId,
          family,
          years_used: yearsUsed,
          verdict: v,
          suggested_monthly_hkd: withAmount && suggested ? Number(suggested) : null,
        }),
      });
      if (!res.ok) throw new Error();
      setState("done");
    } catch {
      setState("idle");
      setVerdict(null);
      alert("Could not save that. Please try again.");
    }
  }

  function onPick(v: Verdict) {
    // "Looks right" needs no figure — submit straight away. The directional
    // verdicts reveal an optional expected amount first.
    if (v === "looks_right") {
      setVerdict(v);
      void submit(v, false);
    } else {
      setVerdict(v);
    }
  }

  if (state === "done") {
    return (
      <p className="mt-2.5 font-mono text-[10.5px] tracking-wide text-dim">
        Thanks — noted. It helps sharpen {metro.marketLabel} data.
      </p>
    );
  }

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-mono text-[10.5px] tracking-wide text-dim">Does this look right?</span>
        <div className="flex gap-1">
          {(
            [
              { v: "looks_right", label: "Looks right" },
              { v: "too_low", label: "Too low" },
              { v: "too_high", label: "Too high" },
            ] as { v: Verdict; label: string }[]
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              disabled={state === "sending"}
              onClick={() => onPick(v)}
              className={`rounded border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-50 ${
                verdict === v
                  ? "border-border-strong bg-surface-2 text-text"
                  : "border-border text-muted hover:border-border-strong hover:text-text-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(verdict === "too_low" || verdict === "too_high") && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] tracking-wide text-dim">
            What would you expect? (optional)
          </span>
          <div className="flex items-center gap-1.5 rounded border border-border bg-bg px-2.5 py-1">
            <span className="text-[11px] text-dim">{metro.currency}</span>
            <input
              value={suggested}
              onChange={(e) => setSuggested(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="0"
              className="tnum w-16 bg-transparent text-[12px] text-text outline-none"
              aria-label={`Expected monthly ${metro.currency}`}
            />
            <span className="text-[11px] text-dim">/mo</span>
          </div>
          <button
            type="button"
            disabled={state === "sending"}
            onClick={() => submit(verdict, true)}
            className="rounded border border-border px-2.5 py-1 text-[11px] text-text-2 hover:border-border-strong disabled:opacity-50"
          >
            {state === "sending" ? "Saving…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
