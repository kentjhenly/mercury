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

// Reads are strongly typed via Row. Insert/Update use a permissive patch type so
// server code can build dynamic patch objects without fighting enum/string
// variance — validation is enforced upstream by Zod schemas, not these types.
// `Relationships: []` is required by Supabase's GenericTable shape; omitting it
// degrades the whole schema's inference to `never`.
type Patch = Record<string, unknown>;
type Table<Row> = {
  Row: Row;
  Insert: Patch;
  Update: Patch;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      mercury_employers: Table<MercuryEmployer>;
      mercury_roles: Table<MercuryRole>;
      mercury_applicants: Table<MercuryApplicant>;
      mercury_responses: Table<MercuryResponse>;
      mercury_pay_feedback: Table<MercuryPayFeedback>;
      mercury_forward_verifications: Table<MercuryForwardVerification>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      mercury_stage: MercuryStage;
    };
  };
}
