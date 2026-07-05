"use client";

import type { MercuryApplicant, MercuryRole, MercuryStage } from "@/lib/supabase/types";
import { canonicalizeSkill } from "@/lib/mercury/skills";
import { estimateSalary, formatSalaryBand } from "@/lib/mercury/salary";
import { getMetro } from "@/lib/mercury/metro";

interface Props {
  applicant: MercuryApplicant;
  role: MercuryRole;
  onMoveStage: (id: string, stage: MercuryStage) => void;
  onRespond: (applicant: MercuryApplicant) => void;
  onOpen: (applicant: MercuryApplicant) => void;
  onDragStart?: (id: string) => void;
}

export function ApplicantCard({ applicant: a, role, onDragStart, onOpen }: Props) {
  const required = new Set(role.required_skills.map((s) => canonicalizeSkill(s).toLowerCase()));

  const visibleSkills = a.parsed_skills.slice(0, 3);
  const overflow = a.parsed_skills.length - visibleSkills.length;

  // Market context — an instrument readout about the market, never a score of
  // the applicant. Omitted (not fabricated) when family/years are unknown.
  const metro = getMetro(role.metro_id);
  const salary = estimateSalary(metro, role, a);

  return (
    <article
      draggable={Boolean(onDragStart)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", a.id);
        onDragStart?.(a.id);
      }}
      onClick={() => onOpen(a)}
      className="group cursor-pointer"
      style={{
        border: "1px solid rgba(207,212,219,.1)",
        borderRadius: "9px",
        background: "linear-gradient(180deg,#171a20,#101318)",
        padding: "13px",
        transition: "border-color .2s ease, transform .2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(207,212,219,.3)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(207,212,219,.1)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Name + owed dot */}
      <div className="flex items-start justify-between gap-2">
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#eef1f5", letterSpacing: "-.01em", lineHeight: 1.3 }}>
          {a.name || "Unknown applicant"}
        </h3>
        {a.response_owed && (
          <span
            style={{
              marginTop: "4px",
              width: "7px",
              height: "7px",
              flexShrink: 0,
              borderRadius: "50%",
              background: "#b89a63",
              boxShadow: "0 0 7px rgba(184,154,99,.7)",
            }}
            aria-label="Owed a reply"
          />
        )}
      </div>

      {/* Current role */}
      {a.parsed_current_role && (
        <p style={{ marginTop: "4px", fontSize: "11.5px", color: "#8b929c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.parsed_current_role}
        </p>
      )}

      {/* Experience · location */}
      {(a.parsed_years_exp != null || a.parsed_location) && (
        <div
          className="tnum"
          style={{
            marginTop: "9px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "10.5px",
            color: "#7f8088",
          }}
        >
          {a.parsed_years_exp != null && (
            <span style={{ color: "#aeb4bd" }}>{a.parsed_years_exp}y</span>
          )}
          {a.parsed_years_exp != null && a.parsed_location && (
            <span style={{ color: "#3c424b" }}>·</span>
          )}
          {a.parsed_location && <span>{a.parsed_location}</span>}
        </div>
      )}

      {/* HK market context — clearly an estimate for role/experience, not a verdict */}
      {salary && (
        <div
          className="tnum"
          title={salary.shortBasis}
          style={{
            marginTop: "8px",
            display: "flex",
            alignItems: "baseline",
            gap: "7px",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "10px",
            color: "#8b929c",
          }}
        >
          <span style={{ color: "#565c66", letterSpacing: ".1em" }}>MKT EST</span>
          <span style={{ color: "#aeb4bd" }}>
            {salary.confidence === "medium" ? "~" : ""}
            {formatSalaryBand(metro, salary)}
          </span>
        </div>
      )}

      {/* Skill tags */}
      {visibleSkills.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {visibleSkills.map((s) => {
            const isReq = required.has(canonicalizeSkill(s).toLowerCase());
            return (
              <span
                key={s}
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "10px",
                  color: isReq ? "var(--signal)" : "#9aa0aa",
                  background: isReq ? "var(--signal-dim)" : "rgba(207,212,219,.07)",
                  borderRadius: "4px",
                  padding: "3px 7px",
                }}
              >
                {s}
              </span>
            );
          })}
          {overflow > 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "10px",
                color: "#565c66",
                padding: "3px 4px",
              }}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
