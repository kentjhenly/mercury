-- ============================================================================
-- 0006_salary_feedback.sql
-- The salary correction loop: when an employer taps "does this look right?" next
-- to a shown market band, we record their verdict (and optional expected figure).
-- This is data collection + engagement that sharpens the bundled estimates over
-- time — never a support ticket, never shown to candidates, never used to score
-- or rank anyone.
--
-- Apply with:  node scripts/apply-migration.cjs supabase/migrations/0006_salary_feedback.sql
-- ============================================================================

create table if not exists mercury_salary_feedback (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              text not null references "user" ("id") on delete cascade,
  role_id               uuid not null references mercury_roles (id) on delete cascade,
  -- Role family the estimate was for (e.g. 'software_engineer') + the years it
  -- was computed at, so a correction is attributable to a specific band.
  family                text not null,
  years_used            int not null,
  verdict               text not null check (verdict in ('looks_right', 'too_low', 'too_high')),
  -- Optional employer-supplied "what it should be" (monthly HKD).
  suggested_monthly_hkd int check (suggested_monthly_hkd is null or suggested_monthly_hkd >= 0),
  created_at            timestamptz not null default now()
);

create index if not exists mercury_salary_feedback_owner_idx
  on mercury_salary_feedback (owner_id);
create index if not exists mercury_salary_feedback_family_idx
  on mercury_salary_feedback (family);

-- Match 0003: deny-all RLS + strip PostgREST grants. The service-role client
-- (BYPASSRLS) is the only reader/writer, always owner-scoped in app code.
alter table mercury_salary_feedback enable row level security;
revoke all on mercury_salary_feedback from anon, authenticated;
