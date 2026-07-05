import { NextResponse } from "next/server";
import { requireOwnerId, HttpError } from "@/lib/mercury/owner";
import { parseBody, errorResponse, assertSameOrigin } from "@/lib/utils/api";
import { importCsvSchema } from "@/lib/utils/schemas";
import { getRole } from "@/lib/mercury/data";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { buildApplicantRow } from "@/lib/mercury/createApplicant";
import { coerceMapping, rowToApplicant } from "@/lib/mercury/csv";
import { rateLimit } from "@/lib/mercury/ratelimit";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK = 200;

// Step 2 of CSV import: commit the confirmed mapping + rows into applicant cards.
// Reuses the same dedupe discipline as email (unique role_id+dedupe_key, keyed on
// the candidate's email) so re-imports and mixed email/CSV intake never
// double-create a card. Bulk-upserts in chunks for a fast one-time seed.
export async function POST(request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    assertSameOrigin(request);
    const ownerId = await requireOwnerId();
    const { roleId } = await params;

    // Rows from the preview step are echoed back here; allow a larger body than
    // the 1 MB default (still bounded — preview caps the file at 2 MB / 2000 rows).
    const parsed = await parseBody(request, importCsvSchema, 16_000_000);
    if (!parsed.ok) return parsed.response;

    const role = await getRole(ownerId, roleId);
    if (!role) throw new HttpError(404, "Role not found");

    // Bound abuse / runaway imports per owner.
    if (!rateLimit(`import:${ownerId}`, 5, 60_000).ok) {
      throw new HttpError(429, "Too many imports — give it a minute.");
    }

    const mapping = coerceMapping(parsed.data.mapping);
    if (!mapping.email && !mapping.name) {
      throw new HttpError(422, "Map at least a name or email column before importing.");
    }

    const sb = getSupabaseServiceClient();

    // First-ever ingest for this owner? (funnel signal — checked once, not per row)
    const { count: priorCount } = await sb
      .from("mercury_applicants")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId);

    // Project + dedupe within the file first (collapse repeated emails), then
    // build insert rows through the shared column shape.
    const seen = new Set<string>();
    const prepared: { row: Record<string, unknown>; needsReview: boolean }[] = [];
    let duplicates = 0;

    parsed.data.rows.forEach((raw, i) => {
      const m = rowToApplicant(raw, mapping);
      // Rows without a usable email get a stable per-file synthetic key, so a
      // re-import of the same file still dedupes (same row index → same key).
      const dedupe_key = (m.dedupeKey ?? `csv-noemail-${roleId}-${i}`).slice(0, 400);
      if (seen.has(dedupe_key)) {
        duplicates += 1;
        return;
      }
      seen.add(dedupe_key);
      prepared.push({
        row: buildApplicantRow({
          ownerId,
          roleId,
          name: m.name,
          email: m.email,
          parsed: m.parsed,
          cv_file_path: null,
          raw_email_path: null,
          needs_review: m.needs_review,
          dedupe_key,
          source: "csv",
          stage: m.stage,
        }),
        needsReview: m.needs_review,
      });
    });

    // Chunked, idempotent insert: existing (role_id, dedupe_key) rows are skipped
    // and not returned, so data.length is exactly the count newly created.
    let created = 0;
    for (let i = 0; i < prepared.length; i += CHUNK) {
      const slice = prepared.slice(i, i + CHUNK);
      const { data, error } = await sb
        .from("mercury_applicants")
        .upsert(
          slice.map((p) => p.row),
          { onConflict: "role_id,dedupe_key", ignoreDuplicates: true }
        )
        .select("id");
      if (error) {
        console.error("[import.commit] chunk upsert failed", error);
        throw new HttpError(500, "Import failed partway — re-run to finish (already-imported rows are skipped).");
      }
      const insertedCount = data?.length ?? 0;
      created += insertedCount;
      duplicates += slice.length - insertedCount;
    }

    const needs_review = prepared.filter((p) => p.needsReview).length;

    if (created > 0 && (priorCount ?? 0) === 0) {
      captureServerEvent(FUNNEL.FIRST_INGEST, ownerId, { role_id: roleId, via: "csv" });
    }
    captureServerEvent(FUNNEL.CSV_IMPORTED, ownerId, { role_id: roleId, created, duplicates, needs_review });

    return NextResponse.json({ created, duplicates, needs_review });
  } catch (err) {
    return errorResponse("import.commit", err);
  }
}
