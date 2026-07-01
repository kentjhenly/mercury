import type { MercuryStage } from "@/lib/supabase/types";

// The pipeline, in board order. "declined" is a stage (always visible), never a
// delete or hide.
export const STAGES: MercuryStage[] = [
  "new",
  "reviewing",
  "shortlisted",
  "contacted",
  "interviewing",
  "hired",
  "declined",
];

export const STAGE_LABEL: Record<MercuryStage, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  contacted: "Contacted",
  interviewing: "Interviewing",
  hired: "Hired",
  declined: "Declined",
};

// Instrument-style status tone per stage (muted, not loud). Maps to CSS vars
// defined in globals.css.
export const STAGE_TONE: Record<MercuryStage, "neutral" | "active" | "positive" | "waiting" | "negative"> = {
  new: "neutral",
  reviewing: "neutral",
  shortlisted: "active",
  contacted: "waiting",
  interviewing: "active",
  hired: "positive",
  declined: "negative",
};

// Solid CSS-var color per stage — for the dashboard stage bars (where a tone's
// dim background would be invisible). Mirrors STAGE_TONE's intent.
export const STAGE_COLOR: Record<MercuryStage, string> = {
  new: "var(--muted)",
  reviewing: "var(--text-2)",
  shortlisted: "var(--signal)",
  contacted: "var(--waiting)",
  interviewing: "var(--signal)",
  hired: "var(--positive)",
  declined: "var(--negative)",
};

export function isStage(value: unknown): value is MercuryStage {
  return typeof value === "string" && (STAGES as string[]).includes(value);
}
