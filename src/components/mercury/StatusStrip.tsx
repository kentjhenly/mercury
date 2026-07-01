"use client";

import type { MercuryStage } from "@/lib/supabase/types";
import { STAGES, STAGE_LABEL, STAGE_TONE } from "@/lib/mercury/stages";

interface Props {
  roleTitle: string;
  roleStatus: "open" | "closed";
  counts: Record<MercuryStage, number>;
  owed: number;
  total: number;
}

// Persistent instrument strip: current role, counts by stage, responses owed.
export function StatusStrip({ roleTitle, roleStatus, counts, owed, total }: Props) {
  return (
    <div className="sticky top-[49px] z-20 border-b border-border-soft bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">{roleTitle}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
              roleStatus === "open" ? "tone-active" : "tone-neutral"
            }`}
          >
            {roleStatus}
          </span>
        </div>

        <span className="h-4 w-px bg-border" aria-hidden />

        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-dim uppercase tracking-wider">Total</span>
          <span className="tnum font-semibold text-text">{total}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {STAGES.map((s) => (
            <div key={s} className="flex items-center gap-1.5 text-[11px]" title={STAGE_LABEL[s]}>
              <span className={`rounded px-1 tone-${STAGE_TONE[s]} text-[10px]`}>{STAGE_LABEL[s]}</span>
              <span className="tnum text-text-2">{counts[s]}</span>
            </div>
          ))}
        </div>

        <span className="ml-auto flex items-center gap-1.5 text-[11px]">
          <span className="uppercase tracking-wider text-dim">Replies owed</span>
          <span className={`tnum font-semibold ${owed > 0 ? "text-waiting" : "text-text-2"}`}>{owed}</span>
        </span>
      </div>
    </div>
  );
}
