import { randomBytes } from "crypto";

/**
 * Generate an unguessable ingest token for a role's forwarding address. 24 bytes
 * of CSPRNG entropy, URL/base32-safe (lowercase alphanumerics), so the address
 * `apply+<token>@domain` can't be enumerated.
 */
export function generateIngestToken(): string {
  // base32-ish alphabet (no padding, no ambiguous chars), ~38 chars from 24 bytes.
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = randomBytes(24);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** Build the full forwarding address for a role's token. */
export function forwardingAddress(token: string): string {
  const domain = process.env.MERCURY_INBOUND_DOMAIN ?? "apply.yourdomain.com";
  return `apply+${token}@${domain}`;
}

/**
 * Extract the ingest token from a recipient address of the form
 * `apply+<token>@domain` (case-insensitive local part). Returns null if the
 * address doesn't carry a plus-token. Accepts a raw "To" header that may contain
 * a display name and angle brackets.
 */
export function tokenFromRecipient(to: string | null | undefined): string | null {
  if (!to) return null;
  // Pull the first email-looking token out of a possibly-decorated header.
  const match = to.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/);
  const addr = (match?.[0] ?? to).toLowerCase();
  const plus = addr.match(/^apply\+([a-z2-7]+)@/);
  return plus?.[1] ?? null;
}
