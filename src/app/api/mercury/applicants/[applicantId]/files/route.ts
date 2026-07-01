import { NextResponse } from "next/server";
import { requireOwnerId, HttpError } from "@/lib/mercury/owner";
import { errorResponse } from "@/lib/utils/api";
import { getApplicant } from "@/lib/mercury/data";
import { CV_BUCKET, RAW_BUCKET, createSignedUrl } from "@/lib/mercury/storage";

// Mint a short-lived signed URL for an applicant's CV or raw email. Files live in
// PRIVATE buckets and are only ever reachable through this owner-checked route.
export async function GET(request: Request, { params }: { params: Promise<{ applicantId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    const { applicantId } = await params;
    const kind = new URL(request.url).searchParams.get("kind"); // "cv" | "raw"

    const applicant = await getApplicant(ownerId, applicantId);
    if (!applicant) throw new HttpError(404, "Applicant not found");

    if (kind === "raw") {
      if (!applicant.raw_email_path) throw new HttpError(404, "No raw email stored");
      const url = await createSignedUrl(RAW_BUCKET, applicant.raw_email_path);
      if (!url) throw new HttpError(500, "Could not create link");
      return NextResponse.json({ url });
    }

    // default: CV
    if (!applicant.cv_file_path) throw new HttpError(404, "No CV stored");
    const url = await createSignedUrl(CV_BUCKET, applicant.cv_file_path);
    if (!url) throw new HttpError(500, "Could not create link");
    return NextResponse.json({ url });
  } catch (err) {
    return errorResponse("applicants.files", err);
  }
}
