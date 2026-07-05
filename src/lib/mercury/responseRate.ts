import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

// Per-employer response-rate measurement — makes the anti-ghosting promise
// verifiable. It reports on the *employer's* professionalism (how reliably they
// reply), never on any candidate. Owner-scoped: every query filters by owner_id
// (the service client bypasses RLS).
//
// Rate = share of *engaged* applicants (stage past 'new' — i.e. ones the
// employer has actually picked up) who have received at least one response.
// Applicants still sitting in 'new' aren't counted against the employer.

export interface ResponseRateStats {
  /** Applicants the employer has engaged (stage != 'new'). */
  engaged: number;
  /** Of the engaged, how many have received ≥1 response. */
  responded: number;
  /** responded / engaged, 0–100, or null when there's nothing to measure yet. */
  ratePct: number | null;
  /** Median hours from card arrival to first response, or null if no responses. */
  medianFirstResponseHours: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Compute the owner's response rate + median time-to-first-response from the
 * data already captured (applicants + mercury_responses). Two owner-scoped
 * reads, aggregated in memory — mirrors listRoles()'s pattern and rides the
 * existing (owner_id) indexes.
 */
export async function getResponseRate(ownerId: string): Promise<ResponseRateStats> {
  const sb = getSupabaseServiceClient();
  const [applicantsRes, responsesRes] = await Promise.all([
    sb.from("mercury_applicants").select("id, stage, created_at").eq("owner_id", ownerId),
    sb.from("mercury_responses").select("applicant_id, sent_at").eq("owner_id", ownerId),
  ]);

  const applicants = (applicantsRes.data ?? []) as {
    id: string;
    stage: string;
    created_at: string;
  }[];
  const responses = (responsesRes.data ?? []) as { applicant_id: string; sent_at: string }[];

  // Earliest response per applicant → time-to-first-response.
  const firstResponseAt = new Map<string, number>();
  for (const r of responses) {
    const t = new Date(r.sent_at).getTime();
    const prev = firstResponseAt.get(r.applicant_id);
    if (prev === undefined || t < prev) firstResponseAt.set(r.applicant_id, t);
  }

  let engaged = 0;
  let responded = 0;
  const latencies: number[] = [];
  for (const a of applicants) {
    if (a.stage === "new") continue; // not yet engaged — don't count against them
    engaged += 1;
    const first = firstResponseAt.get(a.id);
    if (first !== undefined) {
      responded += 1;
      const hours = (first - new Date(a.created_at).getTime()) / 3_600_000;
      if (hours >= 0) latencies.push(hours);
    }
  }

  const ratePct = engaged === 0 ? null : Math.round((responded / engaged) * 100);
  const med = median(latencies);
  return {
    engaged,
    responded,
    ratePct,
    medianFirstResponseHours: med === null ? null : Math.round(med * 10) / 10,
  };
}
