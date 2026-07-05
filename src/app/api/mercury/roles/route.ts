import { NextResponse } from "next/server";
import { requireOwnerId } from "@/lib/mercury/owner";
import { parseBody, errorResponse, assertSameOrigin } from "@/lib/utils/api";
import { createRoleSchema } from "@/lib/utils/schemas";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { generateIngestToken, forwardingAddress } from "@/lib/mercury/ingest";
import { canonicalizeSkills } from "@/lib/mercury/skills";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ownerId = await requireOwnerId();
    const parsed = await parseBody(request, createRoleSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const sb = getSupabaseServiceClient();
    const ingest_token = generateIngestToken();

    const { data, error } = await sb
      .from("mercury_roles")
      .insert({
        owner_id: ownerId,
        title: input.title,
        description: input.description ?? null,
        required_skills: canonicalizeSkills(input.required_skills ?? []),
        location: input.location ?? null,
        experience_target: input.experience_target ?? null,
        ingest_token,
        status: "open",
      })
      .select("*")
      .single();

    if (error || !data) return errorResponse("roles.create", error);

    captureServerEvent(FUNNEL.CREATED_ROLE, ownerId, { role_id: data.id });

    // A2 signal: emit once, when this is the owner's second role. The just-
    // inserted row is included in the count, so total === 2 means role #2.
    const { count } = await sb
      .from("mercury_roles")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId);
    if (count === 2) {
      captureServerEvent(FUNNEL.SECOND_ROLE_CREATED, ownerId, { role_id: data.id });
    }

    return NextResponse.json({ role: { ...data, forwarding_address: forwardingAddress(data.ingest_token) } });
  } catch (err) {
    return errorResponse("roles.create", err);
  }
}
