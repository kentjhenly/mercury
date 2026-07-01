import "server-only";
import type { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { ParsedFields } from "@/lib/mercury/parse";
import type { MercuryStage } from "@/lib/supabase/types";

// Shared applicant-creation path for every intake channel (inbound email +
// forwards, and CSV backlog import). Centralizes the dedupe pre-check, the
// owner-scoped insert, and the concurrent-delivery race handling so the two
// channels can never diverge on idempotency. Funnel-event emission stays in the
// callers, because the semantics differ per channel (per-email vs per-import).

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

export interface CreateApplicantInput {
  ownerId: string;
  roleId: string;
  name: string | null;
  email: string | null;
  parsed: ParsedFields;
  cv_file_path: string | null;
  raw_email_path: string | null;
  needs_review: boolean;
  /** Idempotency key, unique per role: message-id, then sender email, then CSV email. */
  dedupe_key: string;
  source: "email" | "forward" | "csv";
  /** Defaults to "new". CSV import may carry a row's existing stage. */
  stage?: MercuryStage;
}

export interface CreateApplicantResult {
  /** The applicant id, or null when a concurrent insert won the race. */
  id: string | null;
  /** True when this candidate already existed for the role (no new card). */
  duplicate: boolean;
}

/**
 * The canonical applicant insert row. Single source of truth for the column
 * shape so the single-row (email) and bulk (CSV) paths can never diverge.
 */
export function buildApplicantRow(input: CreateApplicantInput): Record<string, unknown> {
  return {
    role_id: input.roleId,
    owner_id: input.ownerId,
    name: input.name,
    email: input.email,
    parsed_years_exp: input.parsed.years_exp,
    parsed_skills: input.parsed.skills,
    parsed_current_role: input.parsed.current_role,
    parsed_location: input.parsed.location,
    cv_file_path: input.cv_file_path,
    raw_email_path: input.raw_email_path,
    stage: input.stage ?? "new",
    response_owed: true,
    needs_review: input.needs_review,
    dedupe_key: input.dedupe_key,
    source: input.source,
  };
}

export async function createApplicant(
  sb: ServiceClient,
  input: CreateApplicantInput
): Promise<CreateApplicantResult> {
  // Idempotency: a re-delivered email or re-imported row must not create a
  // second card. Dedupe on (role_id, dedupe_key) — also enforced by a unique
  // constraint, which the insert below falls back on for concurrent deliveries.
  const { data: existing } = await sb
    .from("mercury_applicants")
    .select("id")
    .eq("role_id", input.roleId)
    .eq("dedupe_key", input.dedupe_key)
    .maybeSingle();
  if (existing) return { id: existing.id as string, duplicate: true };

  const { data: inserted, error } = await sb
    .from("mercury_applicants")
    .insert(buildApplicantRow(input))
    .select("id")
    .single();

  if (error) {
    // Unique violation = a concurrent delivery already created the card.
    if ((error as { code?: string }).code === "23505") {
      return { id: null, duplicate: true };
    }
    throw error;
  }
  return { id: inserted.id as string, duplicate: false };
}
