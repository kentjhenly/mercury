// Provider-agnostic inbound-email normalization.
//
// CANONICAL CONTRACT (recommended — a Cloudflare Email Worker / webhook POSTs
// JSON like this to /api/mercury/inbound with the shared INBOUND_SECRET):
//
//   {
//     "to":        "apply+<token>@apply.yourdomain.com",
//     "from":      "Jane Doe <jane@example.com>",
//     "subject":   "Application for Senior Engineer",
//     "text":      "...email body...",
//     "html":      "<p>...</p>",
//     "messageId": "<unique-message-id@mail>",
//     "attachments": [
//       { "filename": "jane-cv.pdf", "contentType": "application/pdf", "contentBase64": "..." }
//     ]
//   }
//
// ponytail: JSON-only. The bundled Cloudflare worker is the only producer; add a
// multipart/form-data branch here if a provider that posts inbound-parse forms
// (SendGrid, Mailgun) is ever wired up.

export interface NormalizedAttachment {
  filename: string;
  contentType: string | null;
  data: Buffer;
}

export interface NormalizedInbound {
  to: string | null;
  from: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
  attachments: NormalizedAttachment[];
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB per file — bound abuse.
const MAX_ATTACHMENTS = 10; // A real application carries a CV (+ maybe a cover letter), not dozens.
const ALLOWED_CV_EXT = /\.(pdf|docx?|txt|rtf)$/i;
const ALLOWED_CV_TYPE = /(pdf|wordprocessingml|msword|text\/plain|rtf)/i;

export async function normalizeInbound(request: Request): Promise<NormalizedInbound> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    const attachments: NormalizedAttachment[] = [];
    for (const a of rawAttachments) {
      if (attachments.length >= MAX_ATTACHMENTS) break;
      if (!a || typeof a !== "object") continue;
      const { filename, contentType: ct, contentBase64 } = a as Record<string, unknown>;
      if (typeof contentBase64 !== "string" || typeof filename !== "string") continue;
      // Bound work before decoding: base64 is ~4/3 of the decoded size.
      if (contentBase64.length > MAX_ATTACHMENT_BYTES * 1.4) continue;
      const data = Buffer.from(contentBase64, "base64");
      if (data.length === 0 || data.length > MAX_ATTACHMENT_BYTES) continue;
      attachments.push({ filename, contentType: typeof ct === "string" ? ct : null, data });
    }
    return {
      to: str(body.to),
      from: str(body.from),
      subject: str(body.subject),
      text: str(body.text),
      html: str(body.html),
      messageId: str(body.messageId) ?? str(body["message-id"]),
      attachments,
    };
  }

  throw new Error(`Unsupported inbound content-type: ${contentType}`);
}

/** Pick the attachment most likely to be a CV (pdf/docx/txt/rtf). */
export function pickCvAttachment(attachments: NormalizedAttachment[]): NormalizedAttachment | null {
  return (
    attachments.find(
      (a) => ALLOWED_CV_EXT.test(a.filename) || (a.contentType ? ALLOWED_CV_TYPE.test(a.contentType) : false)
    ) ?? null
  );
}

/** Parse "Jane Doe <jane@example.com>" → { name, email }. */
export function parseFrom(from: string | null): { name: string | null; email: string | null } {
  if (!from) return { name: null, email: null };
  const emailMatch = from.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const email = emailMatch?.[0]?.toLowerCase() ?? null;
  let name: string | null = null;
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (named) name = named[1].trim();
  else if (!email) name = from.trim() || null;
  return { name: name || null, email };
}

function str(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}
