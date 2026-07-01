import { NextResponse } from "next/server";
import { requireOwnerId } from "@/lib/mercury/owner";
import { parseBody, errorResponse } from "@/lib/utils/api";
import { createRoleSchema } from "@/lib/utils/schemas";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { generateIngestToken, forwardingAddress } from "@/lib/mercury/ingest";
import { canonicalizeSkills } from "@/lib/mercury/skills";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

export async function POST(request: Request) {
  try {
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

    return NextResponse.json({ role: { ...data, forwarding_address: forwardingAddress(data.ingest_token) } });
  } catch (err) {
    return errorResponse("roles.create", err);
  }
}
