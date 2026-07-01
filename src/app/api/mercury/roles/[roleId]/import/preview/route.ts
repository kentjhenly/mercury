import { NextResponse } from "next/server";
import Papa from "papaparse";
import { requireOwnerId, HttpError } from "@/lib/mercury/owner";
import { errorResponse } from "@/lib/utils/api";
import { getRole } from "@/lib/mercury/data";
import { suggestMapping } from "@/lib/mercury/csv";
import { MAX_IMPORT_ROWS } from "@/lib/utils/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MB — a backlog seeder, not a feed.

// Step 1 of CSV import: read the uploaded file's headers + rows and suggest a
// column→field mapping. No DB writes. The client confirms the mapping and posts
// the rows back to the commit route. Owner-scoped: the role must belong to the
// caller before we read anything.
export async function POST(request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    const { roleId } = await params;

    const role = await getRole(ownerId, roleId);
    if (!role) throw new HttpError(404, "Role not found");

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Upload a CSV file");
    if (file.size > MAX_CSV_BYTES) throw new HttpError(413, "CSV too large (max 2 MB)");

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
    });

    const headers = (parsed.meta.fields ?? []).filter((h) => h && h.trim());
    if (headers.length === 0) throw new HttpError(422, "Could not read any column headers from the CSV");

    const rows = parsed.data;
    if (rows.length === 0) throw new HttpError(422, "The CSV has headers but no data rows");
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new HttpError(413, `Too many rows (${rows.length}); max ${MAX_IMPORT_ROWS} per import`);
    }

    return NextResponse.json({
      headers,
      rowCount: rows.length,
      sampleRows: rows.slice(0, 5),
      rows, // echoed back to the commit step with the confirmed mapping
      suggestedMapping: suggestMapping(headers),
    });
  } catch (err) {
    return errorResponse("import.preview", err);
  }
}
