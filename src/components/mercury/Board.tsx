"use client";

import { useEffect, useMemo, useState } from "react";
import type { MercuryApplicant, MercuryRole, MercuryStage } from "@/lib/supabase/types";
import { STAGES, STAGE_LABEL, STAGE_TONE } from "@/lib/mercury/stages";
import { canonicalizeSkill } from "@/lib/mercury/skills";
import { computeRelevance } from "@/lib/mercury/relevance";
import { track } from "@/lib/analytics/client";
import { FUNNEL } from "@/lib/analytics/events";
import { StatusStrip } from "./StatusStrip";
import { ApplicantCard } from "./ApplicantCard";
import { ResponseModal } from "./ResponseModal";
import { PayPrompt } from "./PayPrompt";

type SortMode = "newest" | "experience" | "relevance";

interface Props {
  role: MercuryRole;
  companyName: string | null;
  initialApplicants: MercuryApplicant[];
}

export function Board({ role, companyName, initialApplicants }: Props) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [minYears, setMinYears] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [responding, setResponding] = useState<MercuryApplicant | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Returning-session signal for the funnel (one per board mount).
  useEffect(() => {
    track(FUNNEL.RETURNED_SESSION, { role_id: role.id });
  }, [role.id]);

  // Skill options = role's required skills ∪ all detected skills.
  const skillOptions = useMemo(() => {
    const set = new Set<string>(role.required_skills.map(canonicalizeSkill));
    for (const a of applicants) for (const s of a.parsed_skills) set.add(canonicalizeSkill(s));
    return [...set].sort((x, y) => x.localeCompare(y));
  }, [applicants, role.required_skills]);

  // True counts (status strip reflects everyone, regardless of active filters).
  const counts = useMemo(() => {
    const c = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<MercuryStage, number>;
    for (const a of applicants) c[a.stage] += 1;
    return c;
  }, [applicants]);
  const owed = useMemo(() => applicants.filter((a) => a.response_owed).length, [applicants]);

  // Filter (human-set, transparent) — never hides via a hidden score.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = minYears ? Number(minYears) : null;
    const loc = location.trim().toLowerCase();
    const sk = skill ? canonicalizeSkill(skill).toLowerCase() : "";
    return applicants.filter((a) => {
      if (needle) {
        const hay = `${a.name ?? ""} ${a.email ?? ""} ${a.parsed_current_role ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (sk && !a.parsed_skills.some((s) => canonicalizeSkill(s).toLowerCase() === sk)) return false;
      if (min != null && (a.parsed_years_exp == null || a.parsed_years_exp < min)) return false;
      if (loc && !(a.parsed_location ?? "").toLowerCase().includes(loc)) return false;
      return true;
    });
  }, [applicants, q, skill, minYears, location]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "experience") {
      arr.sort((a, b) => (b.parsed_years_exp ?? -1) - (a.parsed_years_exp ?? -1));
    } else if (sort === "relevance") {
      arr.sort((a, b) => computeRelevance(b, role).score - computeRelevance(a, role).score);
    } else {
      arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return arr;
  }, [filtered, sort, role]);

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((s) => [s, [] as MercuryApplicant[]])) as Record<
      MercuryStage,
      MercuryApplicant[]
    >;
    for (const a of sorted) m[a.stage].push(a);
    return m;
  }, [sorted]);

  async function moveStage(id: string, stage: MercuryStage) {
    const prev = applicants.find((a) => a.id === id);
    if (!prev || prev.stage === stage) return;
    setApplicants((cur) => cur.map((a) => (a.id === id ? { ...a, stage } : a)));
    try {
      const res = await fetch(`/api/mercury/applicants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setApplicants((cur) => cur.map((a) => (a.id === id ? { ...a, stage: prev.stage } : a)));
      alert("Could not move card. Please try again.");
    }
  }

  function onSent(updated: MercuryApplicant) {
    setApplicants((cur) => cur.map((a) => (a.id === updated.id ? updated : a)));
    setResponding(null);
  }

  const filtersActive = q || skill || minYears || location;
  const shownCount = sorted.length;

  return (
    <>
      <StatusStrip
        roleTitle={role.title}
        roleStatus={role.status}
        counts={counts}
        owed={owed}
        total={applicants.length}
      />

      <div className="mx-auto max-w-[1600px] px-5 py-4">
        <PayPrompt applicantCount={applicants.length} />

        {/* Filters — every filter is human-set and visible */}
        <div className="panel mb-4 flex flex-wrap items-center gap-2 p-3" style={{ boxShadow: "none" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, role…"
            className="min-w-[12rem] flex-1 rounded border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-signal"
          />
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="rounded border border-border bg-bg px-2.5 py-1.5 text-xs text-text-2 outline-none focus:border-signal"
            aria-label="Filter by skill"
          >
            <option value="">Any skill</option>
            {skillOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={minYears}
            onChange={(e) => setMinYears(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Min yrs"
            className="tnum w-20 rounded border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-signal"
            aria-label="Minimum years of experience"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-28 rounded border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-signal"
            aria-label="Filter by location"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded border border-border bg-bg px-2.5 py-1.5 text-xs text-text-2 outline-none focus:border-signal"
            aria-label="Sort"
          >
            <option value="newest">Sort: Newest</option>
            <option value="experience">Sort: Most experience</option>
            <option value="relevance">Sort: Most relevant to role</option>
          </select>
          {filtersActive && (
            <button
              onClick={() => {
                setQ("");
                setSkill("");
                setMinYears("");
                setLocation("");
              }}
              className="text-xs text-signal hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Transparency line for the sort aid + filter effect */}
        <p className="mb-3 text-[11px] text-dim">
          {sort === "relevance"
            ? "Relevance is a sort aid only — required-skill overlap (plus experience-target proximity). It reorders; it never hides anyone."
            : "Showing every applicant. Filters and sort are yours to set and clear."}
          {filtersActive && ` · ${shownCount} of ${applicants.length} match your filters.`}
        </p>

        {/* Board columns */}
        <div className="flex gap-3 overflow-x-auto pb-4 scroll-slim">
          {STAGES.map((stage) => (
            <section
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) moveStage(id, stage);
                setDragId(null);
              }}
              className="flex w-72 shrink-0 flex-col"
              aria-label={`${STAGE_LABEL[stage]} column`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={`rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wider tone-${STAGE_TONE[stage]}`}>
                  {STAGE_LABEL[stage]}
                </span>
                <span className="tnum text-xs text-dim">{byStage[stage].length}</span>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2.5 rounded-lg border border-dashed border-border-soft/60 p-2">
                {byStage[stage].length === 0 ? (
                  <p className="px-1 py-6 text-center text-[11px] text-dim">—</p>
                ) : (
                  byStage[stage].map((a) => (
                    <ApplicantCard
                      key={a.id}
                      applicant={a}
                      role={role}
                      onMoveStage={moveStage}
                      onRespond={setResponding}
                      onDragStart={setDragId}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {responding && (
        <ResponseModal
          applicant={responding}
          roleTitle={role.title}
          companyName={companyName}
          onClose={() => setResponding(null)}
          onSent={onSent}
        />
      )}
    </>
  );
}
