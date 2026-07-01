import { parseFrom } from "@/lib/mercury/inbound";

// Forwarded mail is the messy reality of inbox-hiring intake. Two problems this
// module solves:
//
//  1. A *manually* forwarded application has From: <the employer>, not the
//     applicant — the real candidate is buried in the quoted "Forwarded message"
//     header block. If we trust the envelope From, we file the employer as the
//     candidate and reply to the wrong person. resolveOriginalSender() digs the
//     original sender out of the body when the message looks forwarded, and
//     otherwise falls back to the envelope From (direct applications and Gmail
//     auto-forward, which preserves the original From).
//
//  2. Setting up auto-forward makes Gmail/Outlook email a confirmation code to
//     the role address. detectForwardVerification() spots those so the caller can
//     surface the code instead of creating a phantom applicant card.

export interface InboundLike {
  from: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
}

export interface ResolvedSender {
  /** True when the message looks like a manual forward we parsed through. */
  forwarded: boolean;
  name: string | null;
  email: string | null;
}

// "Fwd:" / "FW:" subject prefixes (any locale uses these two in practice).
const FWD_SUBJECT = /^\s*(fwd?|wg|tr)\s*:/i;
// Forwarded-block markers across Gmail, Apple Mail, and Outlook.
const FWD_MARKER =
  /(-{2,}\s*forwarded message\s*-{2,}|begin forwarded message:|original message)/i;
// A quoted header line carrying the original sender.
const FROM_LINE = /^\s*(?:from|von|de)\s*:\s*(.+)$/im;

/**
 * Determine the true applicant sender for an inbound message. Falls back to the
 * envelope From for direct applications and auto-forwards (which keep the
 * original From); for manual forwards, extracts the sender from the quoted
 * "Forwarded message" block.
 */
export function resolveOriginalSender(mail: InboundLike): ResolvedSender {
  const body = mail.text ?? stripHtml(mail.html) ?? "";
  const looksForwarded = FWD_SUBJECT.test(mail.subject ?? "") || FWD_MARKER.test(body);

  if (looksForwarded) {
    const original = extractForwardedFrom(body);
    // Only trust the forwarded sender if we actually found an email there —
    // otherwise fall through to the envelope so we never lose the applicant.
    if (original.email) return { forwarded: true, ...original };
  }

  return { forwarded: false, ...parseFrom(mail.from) };
}

/** Parse the first "From:" line that carries an email out of a forwarded block. */
function extractForwardedFrom(body: string): { name: string | null; email: string | null } {
  // Prefer the region after a forwarded-block marker, if present.
  const markerMatch = body.match(FWD_MARKER);
  const region = markerMatch ? body.slice(markerMatch.index ?? 0) : body;

  // Scan each "From:" line; take the first one containing an email address.
  const lines = region.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(FROM_LINE);
    if (!m) continue;
    const parsed = parseFrom(m[1]);
    if (parsed.email) return parsed;
  }
  return { name: null, email: null };
}

export interface ForwardVerification {
  isVerification: boolean;
  provider: "google" | "microsoft" | null;
  code: string | null;
  confirmUrl: string | null;
}

const GOOGLE_SENDER = /forwarding-noreply@google\.com/i;
const GOOGLE_SUBJECT = /(gmail )?forwarding confirmation/i;
const MS_SENDER = /(microsoft|outlook|office365|postmaster)/i;
const MS_SUBJECT = /forwarding/i;

/**
 * Detect a mail-forwarding confirmation request (Gmail/Outlook send these to the
 * destination address during auto-forward setup) and pull out the code + link.
 */
export function detectForwardVerification(mail: InboundLike): ForwardVerification {
  const none: ForwardVerification = { isVerification: false, provider: null, code: null, confirmUrl: null };
  const from = mail.from ?? "";
  const subject = mail.subject ?? "";
  const body = mail.text ?? stripHtml(mail.html) ?? "";

  let provider: "google" | "microsoft" | null = null;
  if (GOOGLE_SENDER.test(from) || GOOGLE_SUBJECT.test(subject)) provider = "google";
  else if (MS_SENDER.test(from) && MS_SUBJECT.test(subject) && /confirm|verif/i.test(body)) provider = "microsoft";

  if (!provider) return none;

  return {
    isVerification: true,
    provider,
    code: extractCode(subject, body),
    confirmUrl: extractConfirmUrl(body),
  };
}

function extractCode(subject: string, body: string): string | null {
  // Gmail puts the code in "(#NNNNNNNNN)" in the subject and as "Confirmation
  // code: NNNNNNNNN" in the body.
  const labelled = body.match(/confirmation code[:\s]+(\d{4,})/i);
  if (labelled) return labelled[1];
  const subjectCode = subject.match(/\(#(\d{4,})\)/);
  if (subjectCode) return subjectCode[1];
  const bareSubject = subject.match(/\b(\d{6,})\b/);
  return bareSubject?.[1] ?? null;
}

function extractConfirmUrl(body: string): string | null {
  const urls = body.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
  // Prefer a Google mail-settings confirmation link; else the first link.
  const preferred = urls.find((u) => /google\.com\/mail|mail-settings|forwarding/i.test(u));
  return preferred ?? urls[0] ?? null;
}

/** Cheap tag-strip so a Forwarded block in HTML-only mail is still scannable. */
function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}
