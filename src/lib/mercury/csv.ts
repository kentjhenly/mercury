import { canonicalizeSkills } from "@/lib/mercury/skills";
import { isStage } from "@/lib/mercury/stages";
import { clampText, parseIntInRange, isValidEmail } from "@/lib/utils/security";
import type { ParsedFields } from "@/lib/mercury/parse";
import type { MercuryStage } from "@/lib/supabase/types";

// CSV backlog import — a one-time seeder so a new workspace isn't an empty board.
// The column→field mapping is suggested by transparent string matching (the same
// no-ML stance as skill normalization); the employer confirms it before commit.

export const IMPORT_FIELDS = [
  "name",
  "email",
  "years_exp",
  "skills",
  "current_role",
  "location",
  "stage",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type ColumnMapping = Record<ImportField, string | null>;

// Header aliases per field. Compared on a normalized (lowercased, separator-free)
// form. Order matters only for readability — matching tries exact then contains.
const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ["name", "full name", "candidate", "candidate name", "applicant", "applicant name"],
  email: ["email", "e mail", "email address", "mail", "contact email"],
  years_exp: ["years exp", "years experience", "years of experience", "experience", "yoe", "exp", "years"],
  skills: ["skills", "skill", "technologies", "tech", "stack", "keywords", "tags"],
  current_role: ["current role", "role", "title", "job title", "position", "current position", "headline"],
  location: ["location", "city", "based", "based in", "region", "country", "where"],
  stage: ["stage", "status", "pipeline", "step"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Suggest a column→field mapping for a CSV's headers. Each field is assigned at
 * most one column (exact normalized match preferred, then substring), and each
 * column is used at most once. Unmatched fields map to null for manual mapping.
 */
export function suggestMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const used = new Set<string>();
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, null])) as ColumnMapping;

  for (const field of IMPORT_FIELDS) {
    const aliases = FIELD_ALIASES[field];
    // Exact match first.
    let hit = normalized.find((c) => !used.has(c.raw) && aliases.includes(c.norm));
    // Then a contains match in either direction.
    if (!hit) {
      hit = normalized.find(
        (c) => !used.has(c.raw) && aliases.some((a) => c.norm === a || c.norm.includes(a) || a.includes(c.norm))
      );
    }
    if (hit) {
      mapping[field] = hit.raw;
      used.add(hit.raw);
    }
  }
  return mapping;
}

/** Coerce a loosely-validated mapping object into a full, typed ColumnMapping. */
export function coerceMapping(raw: Record<string, string | null>): ColumnMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, null])) as ColumnMapping;
  for (const field of IMPORT_FIELDS) {
    const v = raw[field];
    if (typeof v === "string" && v.trim()) mapping[field] = v;
  }
  return mapping;
}

export interface MappedRow {
  name: string | null;
  email: string | null;
  parsed: ParsedFields;
  stage: MercuryStage;
  needs_review: boolean;
  /** Email-based idempotency key, or null when the row carries no usable email. */
  dedupeKey: string | null;
}

/** Project one CSV row through the confirmed mapping into applicant fields. */
export function rowToApplicant(row: Record<string, string>, mapping: ColumnMapping): MappedRow {
  const get = (field: ImportField): string => {
    const col = mapping[field];
    return col ? (row[col] ?? "").toString() : "";
  };

  const name = clampText(get("name"), 200);
  const rawEmail = get("email").trim().toLowerCase();
  const email = isValidEmail(rawEmail) ? rawEmail : null;
  const years_exp = parseIntInRange(get("years_exp"), 0, 50);
  const skills = canonicalizeSkills(
    get("skills")
      .split(/[,;/|]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  ).slice(0, 40);
  const current_role = clampText(get("current_role"), 120);
  const location = clampText(get("location"), 120);

  const stageRaw = get("stage").trim().toLowerCase();
  const stage: MercuryStage = isStage(stageRaw) ? stageRaw : "new";

  // A row with neither a usable email nor a name can't be acted on safely — keep
  // it (never drop), but flag for a human to fix.
  const needs_review = !email || !name;

  return {
    name,
    email,
    parsed: { years_exp, skills, current_role, location },
    stage,
    needs_review,
    dedupeKey: email,
  };
}
