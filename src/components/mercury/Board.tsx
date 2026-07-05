"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { MercuryApplicant, MercuryRole, MercuryStage } from "@/lib/supabase/types";
import type { ResponseType } from "@/lib/mercury/templates";
import { STAGES, STAGE_LABEL, STAGE_COLOR } from "@/lib/mercury/stages";
import { getMetro } from "@/lib/mercury/metro";
import { track } from "@/lib/analytics/client";
import { FUNNEL } from "@/lib/analytics/events";
import { ApplicantCard } from "./ApplicantCard";
import { PayPrompt } from "./PayPrompt";

// The detail panel, response composer, and CSV importer only render on user
// action, so their JS (and the templates / CSV parser they pull) is split out of
// the board's initial hydration bundle and fetched lazily on first open.
const ApplicantPanel = dynamic(() => import("./ApplicantPanel").then((m) => m.ApplicantPanel));
const ResponseModal = dynamic(() => import("./ResponseModal").then((m) => m.ResponseModal));
const CsvImportModal = dynamic(() => import("./CsvImportModal").then((m) => m.CsvImportModal));
const HireModal = dynamic(() => import("./HireModal").then((m) => m.HireModal));

type SortMode = "newest" | "experience" | "name";

interface Props {
  role: MercuryRole;
  companyName: string | null;
  initialApplicants: MercuryApplicant[];
  /** Days since the employer signed up — for the return_session (A3) signal. */
  daysSinceSignup: number | null;
}

