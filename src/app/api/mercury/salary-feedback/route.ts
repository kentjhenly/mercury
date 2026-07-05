import { NextResponse } from "next/server";
import { requireOwnerId, HttpError } from "@/lib/mercury/owner";
import { parseBody, errorResponse, assertSameOrigin } from "@/lib/utils/api";
import { salaryFeedbackSchema } from "@/lib/utils/schemas";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/mercury/data";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

// The salary correction loop. An employer taps "does this look right?" next to a
// shown market band; we persist their verdict + optional expected figure and fire
// a funnel event. Data collection + engagement — not a support ticket.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ownerId = await requireOwnerId();
    const parsed = await parseBody(request, salaryFeedbackSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    // [CRITICAL] The role must belong to this owner before we attach feedback.
    const role = await getRole(ownerId, input.role_id);
    if (!role) throw new HttpError(404, "Role not found");

    const sb = getSupabaseServiceClient();
    const { error } = await sb.from("mercury_salary_feedback").insert({
      owner_id: ownerId,
      role_id: input.role_id,
      family: input.family,
      years_used: input.years_used,
      verdict: input.verdict,
      suggested_monthly_hkd: input.suggested_monthly_hkd ?? null,
    });
    if (error) return errorResponse("salary-feedback.create", error);

    // No amount in the event payload — keep the signal privacy-light.
    captureServerEvent(FUNNEL.SALARY_FEEDBACK_GIVEN, ownerId, {
      role_id: input.role_id,
      family: input.family,
      years_used: input.years_used,
      verdict: input.verdict,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("salary-feedback.create", err);
  }
}
