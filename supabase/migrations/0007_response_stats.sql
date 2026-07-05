-- ============================================================================
-- 0007_response_stats.sql
-- Daily per-employer response-rate snapshots. The live rate is computed on the
-- fly (see responseRate.ts); this table preserves history so cohort/funnel
-- analysis and a future "verified responder" threshold have a timeline to read.
-- A snapshot describes the *employer's* reliability — never a candidate.
--
-- Apply with:  node scripts/apply-migration.cjs supabase/migrations/0007_response_stats.sql
-- ============================================================================

create table if not exists mercury_response_stats (
  id                          uuid primary key default gen_random_uuid(),
  owner_id                    text not null references "user" ("id") on delete cascade,
  snapshot_date               date not null,
  engaged                     int not null default 0,
  responded                   int not null default 0,
  rate_pct                    int,          -- null when there's nothing engaged yet
  median_first_response_hours numeric,      -- null when no responses yet
  created_at                  timestamptz not null default now(),
  -- One snapshot per owner per day; the daily cron upserts onto it.
  unique (owner_id, snapshot_date)
);

create index if not exists mercury_response_stats_owner_idx
  on mercury_response_stats (owner_id);

-- Match 0003: deny-all RLS + strip PostgREST grants. Only the service-role
-- client (BYPASSRLS) reads/writes this, always owner-scoped in app code.
alter table mercury_response_stats enable row level security;
revoke all on mercury_response_stats from anon, authenticated;
