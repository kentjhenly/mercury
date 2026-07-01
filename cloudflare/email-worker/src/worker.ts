import PostalMime from "postal-mime";

// Mercury inbound-email transport.
//
// Cloudflare Email Routing delivers every apply+<token>@<domain> message here
// (configure a catch-all route → this Worker in the dashboard). The Worker parses
// the raw MIME, base64-encodes any attachments, and POSTs Mercury's canonical
// inbound JSON contract to the app's /api/mercury/inbound endpoint, authenticated
// with the shared INBOUND_SECRET.
//
// It is intentionally dumb: it does NOT resolve tokens, dedupe, or parse CVs —
// the app owns all of that. Swapping Cloudflare for another inbound provider only
// means producing the same JSON; the app is untouched.

interface Env {
  /** Shared secret, must equal the app's INBOUND_SECRET. */
  INBOUND_SECRET: string;
  /** Full URL of the app ingest route, e.g. https://app.mercury.com/api/mercury/inbound */
  MERCURY_INGEST_URL: string;
}

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly raw: ReadableStream;
  readonly headers: Headers;
  setReject(reason: string): void;
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // mirror the app's cap

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.INBOUND_SECRET || !env.MERCURY_INGEST_URL) {
      console.error("[email-worker] missing INBOUND_SECRET or MERCURY_INGEST_URL");
      return;
    }

    const parsed = await PostalMime.parse(message.raw);

    const attachments = (parsed.attachments ?? [])
      .map((a) => {
        const bytes = toUint8(a.content);
        return { filename: a.filename || "attachment", contentType: a.mimeType || null, bytes };
      })
      .filter((a) => a.bytes.byteLength > 0 && a.bytes.byteLength <= MAX_ATTACHMENT_BYTES)
      .map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        contentBase64: base64(a.bytes),
      }));

    const fromHeader = parsed.from
      ? `${parsed.from.name ? `${parsed.from.name} ` : ""}<${parsed.from.address}>`
      : message.from;

    const payload = {
      to: message.to, // the routed recipient — carries apply+<token>
      from: fromHeader,
      subject: parsed.subject ?? "",
      text: parsed.text ?? "",
      html: parsed.html ?? "",
      messageId: parsed.messageId ?? message.headers.get("message-id") ?? null,
      attachments,
    };

    const post = fetch(env.MERCURY_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-inbound-secret": env.INBOUND_SECRET,
      },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (!res.ok) console.error("[email-worker] ingest non-200", res.status);
    }).catch((err) => console.error("[email-worker] ingest failed", err));

    // Keep the Worker alive until the POST settles.
    ctx.waitUntil(post);
  },
};

function toUint8(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  // postal-mime can hand back a base64/binary string for some encodings.
  return new TextEncoder().encode(content);
}

/** Base64-encode bytes without overflowing the call stack on large attachments. */
function base64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
