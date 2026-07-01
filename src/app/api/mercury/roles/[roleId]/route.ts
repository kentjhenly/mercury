import { NextResponse } from "next/server";
import { requireOwnerId, HttpError } from "@/lib/mercury/owner";
import { parseBody, errorResponse } from "@/lib/utils/api";
import { updateRoleSchema } from "@/lib/utils/schemas";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/mercury/data";
import { canonicalizeSkills } from "@/lib/mercury/skills";
import { CV_BUCKET, RAW_BUCKET } from "@/lib/mercury/storage";

export async function PATCH(request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    const { roleId } = await params;
    const parsed = await parseBody(request, updateRoleSchema);
    if (!parsed.ok) return parsed.response;

    // Confirm ownership before any write.
    const existing = await getRole(ownerId, roleId);
    if (!existing) throw new HttpError(404, "Role not found");

    const patch: Record<string, unknown> = {};
    const input = parsed.data;
    if (input.status !== undefined) patch.status = input.status;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.location !== undefined) patch.location = input.location;
    if (input.experience_target !== undefined) patch.experience_target = input.experience_target;
    if (input.required_skills !== undefined)
      patch.required_skills = canonicalizeSkills(input.required_skills);

    if (Object.keys(patch).length === 0) return NextResponse.json({ role: existing });

    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("mercury_roles")
      .update(patch)
      .eq("owner_id", ownerId)
      .eq("id", roleId)
      .select("*")
      .single();
    if (error || !data) return errorResponse("roles.update", error);
    return NextResponse.json({ role: data });
  } catch (err) {
    return errorResponse("roles.update", err);
  }
}

// Role deletion removes its applicant data (PDPO retention baseline): storage
// files first, then the role row (DB cascade removes applicants + responses).
export async function DELETE(_request: Request, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    const { roleId } = await params;

    const existing = await getRole(ownerId, roleId);
    if (!existing) throw new HttpError(404, "Role not found");

    const sb = getSupabaseServiceClient();

    // Collect this role's stored files (owner-scoped) and remove them.
    const { data: applicants } = await sb
      .from("mercury_applicants")
      .select("cv_file_path, raw_email_path")
      .eq("owner_id", ownerId)
      .eq("role_id", roleId);

    const cvPaths = (applicants ?? []).map((a) => a.cv_file_path).filter((p): p is string => !!p);
    const rawPaths = (applicants ?? []).map((a) => a.raw_email_path).filter((p): p is string => !!p);
    if (cvPaths.length) await sb.storage.from(CV_BUCKET).remove(cvPaths);
    if (rawPaths.length) await sb.storage.from(RAW_BUCKET).remove(rawPaths);

    const { error } = await sb
      .from("mercury_roles")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", roleId);
    if (error) return errorResponse("roles.delete", error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("roles.delete", err);
  }
}
