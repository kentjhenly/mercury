import { z } from "zod";
import { STAGES } from "@/lib/mercury/stages";

const skill = z.string().trim().min(1).max(60);

export const createRoleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(5000).optional().nullable(),
  required_skills: z.array(skill).max(40).optional().default([]),
  location: z.string().trim().max(120).optional().nullable(),
  experience_target: z.number().int().min(0).max(50).optional().nullable(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  required_skills: z.array(skill).max(40).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  experience_target: z.number().int().min(0).max(50).nullable().optional(),
});

export const updateApplicantSchema = z.object({
  stage: z.enum(STAGES as [string, ...string[]]).optional(),
  response_owed: z.boolean().optional(),
  needs_review: z.boolean().optional(),
});

export const sendResponseSchema = z.object({
  type: z.enum(["invite-to-interview", "request-info", "polite-decline", "custom"]),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Message is required").max(10000),
  advance_stage: z.boolean().optional().default(true),
});
export type SendResponseInput = z.infer<typeof sendResponseSchema>;

export const payFeedbackSchema = z.object({
  would_pay: z.boolean().nullable().optional(),
  amount_hkd: z.number().int().min(0).max(1_000_000).nullable().optional(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

// CSV backlog import commit. Mapping is column-name-per-field (validated loosely;
// only known fields are read downstream via coerceMapping). Rows are pre-parsed
// objects from the preview step; capped to bound a single import.
export const MAX_IMPORT_ROWS = 2000;

export const importCsvSchema = z.object({
  mapping: z.record(z.string(), z.string().nullable()),
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, "No rows to import")
    .max(MAX_IMPORT_ROWS, `Too many rows (max ${MAX_IMPORT_ROWS})`),
});
export type ImportCsvInput = z.infer<typeof importCsvSchema>;
