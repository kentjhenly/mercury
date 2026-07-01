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
// A multipart/form-data POST (e.g. an inbound-parse provider) is also accepted:
// text fields map by name, and any File parts become attachments.

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
const ALLOWED_CV_EXT = /\.(pdf|docx?|txt|rtf)$/i;
const ALLOWED_CV_TYPE = /(pdf|wordprocessingml|msword|text\/plain|rtf)/i;

export async function normalizeInbound(request: Request): Promise<NormalizedInbound> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    const attachments: NormalizedAttachment[] = [];
    for (const a of rawAttachments) {
      if (!a || typeof a !== "object") continue;
      const { filename, contentType: ct, contentBase64 } = a as Record<string, unknown>;
      if (typeof contentBase64 !== "string" || typeof filename !== "string") continue;
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

  if (contentType.includes("multipart/form-data") || contentType.includes("x-www-form-urlencoded")) {
    const form = await request.formData();
    const attachments: NormalizedAttachment[] = [];
    for (const [, value] of form.entries()) {
      if (value instanceof File && value.size > 0 && value.size <= MAX_ATTACHMENT_BYTES) {
        const data = Buffer.from(await value.arrayBuffer());
        attachments.push({ filename: value.name || "attachment", contentType: value.type || null, data });
      }
    }
    return {
      to: str(form.get("to")),
      from: str(form.get("from")),
      subject: str(form.get("subject")),
      text: str(form.get("text")),
      html: str(form.get("html")),
      messageId: str(form.get("messageId")) ?? str(form.get("Message-Id")),
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
