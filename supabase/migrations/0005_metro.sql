-- ============================================================================
-- 0005_metro.sql
-- Multi-local as a design constraint: tag each role with the market whose salary
-- data it uses. Only 'hk' exists today; the column exists so a second metro is a
-- data change, not a schema change. Nullable and defaulted to 'hk' — every read
-- resolves null → 'hk' through getMetro(), so existing rows need no backfill.
--
-- Apply with:  node scripts/apply-migration.cjs supabase/migrations/0005_metro.sql
-- ============================================================================

alter table mercury_roles
  add column if not exists metro_id text default 'hk';

comment on column mercury_roles.metro_id is
  'Market (metro) id whose bundled salary data this role uses. Null → treated as ''hk'' by the app.';
