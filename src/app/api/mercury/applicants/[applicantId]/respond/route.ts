import { NextResponse } from "next/server";
import { requireOwnerId, HttpError } from "@/lib/mercury/owner";
import { parseBody, errorResponse } from "@/lib/utils/api";
import { sendResponseSchema } from "@/lib/utils/schemas";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getApplicant, getEmployer } from "@/lib/mercury/data";
import { advanceStageForType, type ResponseType } from "@/lib/mercury/templates";
import { sendCandidateResponse } from "@/lib/email/send";
import { rateLimit } from "@/lib/mercury/ratelimit";
import { isValidEmail } from "@/lib/utils/security";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ applicantId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    const { applicantId } = await params;
    const parsed = await parseBody(request, sendResponseSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    // [CRITICAL] Validate the applicant belongs to this owner before sending.
    const applicant = await getApplicant(ownerId, applicantId);
    if (!applicant) throw new HttpError(404, "Applicant not found");
    if (!isValidEmail(applicant.email)) {
      throw new HttpError(422, "This applicant has no valid email to reply to.");
    }

    // [CRITICAL] Rate-limit outbound sends to prevent abuse / runaway email cost.
    if (!rateLimit(`send:${ownerId}`, 30, 60_000).ok) {
      throw new HttpError(429, "Too many messages sent. Please wait a moment.");
    }

    const employer = await getEmployer(ownerId);
    const replyTo = employer?.reply_to || undefined;

    // Send via Resend, reply-to the employer so candidates reply straight to them.
    try {
      await sendCandidateResponse({
        to: applicant.email!,
        replyTo: replyTo ?? "",
        subject: input.subject,
        body: input.body,
      });
    } catch (err) {
      return errorResponse("respond.send", err);
    }

    const sb = getSupabaseServiceClient();

    // Log the response (seed of the anti-ghosting record).
    await sb.from("mercury_responses").insert({
      applicant_id: applicantId,
      owner_id: ownerId,
      type: input.type,
      subject: input.subject,
      body_snapshot: input.body,
    });

    // Clear "response owed"; advance the stage if the template implies one.
    const advanceTo = input.advance_stage ? advanceStageForType(input.type as ResponseType) : null;
    const patch: Record<string, unknown> = {
      response_owed: false,
      updated_at: new Date().toISOString(),
    };
    if (advanceTo) patch.stage = advanceTo;

    const { data: updated, error } = await sb
      .from("mercury_applicants")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("id", applicantId)
      .select("*")
      .single();
    if (error || !updated) return errorResponse("respond.update", error);

    captureServerEvent(FUNNEL.SENT_RESPONSE, ownerId, {
      applicant_id: applicantId,
      type: input.type,
      advanced_to: advanceTo ?? null,
    });

    return NextResponse.json({ applicant: updated });
  } catch (err) {
    return errorResponse("respond", err);
  }
}
