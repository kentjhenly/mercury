import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getResponseRate } from "@/lib/mercury/responseRate";
import { captureServerEvent } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily snapshot job (Vercel Cron). Records each employer's response rate +
// median time-to-first-response so history exists for cohort analysis and a
// future "verified responder" threshold. Measurement only — it stores a row and
// emits an event; it sends nothing to anyone.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseServiceClient();
  const { data: employers, error } = await sb.from("mercury_employers").select("id");
  if (error) {
    console.error("[cron.response-stats]", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const snapshotDate = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  let snapshotted = 0;

  for (const { id: ownerId } of (employers ?? []) as { id: string }[]) {
    const stats = await getResponseRate(ownerId);

    const { error: upsertError } = await sb.from("mercury_response_stats").upsert(
      {
        owner_id: ownerId,
        snapshot_date: snapshotDate,
        engaged: stats.engaged,
        responded: stats.responded,
        rate_pct: stats.ratePct,
        median_first_response_hours: stats.medianFirstResponseHours,
      },
      { onConflict: "owner_id,snapshot_date" }
    );
    if (upsertError) {
      console.error("[cron.response-stats] upsert", ownerId, upsertError);
      continue;
    }

    snapshotted += 1;
    captureServerEvent("mercury_response_rate_snapshot", ownerId, {
      snapshot_date: snapshotDate,
      engaged: stats.engaged,
      responded: stats.responded,
      rate_pct: stats.ratePct,
      median_first_response_hours: stats.medianFirstResponseHours,
    });
  }

  return NextResponse.json({ ok: true, snapshotted });
}
