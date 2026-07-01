import { NextResponse } from "next/server";
import { requireOwnerId } from "@/lib/mercury/owner";
import { parseBody, errorResponse } from "@/lib/utils/api";
import { payFeedbackSchema } from "@/lib/utils/schemas";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

// The validation signal: "would you pay / how much" after real use.
export async function POST(request: Request) {
  try {
    const ownerId = await requireOwnerId();
    const parsed = await parseBody(request, payFeedbackSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const sb = getSupabaseServiceClient();
    const { error } = await sb.from("mercury_pay_feedback").insert({
      owner_id: ownerId,
      would_pay: input.would_pay ?? null,
      amount_hkd: input.amount_hkd ?? null,
      comment: input.comment ?? null,
    });
    if (error) return errorResponse("feedback.create", error);

    captureServerEvent(FUNNEL.PAY_PROMPT_ANSWERED, ownerId, {
      would_pay: input.would_pay ?? null,
      amount_hkd: input.amount_hkd ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("feedback.create", err);
  }
}
