-- ============================================================================
-- 0002_intake.sql
-- Intake pipeline additions: provenance on applicants + a place to capture the
-- auto-forward confirmation codes that Gmail/Outlook send to a role's address.
--
-- Apply with:  node scripts/apply-migration.cjs supabase/migrations/0002_intake.sql
-- (requires DATABASE_URL in .env.local — the pooled Supabase connection string)
-- ============================================================================

-- Where an applicant card came from. 'email' = direct application to the role
-- address, 'forward' = a manually/auto-forwarded application, 'csv' = backlog
-- import. Defaults to 'email' so existing rows keep their (correct) origin.
alter table mercury_applicants
  add column if not exists source text not null default 'email'
    check (source in ('email', 'forward', 'csv'));

-- Captured email-forwarding confirmation requests. When an employer points a
-- Gmail/Outlook filter at apply+<token>@…, the provider emails a verification
-- code/link to that address. We catch it here (never as an applicant card) and
-- surface it on the role so they can finish the one-time setup.
create table if not exists mercury_forward_verifications (
  id           uuid primary key default gen_random_uuid(),
  owner_id     text not null references "user" ("id") on delete cascade,
  role_id      uuid not null references mercury_roles (id) on delete cascade,
  provider     text,                       -- 'google' | 'microsoft' | null
  code         text,                       -- numeric confirmation code, if present
  confirm_url  text,                       -- confirmation link, if present
  resolved     boolean not null default false,
  received_at  timestamptz not null default now(),
  -- One open verification per role; a re-sent code upserts onto the latest.
  unique (role_id)
);

create index if not exists mercury_forward_verifications_owner_idx
  on mercury_forward_verifications (owner_id);
create index if not exists mercury_forward_verifications_role_idx
  on mercury_forward_verifications (role_id);
