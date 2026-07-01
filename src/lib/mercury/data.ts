import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  MercuryApplicant,
  MercuryEmployer,
  MercuryForwardVerification,
  MercuryRole,
  MercuryStage,
} from "@/lib/supabase/types";
import { STAGES, isStage } from "@/lib/mercury/stages";

// Owner-scoped server-side reads. EVERY function takes ownerId and applies it as
// an explicit filter — the service client bypasses RLS, so this module is the
// guardrail. Never read Mercury data outside these helpers without an owner
// filter.

export async function getEmployer(ownerId: string): Promise<MercuryEmployer | null> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb.from("mercury_employers").select("*").eq("id", ownerId).maybeSingle();
  return data ?? null;
}

export interface RoleWithCounts extends MercuryRole {
  applicant_count: number;
  owed_count: number;
  // Per-stage breakdown for the dashboard stage bars. Counts are factual, not a
  // score — every applicant is in exactly one stage and stays visible.
  stage_counts: Record<MercuryStage, number>;
}

function emptyStageCounts(): Record<MercuryStage, number> {
  return Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<MercuryStage, number>;
}

export async function listRoles(ownerId: string): Promise<RoleWithCounts[]> {
  const sb = getSupabaseServiceClient();
  const { data: roles, error } = await sb
    .from("mercury_roles")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!roles || roles.length === 0) return [];

  // Counts per role, owner-scoped.
  const { data: applicants } = await sb
    .from("mercury_applicants")
    .select("role_id, response_owed, stage")
    .eq("owner_id", ownerId);

  const totals = new Map<string, { total: number; owed: number; stages: Record<MercuryStage, number> }>();
  for (const a of applicants ?? []) {
    const t = totals.get(a.role_id) ?? { total: 0, owed: 0, stages: emptyStageCounts() };
    t.total += 1;
    if (a.response_owed) t.owed += 1;
    if (isStage(a.stage)) t.stages[a.stage] += 1;
    totals.set(a.role_id, t);
  }

  return roles.map((r) => ({
    ...r,
    applicant_count: totals.get(r.id)?.total ?? 0,
    owed_count: totals.get(r.id)?.owed ?? 0,
    stage_counts: totals.get(r.id)?.stages ?? emptyStageCounts(),
  }));
}

export async function getRole(ownerId: string, roleId: string): Promise<MercuryRole | null> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from("mercury_roles")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", roleId)
    .maybeSingle();
  return data ?? null;
}

export async function listApplicants(ownerId: string, roleId: string): Promise<MercuryApplicant[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("mercury_applicants")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("role_id", roleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * The unresolved auto-forward confirmation for a role, if one arrived. Lets the
 * role settings UI surface "Gmail wants you to confirm — code NNNN / open link"
 * so the one-time auto-forward setup can be finished. Owner-scoped.
 */
export async function getPendingForwardVerification(
  ownerId: string,
  roleId: string
): Promise<MercuryForwardVerification | null> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from("mercury_forward_verifications")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("role_id", roleId)
    .eq("resolved", false)
    .maybeSingle();
  return (data as MercuryForwardVerification) ?? null;
}

export async function getApplicant(
  ownerId: string,
  applicantId: string
): Promise<MercuryApplicant | null> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from("mercury_applicants")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", applicantId)
    .maybeSingle();
  return data ?? null;
}
