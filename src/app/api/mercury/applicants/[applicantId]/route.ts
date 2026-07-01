import { NextResponse } from "next/server";
import { requireOwnerId, HttpError } from "@/lib/mercury/owner";
import { parseBody, errorResponse } from "@/lib/utils/api";
import { updateApplicantSchema } from "@/lib/utils/schemas";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getApplicant } from "@/lib/mercury/data";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

export async function PATCH(request: Request, { params }: { params: Promise<{ applicantId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    const { applicantId } = await params;
    const parsed = await parseBody(request, updateApplicantSchema);
    if (!parsed.ok) return parsed.response;

    // Ownership check before any write.
    const existing = await getApplicant(ownerId, applicantId);
    if (!existing) throw new HttpError(404, "Applicant not found");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const { stage, response_owed, needs_review } = parsed.data;
    if (stage !== undefined) patch.stage = stage;
    if (response_owed !== undefined) patch.response_owed = response_owed;
    if (needs_review !== undefined) patch.needs_review = needs_review;

    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("mercury_applicants")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("id", applicantId)
      .select("*")
      .single();
    if (error || !data) return errorResponse("applicants.update", error);

    if (stage !== undefined && stage !== existing.stage) {
      captureServerEvent(FUNNEL.MOVED_STAGE, ownerId, {
        applicant_id: applicantId,
        from: existing.stage,
        to: stage,
      });
    }

    return NextResponse.json({ applicant: data });
  } catch (err) {
    return errorResponse("applicants.update", err);
  }
}
