import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily reminder job (Vercel Cron). Logs how many applicants are still owed a
// reply per employer so the "responses owed" signal stays honest. Kept minimal
// for the MVP — it reports; it does not auto-send anything.
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
  // Owed responses, excluding terminal stages (hired/declined don't owe a reply).
  const { data, error } = await sb
    .from("mercury_applicants")
    .select("owner_id")
    .eq("response_owed", true)
    .not("stage", "in", "(hired,declined)");
  if (error) {
    console.error("[cron.response-reminders]", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const rows = (data ?? []) as { owner_id: string }[];
  const byOwner = new Map<string, number>();
  for (const row of rows) byOwner.set(row.owner_id, (byOwner.get(row.owner_id) ?? 0) + 1);

  for (const [owner_id, owed] of byOwner) {
    console.log(JSON.stringify({ event: "mercury_response_reminder", owner_id, owed }));
  }

  return NextResponse.json({ ok: true, employers_with_owed: byOwner.size });
}
