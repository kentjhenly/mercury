// Hand-maintained database types for the Supabase JS client. Covers the Mercury
// tables the app reads/writes through the service client. Auth tables are owned
// by Better Auth (queried via pg), so they're not modeled here.

export type MercuryStage =
  | "new"
  | "reviewing"
  | "shortlisted"
  | "contacted"
  | "interviewing"
  | "hired"
  | "declined";

export interface MercuryRole {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  required_skills: string[];
  location: string | null;
  experience_target: number | null;
  ingest_token: string;
  status: "open" | "closed";
  // Which market's salary data this role uses. Nullable; reads default to 'hk'
  // via getMetro(). Only 'hk' exists today — the column makes multi-local a data
  // change, not a schema change.
  metro_id: string | null;
  created_at: string;
}

export interface MercuryApplicant {
  id: string;
  role_id: string;
  owner_id: string;
  name: string | null;
  email: string | null;
  parsed_years_exp: number | null;
  parsed_skills: string[];
  parsed_current_role: string | null;
  parsed_location: string | null;
  cv_file_path: string | null;
  raw_email_path: string | null;
  stage: MercuryStage;
  response_owed: boolean;
  needs_review: boolean;
  // Agreed monthly HKD, optionally recorded by the employer on hire. Private;
  // a real HK offer data point that sharpens the bundled market estimates.
  hired_salary_hkd: number | null;
  dedupe_key: string;
  source: "email" | "forward" | "csv";
  created_at: string;
  updated_at: string;
}

export interface MercuryForwardVerification {
  id: string;
  owner_id: string;
  role_id: string;
  provider: string | null;
  code: string | null;
  confirm_url: string | null;
  resolved: boolean;
  received_at: string;
}

export interface MercuryResponse {
  id: string;
  applicant_id: string;
  owner_id: string;
  type: string;
  subject: string;
  body_snapshot: string;
  sent_at: string;
}

export interface MercuryEmployer {
  id: string;
  company_name: string | null;
  reply_to: string | null;
  created_at: string;
}

export interface MercuryPayFeedback {
  id: string;
  owner_id: string;
  would_pay: boolean | null;
  amount_hkd: number | null;
  comment: string | null;
  created_at: string;
}

// Daily snapshot of an employer's response reliability. About the employer's
// professionalism over time, never a candidate.
export interface MercuryResponseStats {
  id: string;
  owner_id: string;
  snapshot_date: string;
  engaged: number;
  responded: number;
  rate_pct: number | null;
  median_first_response_hours: number | null;
  created_at: string;
}

// A correction on a shown salary band. Not a judgement of a candidate — feedback
// on the *market data*, used to sharpen the bundled estimates over time.
export interface MercurySalaryFeedback {
  id: string;
  owner_id: string;
  role_id: string;
  family: string;
  years_used: number;
  verdict: "looks_right" | "too_low" | "too_high";
  suggested_monthly_hkd: number | null;
  created_at: string;
}
