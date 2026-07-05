// The validation funnel (spec §9 / Step 9). One constant per step so client and
// server emit identical event names and the PostHog funnel lines up:
//
//   signed up → created role → first ingest → moved a stage → sent a response
//   → returned / created a second role.
export const FUNNEL = {
  SIGNED_UP: "mercury_signed_up",
  CREATED_ROLE: "mercury_created_role",
  // A2 activation: the owner opens a *second* role — the clearest "this is
  // working for me" signal short of paying.
  SECOND_ROLE_CREATED: "mercury_second_role_created",
  FIRST_INGEST: "mercury_first_ingest",
  APPLICANT_INGESTED: "mercury_applicant_ingested",
  CSV_IMPORTED: "mercury_csv_imported",
  MOVED_STAGE: "mercury_moved_stage",
  SENT_RESPONSE: "mercury_sent_response",
  RETURNED_SESSION: "mercury_returned_session",
  PAY_PROMPT_ANSWERED: "mercury_pay_prompt_answered",
  SALARY_FEEDBACK_GIVEN: "mercury_salary_feedback_given",
  HIRE_RECORDED: "mercury_hire_recorded",
} as const;

export type FunnelEvent = (typeof FUNNEL)[keyof typeof FUNNEL];
