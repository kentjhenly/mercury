-- ============================================================================
-- 0001_mercury_init.sql
-- Mercury MVP schema: Better Auth tables + the hiring-workspace tables.
--
-- Apply with:  node scripts/apply-migration.cjs supabase/migrations/0001_mercury_init.sql
-- (requires DATABASE_URL in .env.local — the pooled Supabase connection string)
-- ============================================================================

-- ── Better Auth core tables ────────────────────────────────────────────────
-- Better Auth is the source of truth for authentication. Ids are text.
create table if not exists "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null,
  "role" text,
  "display_name" text
);

create table if not exists "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create table if not exists "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null
);

create table if not exists "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null
);

create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");

-- ── Mercury domain ──────────────────────────────────────────────────────────

-- One employer workspace per signed-in user.
create table if not exists mercury_employers (
  id           text primary key references "user" ("id") on delete cascade,
  company_name text,
  reply_to     text,            -- address candidate responses reply to (defaults to login email)
  created_at   timestamptz not null default now()
);

-- Pipeline stages. "declined" is a stage, never a delete/hide.
do $$ begin
  create type mercury_stage as enum (
    'new', 'reviewing', 'shortlisted', 'contacted', 'interviewing', 'hired', 'declined'
  );
exception when duplicate_object then null;
end $$;

create table if not exists mercury_roles (
  id                uuid primary key default gen_random_uuid(),
  owner_id          text not null references "user" ("id") on delete cascade,
  title             text not null,
  description       text,
  required_skills   text[] not null default '{}',
  location          text,
  experience_target int,                         -- target years of experience
  ingest_token      text not null unique,        -- unguessable; forms the forwarding address
  status            text not null default 'open' check (status in ('open', 'closed')),
  created_at        timestamptz not null default now()
);

create table if not exists mercury_applicants (
  id                  uuid primary key default gen_random_uuid(),
  role_id             uuid not null references mercury_roles (id) on delete cascade,
  owner_id            text not null references "user" ("id") on delete cascade,
  name                text,
  email               text,
  parsed_years_exp    int,
  parsed_skills       text[] not null default '{}',
  parsed_current_role text,
  parsed_location     text,
  cv_file_path        text,
  raw_email_path      text,
  stage               mercury_stage not null default 'new',
  response_owed       boolean not null default true,
  needs_review        boolean not null default false,
  -- Idempotency key: dedupes a re-delivered email within a role. Built from the
  -- email Message-Id when present, else the sender address. Unique per role.
  dedupe_key          text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (role_id, dedupe_key)
);

create table if not exists mercury_responses (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references mercury_applicants (id) on delete cascade,
  owner_id      text not null references "user" ("id") on delete cascade,
  type          text not null,        -- invite-to-interview | request-info | polite-decline | custom
  subject       text not null,
  body_snapshot text not null,
  sent_at       timestamptz not null default now()
);

-- One row per employer's "would you pay" answer (validation signal).
create table if not exists mercury_pay_feedback (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null references "user" ("id") on delete cascade,
  would_pay   boolean,
  amount_hkd  int,            -- monthly amount they'd pay, if given
  comment     text,
  created_at  timestamptz not null default now()
);

-- ── Hot-query indexes (CRITICAL: owner scoping baked in) ────────────────────
create index if not exists mercury_roles_owner_idx       on mercury_roles (owner_id);
create index if not exists mercury_applicants_owner_role_idx on mercury_applicants (owner_id, role_id);
create index if not exists mercury_applicants_role_stage_idx on mercury_applicants (role_id, stage);
create index if not exists mercury_applicants_owed_idx    on mercury_applicants (owner_id) where response_owed;
create index if not exists mercury_responses_applicant_idx on mercury_responses (applicant_id);
create index if not exists mercury_responses_owner_idx    on mercury_responses (owner_id);

-- ── Private storage buckets (CV + raw email) ────────────────────────────────
-- Private: served only through short-lived signed URLs from server code.
insert into storage.buckets (id, name, public)
values ('mercury-cvs', 'mercury-cvs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('mercury-raw-emails', 'mercury-raw-emails', false)
on conflict (id) do nothing;
