-- ============================================================================
-- 0003_rls_lockdown.sql
-- Defense-in-depth: lock the public API keys out of every table.
--
-- Supabase's PostgREST exposes ALL `public` tables to the `anon` and
-- `authenticated` roles by default. Mercury never uses those keys for data
-- access — every query runs through the service-role client (which has
-- BYPASSRLS), and Better Auth talks to Postgres over a direct owner connection.
-- So we can safely slam the door on the public roles:
--
--   * Mercury data tables → ENABLE RLS with no policies (deny-all for anon /
--     authenticated). The service-role key bypasses RLS, so the app is
--     unaffected; the anon key can no longer read applicant PII.
--   * Better Auth tables  → REVOKE the PostgREST grants outright, so password
--     hashes (`account`) and session tokens (`session`) are never reachable via
--     the anon/authenticated API. The owner connection Better Auth uses does not
--     depend on these grants.
--
-- Idempotent — safe to re-run.
--
-- Apply with:  node scripts/apply-migration.cjs supabase/migrations/0003_rls_lockdown.sql
-- ============================================================================

-- ── Mercury data tables: deny-all RLS (service-role bypasses) ────────────────
alter table mercury_employers            enable row level security;
alter table mercury_roles                enable row level security;
alter table mercury_applicants           enable row level security;
alter table mercury_responses            enable row level security;
alter table mercury_pay_feedback         enable row level security;
alter table mercury_forward_verifications enable row level security;

-- Belt-and-suspenders: strip the PostgREST roles' table privileges too, so even
-- a mistakenly-added permissive policy can't expose these tables via the anon or
-- authenticated key. (service_role keeps its own grants + BYPASSRLS.)
revoke all on mercury_employers            from anon, authenticated;
revoke all on mercury_roles                from anon, authenticated;
revoke all on mercury_applicants           from anon, authenticated;
revoke all on mercury_responses            from anon, authenticated;
revoke all on mercury_pay_feedback         from anon, authenticated;
revoke all on mercury_forward_verifications from anon, authenticated;

-- ── Better Auth tables: never reachable through the public API keys ──────────
-- These hold password hashes and live session tokens. Better Auth reaches them
-- through its own owner connection (DATABASE_URL), which does not rely on these
-- grants, so revoking anon/authenticated access is transparent to auth.
revoke all on "user"         from anon, authenticated;
revoke all on "session"      from anon, authenticated;
revoke all on "account"      from anon, authenticated;
revoke all on "verification" from anon, authenticated;
