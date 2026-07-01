import { getResend, FROM } from "./resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Mercury metallic email chrome — deep cool-black canvas, mercury-silver accent.
function shell(body: string): string {
  return `
    <div style="font-family: ui-monospace, 'JetBrains Mono', monospace; background: #0c0e12; color: #d7dbe0; padding: 32px; max-width: 520px; border: 1px solid #23272f;">
      <p style="color: #aeb6c2; font-size: 11px; letter-spacing: 5px; margin: 0 0 20px;">M E R C U R Y</p>
      ${body}
    </div>
  `;
}

interface WelcomeEmailParams {
  to: string;
  name: string;
}

export async function sendWelcomeEmail({ to, name }: WelcomeEmailParams) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "Welcome to Mercury",
    html: shell(`
      <h2 style="color: #f2f4f7; font-size: 18px; margin: 0 0 10px; font-weight: 600;">Workspace ready</h2>
      <p style="color: #9aa3b0; font-size: 13px; line-height: 1.6; margin: 0 0 24px;">
        Welcome, <strong style="color: #e8ebef;">${escapeHtml(name)}</strong>. Create a role, and Mercury
        gives you a forwarding address. Forward your applicant emails to it and they land on a board as
        clean, uniform cards — nothing lost, no one hidden.
      </p>
      <a href="${APP_URL}/mercury" style="display: inline-block; background: linear-gradient(180deg,#e9edf2,#c2c9d2); color: #0c0e12; font-weight: 700; padding: 12px 22px; text-decoration: none; font-size: 12px; letter-spacing: 2px; border-radius: 4px;">
        OPEN MERCURY →
      </a>
    `),
  });
}

interface CandidateResponseParams {
  to: string;
  replyTo: string;
  subject: string;
  /** Plain-text body the employer wrote/edited. */
  body: string;
}

/**
 * Send a templated candidate response from the platform, with reply-to set to
 * the employer so the candidate replies straight to them. The body is the
 * employer's own text; we render it verbatim (HTML-escaped) inside the shell.
 */
export async function sendCandidateResponse({ to, replyTo, subject, body }: CandidateResponseParams) {
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br/>");
  return getResend().emails.send({
    from: FROM,
    to,
    replyTo,
    subject,
    text: body,
    html: shell(`
      <div style="color: #d7dbe0; font-size: 14px; line-height: 1.7; white-space: normal;">${htmlBody}</div>
    `),
  });
}

/** Minimal HTML escaping for values interpolated into email markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
