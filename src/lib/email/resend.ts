import { Resend } from "resend";

// Lazily construct the Resend client. Its constructor throws when no API key is
// present, which would otherwise crash module evaluation during `next build`
// (page-data collection) on machines without env configured. Building the client
// on first use keeps the build green and surfaces a missing key only at send time.
let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@mercury.app";
