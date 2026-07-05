import { NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { tokenFromRecipient } from "@/lib/mercury/ingest";
import { normalizeInbound, pickCvAttachment } from "@/lib/mercury/inbound";
import { resolveOriginalSender, detectForwardVerification } from "@/lib/mercury/forwarded";
import { createApplicant } from "@/lib/mercury/createApplicant";
import { extractText, parseCvText } from "@/lib/mercury/parse";
import { CV_BUCKET, RAW_BUCKET, uploadPrivate } from "@/lib/mercury/storage";
import { sanitizeStorageFileName } from "@/lib/utils/security";
import { rateLimit } from "@/lib/mercury/ratelimit";
import { captureServerEvent } from "@/lib/analytics/server";
import { FUNNEL } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard ceiling on an inbound POST: one 15 MB attachment base64-inflates to ~20 MB,
// plus body/headers. Reject anything larger up front so a rogue authorized sender
// can't force a huge parse at this unauthenticated-facing trust boundary.
const MAX_INBOUND_BYTES = 30 * 1024 * 1024;

// [CRITICAL] Verify the shared inbound secret before accepting anything. An
// attacker who can't present it must not be able to POST fake applicants.
function isAuthorized(request: Request): boolean {
  const expected = process.env.INBOUND_SECRET;
  if (!expected) {
    console.error("[inbound] INBOUND_SECRET not configured — rejecting all inbound posts.");
    return false;
  }
  const header =
    request.headers.get("x-inbound-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // 1. Authenticity.
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1b. Bound the payload size before we read/parse the body.
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INBOUND_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // 2. Coarse rate limit (per source IP) to bound abuse / runaway ingestion.
  //    Prefer the platform-set x-real-ip: the leftmost x-forwarded-for value is
  //    client-supplied and can be rotated to evade a per-IP limit.
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown";
  if (!rateLimit(`inbound:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // 3. Normalize payload.
  let mail;
  try {
    mail = await normalizeInbound(request);
  } catch (err) {
    console.error("[inbound] parse error", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 4. Resolve token → role → owner. Invalid token: drop SAFELY (200, no detail)
  //    so the endpoint can't be used to probe which tokens exist.
  const token = tokenFromRecipient(mail.to);
  if (!token) return NextResponse.json({ ok: true, ignored: true });

  const sb = getSupabaseServiceClient();
  const { data: role } = await sb
    .from("mercury_roles")
    .select("id, owner_id, required_skills, status")
    .eq("ingest_token", token)
    .maybeSingle();
  if (!role) return NextResponse.json({ ok: true, ignored: true });

  const ownerId = role.owner_id;

  // 4b. Auto-forward setup: Gmail/Outlook email a confirmation code to the role
  //     address. Capture it for the employer and DO NOT create an applicant card
  //     (a spoofed "confirmation" must never become a candidate).
  const verification = detectForwardVerification(mail);
  if (verification.isVerification) {
    await sb.from("mercury_forward_verifications").upsert(
      {
        owner_id: ownerId,
        role_id: role.id,
        provider: verification.provider,
        code: verification.code,
        confirm_url: verification.confirmUrl,
        resolved: false,
        received_at: new Date().toISOString(),
      },
      { onConflict: "role_id" }
    );
    return NextResponse.json({ ok: true, verification: true });
  }

  // 4c. Resolve the TRUE applicant. A manual forward carries the employer as the
  //     envelope From; the real candidate is in the quoted block. This keeps the
  //     stored email pointed at the candidate so responses reply to them.
  const sender = resolveOriginalSender(mail);
  const senderName = sender.name;
  const senderEmail = sender.email;
  const source: "email" | "forward" = sender.forwarded ? "forward" : "email";

  // 5. Idempotency: forwards dedupe on the original applicant email (the envelope
  //    message-id changes per forward); direct mail dedupes on message-id then
  //    sender. Unique (role_id, dedupe_key) backs this up against races.
  const dedupe_key = (
    (sender.forwarded ? senderEmail : mail.messageId ?? senderEmail) ?? `anon-${randomUUID()}`
  ).slice(0, 400);
  const { data: existing } = await sb
    .from("mercury_applicants")
    .select("id")
    .eq("role_id", role.id)
    .eq("dedupe_key", dedupe_key)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, applicant_id: existing.id });
  }

  // 6. ALWAYS store the raw email first — nothing is ever lost, even if parsing fails.
  const rawId = randomUUID();
  const rawPath = `${ownerId}/${role.id}/${rawId}.json`;
  const rawPayload = JSON.stringify(
    {
      to: mail.to,
      from: mail.from,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      messageId: mail.messageId,
      attachments: mail.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType })),
      received_at: new Date().toISOString(),
    },
    null,
    2
  );
  const rawUpload = await uploadPrivate(RAW_BUCKET, rawPath, rawPayload, "application/json");
  const raw_email_path = rawUpload.ok ? rawPath : null;
  if (!rawUpload.ok) console.error("[inbound] raw email upload failed", rawUpload.error);

  // 7. Store the CV attachment + parse it. Failure → needs_review, never a drop.
  let cv_file_path: string | null = null;
  let needs_review = false;
  let parsed = { years_exp: null as number | null, skills: [] as string[], current_role: null as string | null, location: null as string | null };

  const cv = pickCvAttachment(mail.attachments);
  if (cv) {
    const safeName = sanitizeStorageFileName(cv.filename);
    const cvPath = `${ownerId}/${role.id}/${rawId}-${safeName}`;
    const up = await uploadPrivate(CV_BUCKET, cvPath, cv.data, cv.contentType ?? "application/octet-stream");
    if (up.ok) cv_file_path = cvPath;
    else {
      console.error("[inbound] cv upload failed", up.error);
      needs_review = true;
    }

    const extracted = await extractText(cv.data, cv.filename, cv.contentType);
    if (extracted.ok) {
      parsed = parseCvText(extracted.text, role.required_skills ?? []);
    } else {
      needs_review = true; // couldn't read the CV — flag for a human, keep the card
    }
  } else {
    // No CV attachment: still create the card. Parse the email body for skills so
    // the card isn't empty, and flag for review.
    needs_review = true;
    if (mail.text || mail.html) {
      parsed = parseCvText(mail.text ?? mail.html ?? "", role.required_skills ?? []);
    }
  }

  // If a CV was present but yielded no usable facts at all, still flag review.
  if (cv && !needs_review && !parsed.years_exp && parsed.skills.length === 0 && !parsed.current_role) {
    needs_review = true;
  }

  // 8. Detect whether this is the owner's first-ever ingest (funnel signal).
  const { count: priorCount } = await sb
    .from("mercury_applicants")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);

  // 9. Create the applicant card via the shared service (dedupe + race-safe).
  let created;
  try {
    created = await createApplicant(sb, {
      ownerId,
      roleId: role.id,
      name: senderName,
      email: senderEmail,
      parsed,
      cv_file_path,
      raw_email_path,
      needs_review,
      dedupe_key,
      source,
    });
  } catch (err) {
    console.error("[inbound] applicant insert failed", err);
    return NextResponse.json({ error: "Could not record applicant" }, { status: 500 });
  }
  if (created.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true, applicant_id: created.id });
  }

  captureServerEvent(FUNNEL.APPLICANT_INGESTED, ownerId, {
    role_id: role.id,
    applicant_id: created.id,
    source,
    needs_review,
  });
  if ((priorCount ?? 0) === 0) {
    captureServerEvent(FUNNEL.FIRST_INGEST, ownerId, { role_id: role.id });
  }

  return NextResponse.json({ ok: true, applicant_id: created.id, needs_review });
}