export function Board({ role, companyName, initialApplicants, daysSinceSignup }: Props) {
  const router = useRouter();
  const [applicants, setApplicants] = useState(initialApplicants);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [responding, setResponding] = useState<MercuryApplicant | null>(null);
  const [respondType, setRespondType] = useState<ResponseType | undefined>(undefined);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [hireModalFor, setHireModalFor] = useState<MercuryApplicant | null>(null);

  const metro = getMetro(role.metro_id);

  // Open the response composer, optionally on a template preselected by a card.
  function openResponder(applicant: MercuryApplicant, type?: ResponseType) {
    setRespondType(type);
    setResponding(applicant);
  }

  // Derive the selected applicant from live state so panel reflects stage/flag changes.
  const selectedApplicant = useMemo(
    () => (selectedApplicantId ? applicants.find((a) => a.id === selectedApplicantId) ?? null : null),
    [selectedApplicantId, applicants],
  );

  useEffect(() => {
    track(FUNNEL.RETURNED_SESSION, { role_id: role.id, days_since_signup: daysSinceSignup });
  }, [role.id, daysSinceSignup]);

  // Unified filter: searches name, email, current role, skills, and location.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return applicants;
    return applicants.filter((a) => {
      const hay = [a.name, a.email, a.parsed_current_role, ...a.parsed_skills, a.parsed_location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [applicants, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "experience") {
      arr.sort((a, b) => (b.parsed_years_exp ?? -1) - (a.parsed_years_exp ?? -1));
    } else if (sort === "name") {
      arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    } else {
      arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return arr;
  }, [filtered, sort]);

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
      // Moving to "hired" opens the lightweight capture: optional agreed salary
      // + offer-letter draft. (prev.stage != "hired" is guaranteed here.)
      if (stage === "hired") setHireModalFor({ ...prev, stage });
    } catch {
      setApplicants((cur) => cur.map((a) => (a.id === id ? { ...a, stage: prev.stage } : a)));
      alert("Could not move card. Please try again.");
    }
  }

  function onSent(updated: MercuryApplicant) {
    setApplicants((cur) => cur.map((a) => (a.id === updated.id ? updated : a)));
    setResponding(null);
  }

  return (
    <>
      <div className="mx-auto max-w-[1600px] px-5 pt-5 pb-6">
        <PayPrompt applicantCount={applicants.length} />

        {/* Filter bar — no panel, border-bottom only */}
        <div
          className="flex flex-wrap items-center gap-3"
          style={{
            marginTop: "20px",
            paddingBottom: "18px",
            borderBottom: "1px solid rgba(207,212,219,.08)",
          }}
        >
          {/* Search */}
          <div className="relative flex min-w-[200px] max-w-[340px] flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <SearchIcon />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name, skill, location…"
              style={{
                width: "100%",
                padding: "10px 12px 10px 32px",
                borderRadius: "8px",
                border: "1px solid rgba(207,212,219,.12)",
                background: "rgba(0,0,0,.3)",
                color: "#e7eaef",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          {/* Sort — connected pill group */}
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "10px",
                letterSpacing: ".14em",
                color: "var(--dim)",
              }}
            >
              SORT
            </span>
            <div
              style={{
                display: "flex",
                gap: "1px",
                background: "rgba(207,212,219,.1)",
                border: "1px solid rgba(207,212,219,.1)",
                borderRadius: "7px",
                overflow: "hidden",
              }}
            >
              {(
                [
                  { value: "newest", label: "Recent" },
                  { value: "experience", label: "Experience" },
                  { value: "name", label: "Name" },
                ] as { value: SortMode; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSort(value)}
                  style={{
                    padding: "7px 12px",
                    fontSize: "11px",
                    background: sort === value ? "rgba(207,212,219,.14)" : "transparent",
                    color: sort === value ? "#eef1f5" : "#8b929c",
                    cursor: "pointer",
                    border: "none",
                    transition: "background .15s, color .15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Import CSV trigger */}
          <button
            onClick={() => setShowImport(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "7px",
              border: "1px solid rgba(207,212,219,.12)",
              background: "transparent",
              color: "#8b929c",
              fontSize: "12px",
              letterSpacing: ".01em",
              cursor: "pointer",
              transition: "border-color .15s, color .15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(207,212,219,.28)";
              (e.currentTarget as HTMLButtonElement).style.color = "#d7dbe1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(207,212,219,.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "#8b929c";
            }}
          >
            <CsvIcon />
            Import CSV
          </button>
        </div>

        {/* Board columns */}
        <div className="flex gap-[14px] overflow-x-auto pb-4 scroll-slim" style={{ marginTop: "18px" }}>
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
              className="flex shrink-0 flex-col"
              style={{
                width: "270px",
                border: "1px solid rgba(207,212,219,.08)",
                borderRadius: "11px",
                background: "linear-gradient(180deg,rgba(19,22,27,.7),rgba(10,12,16,.7))",
              }}
              aria-label={`${STAGE_LABEL[stage]} column`}
            >
              {/* Column header */}
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 14px",
                  borderBottom: "1px solid rgba(207,212,219,.07)",
                }}
              >
                <div className="flex items-center gap-[9px]">
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "2px",
                      background: STAGE_COLOR[stage],
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#d7dbe1", letterSpacing: ".01em" }}>
                    {STAGE_LABEL[stage]}
                  </span>
                </div>
                <span
                  className="tnum"
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "12px",
                    color: "#565c66",
                    minWidth: "18px",
                    textAlign: "center",
                    background: "rgba(0,0,0,.3)",
                    borderRadius: "5px",
                    padding: "2px 7px",
                  }}
                >
                  {byStage[stage].length}
                </span>
              </div>

              {/* Cards */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {byStage[stage].length === 0 ? (
                  <p className="px-1 py-6 text-center text-[11px] text-dim">—</p>
                ) : (
                  byStage[stage].map((a) => (
                    <ApplicantCard
                      key={a.id}
                      applicant={a}
                      role={role}
                      onMoveStage={moveStage}
                      onRespond={openResponder}
                      onOpen={(applicant) => setSelectedApplicantId(applicant.id)}
                      onDragStart={setDragId}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Applicant detail panel */}
      {selectedApplicant && (
        <ApplicantPanel
          key={selectedApplicant.id}
          applicant={selectedApplicant}
          role={role}
          companyName={companyName}
          onClose={() => setSelectedApplicantId(null)}
          onMoveStage={moveStage}
          onRespond={openResponder}
          onUpdate={(updated) =>
            setApplicants((cur) => cur.map((x) => (x.id === updated.id ? updated : x)))
          }
        />
      )}

      {/* Response modal — triggered from card actions or panel */}
      {responding && (
        <ResponseModal
          applicant={responding}
          roleTitle={role.title}
          companyName={companyName}
          initialType={respondType}
          onClose={() => setResponding(null)}
          onSent={onSent}
        />
      )}

      {/* CSV import modal */}
      {showImport && (
        <CsvImportModal
          roleId={role.id}
          onImported={() => router.refresh()}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Hire capture — optional agreed salary + offer-letter draft */}
      {hireModalFor && (
        <HireModal
          applicant={hireModalFor}
          roleTitle={role.title}
          companyName={companyName}
          metro={metro}
          onClose={() => setHireModalFor(null)}
          onSaved={(updated) => {
            setApplicants((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
            setHireModalFor(updated);
          }}
        />
      )}
    </>
  );
}

function CsvIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-dim"
    >
      <circle cx="6" cy="6" r="4.5" />
      <path d="M9.5 9.5L13 13" />
    </svg>
  );
}
