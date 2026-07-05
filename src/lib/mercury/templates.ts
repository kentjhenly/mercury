import type { MercuryStage } from "@/lib/supabase/types";

export type ResponseType =
  | "invite-to-interview"
  | "request-info"
  | "keep-warm"
  | "polite-decline"
  | "custom";

export interface TemplateContext {
  applicantName: string | null;
  roleTitle: string;
  companyName: string | null;
}

export interface RenderedTemplate {
  subject: string;
  body: string;
  /** Stage this response implies the applicant should move to (if any). */
  advanceTo?: MercuryStage;
}

const TEMPLATE_META: Record<Exclude<ResponseType, "custom">, { label: string; advanceTo?: MercuryStage }> = {
  "invite-to-interview": { label: "Invite to interview", advanceTo: "interviewing" },
  "request-info": { label: "Request more info", advanceTo: "contacted" },
  // "Keep warm" is a reassurance note — it never moves the applicant on its own.
  "keep-warm": { label: "Keep warm" },
  "polite-decline": { label: "Polite decline", advanceTo: "declined" },
};

export const RESPONSE_TYPES = Object.keys(TEMPLATE_META) as Exclude<ResponseType, "custom">[];

export function responseLabel(type: ResponseType): string {
  return type === "custom" ? "Custom message" : TEMPLATE_META[type].label;
}

/** The stage a response type implies advancing to, or null (custom). */
export function advanceStageForType(type: ResponseType): MercuryStage | null {
  return type === "custom" ? null : TEMPLATE_META[type].advanceTo ?? null;
}

/**
 * Produce an editable starting draft for a response. The employer always reviews
 * and edits before send — these are scaffolds, not auto-sent text.
 */
export function renderTemplate(type: ResponseType, ctx: TemplateContext): RenderedTemplate {
  const name = ctx.applicantName?.trim() || "there";
  const from = ctx.companyName?.trim() || "the hiring team";
  const role = ctx.roleTitle;

  switch (type) {
    case "invite-to-interview":
      return {
        subject: `Interview for ${role}`,
        advanceTo: TEMPLATE_META[type].advanceTo,
        body:
          `Hi ${name},\n\n` +
          `Thank you for applying for the ${role} role. We'd like to invite you to an interview to learn more about your experience.\n\n` +
          `Could you share a few times that work for you over the next week?\n\n` +
          `Best regards,\n${from}`,
      };
    case "request-info":
      return {
        subject: `Your application for ${role}`,
        advanceTo: TEMPLATE_META[type].advanceTo,
        body:
          `Hi ${name},\n\n` +
          `Thanks for applying for the ${role} role. To move your application forward, could you share a little more detail on your relevant experience?\n\n` +
          `Looking forward to hearing from you.\n\n` +
          `Best regards,\n${from}`,
      };
    case "keep-warm":
      return {
        subject: `Your application for ${role}`,
        body:
          `Hi ${name},\n\n` +
          `Just a quick note to let you know your application for the ${role} role is still under consideration. We haven't made a decision yet, and didn't want to leave you waiting without an update.\n\n` +
          `We'll be in touch as soon as we have news.\n\n` +
          `Best regards,\n${from}`,
      };
    case "polite-decline":
      return {
        subject: `Update on your application for ${role}`,
        advanceTo: TEMPLATE_META[type].advanceTo,
        body:
          `Hi ${name},\n\n` +
          `Thank you for taking the time to apply for the ${role} role and for your interest. After careful consideration, we won't be moving forward with your application at this time.\n\n` +
          `We genuinely appreciate the effort you put in, and we wish you the very best in your search.\n\n` +
          `Kind regards,\n${from}`,
      };
    case "custom":
    default:
      return {
        subject: `Regarding your application for ${role}`,
        body: `Hi ${name},\n\n\n\nBest regards,\n${from}`,
      };
  }
}

export interface OfferLetterContext {
  candidateName: string | null;
  roleTitle: string;
  companyName: string | null;
  /** Pre-formatted salary line (e.g. "HK$42,000 / month"), or null to omit. */
  salaryLine: string | null;
  /** Human date for the letter header, e.g. "4 July 2026". */
  dateLine: string;
}

/**
 * A plain, editable offer-letter DRAFT — rendered client-side for copy/download
 * after a hire. Deliberately templated with bracketed placeholders the employer
 * fills in; it's a convenience scaffold, never an auto-sent or binding document.
 */
export function renderOfferLetter(ctx: OfferLetterContext): string {
  const name = ctx.candidateName?.trim() || "[Candidate name]";
  const company = ctx.companyName?.trim() || "[Company name]";
  const salaryLine = ctx.salaryLine
    ? `Your agreed compensation is ${ctx.salaryLine}.`
    : "Your compensation is [amount] per [period].";

  return [
    company,
    ctx.dateLine,
    "",
    `Dear ${name},`,
    "",
    `We are delighted to offer you the position of ${ctx.roleTitle} at ${company}.`,
    "",
    salaryLine,
    "Your anticipated start date is [start date].",
    "",
    "[Add any further terms here — probation period, working hours, benefits, and any conditions of employment.]",
    "",
    "We're excited to have you join the team. To accept, please reply to this letter or sign and return a copy.",
    "",
    "Warm regards,",
    company,
  ].join("\n");
}
