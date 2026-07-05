-- ============================================================================
-- 0004_hired_salary.sql
-- Optional agreed-salary capture on hire. When an employer marks an applicant
-- hired they may record the agreed monthly HKD — a private, real HK
-- offer/acceptance data point that sharpens the bundled market estimates over
-- time. Optional and private; never shown to candidates, never used to score,
-- rank, or hide anyone.
--
-- Apply with:  npm run migrate supabase/migrations/0004_hired_salary.sql
-- ============================================================================

alter table mercury_applicants
  add column if not exists hired_salary_hkd int
  check (hired_salary_hkd is null or hired_salary_hkd >= 0);

comment on column mercury_applicants.hired_salary_hkd is
  'Agreed monthly salary in HKD, optionally recorded by the employer on hire. Private HK market data point.';
