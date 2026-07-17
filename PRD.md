# Mercury — Product Requirements Document

**Status:** MVP + Stage-A (HK salary intelligence, response-rate measurement,
activation instrumentation) complete · **Owner:** kentjhenly · **Doc updated:** 2026-07-04

---

## 1. Summary

Mercury is a standalone, lightweight, **human-controlled hiring workspace**. It
turns an employer's chaotic inbox of job applications into a calm, skimmable
board. Employers forward applicant emails to a per-role address; Mercury parses
each into a uniform card (CV facts + the original CV), and gives the employer a
board to sort, filter, stage, and respond — all under human control.

Mercury's one hard promise: **machine learning only organizes information, it
never judges people.** No candidate is scored, auto-ranked, or hidden. This is
the product's differentiator against ATS/AI-screening tools that quietly filter
applicants out.

Mercury is **Hong Kong-first and free**: it pairs the calm board with bundled,
local **HK salary context** on every role (market data, clearly labelled, never a
candidate score) and a verifiable **anti-ghosting** record (per-employer response
rate). That combination — HK specialization + genuinely free + local salary
intelligence — is the durable moat; core features carry no paywall.

## 2. Problem

Small employers and solo hiring managers receive applications as a pile of
inconsistent emails: different formats, CVs as varied attachments, no common
shape. The tools that promise to fix this (applicant tracking systems, AI
screeners) are heavyweight, expensive, and — worse — make opaque
keep/reject decisions that hide qualified people and expose the employer to
bias. There is no calm, cheap, *trustworthy* middle ground for someone hiring
for one or a few roles.

## 3. Goals & non-goals

### Goals
- Convert a role's inbound applications into uniform, skimmable cards with zero
  manual data entry.
- Never lose an applicant — every email that arrives becomes a visible card.
- Let a human sort/filter on *visible* facts and move applicants through stages.
- Make responding fast (one-click templated replies) and make "who's still owed
  a reply" impossible to forget.
- Give the employer honest **HK salary context** per role/experience level, so
  they know what a job really pays before they offer.
- Make the anti-ghosting promise **verifiable** — surface the employer's own
  response rate.
- Validate willingness-to-pay with an in-product prompt, and instrument the
  activation funnel (A1/A2/A3) so validation is readable in PostHog.

### Non-goals
- No automated scoring, ranking-as-judgement, or hiding of applicants — ever.
  Salary context is market information, never a candidate score; suppress rather
  than guess.
- No **paid** salary/LLM APIs and no candidate PII leaving the server for salary
  computation — the salary layer is bundled, local, and free.
- No paywall on core features (a "Pro conveniences" surface may be scaffolded
  flagged-off, but nothing is charged).
- No second-city data/UI, candidate accounts, marketplace/matching, or
  payments/fees yet (multi-local is a design constraint, but only HK is built).
- Not an ATS replacement, HRIS, or offer/onboarding tool.
- No job-board posting or candidate sourcing.
- Not connected to or a phase of any other product.

## 4. Users

- **Primary:** a solo hiring manager / small-business owner / startup founder
  hiring for one to a handful of roles, who currently lives in their email inbox.

## 5. Core principle — "ML organizes, never judges"

This constraint is load-bearing across the product and the codebase:

- ML/heuristics are used **only** to *organize*: parse a CV into facts, and
  normalize skill synonyms (e.g. "JS" → "JavaScript").
- ML is **never** used to score, rank as a judgement, or hide/drop an applicant.
- Every applicant remains visible at all times. `declined` is a **stage** the
  human chooses, never a delete or an automated filter.
- Every filter/sort is human-set and visible in the UI.
- **Salary context is about the market, not the person.** It's shown with a
  visible basis, suppressed when confidence is low, and never used to score,
  rank, or hide a candidate.
- **Response-rate metrics measure the employer**, framed as their own
  professionalism — never a judgement of any candidate.

## 6. Functional requirements

### 6.1 Roles
- Create a role (title, description, required skills, location, target years of
  experience).
- Each role gets an unguessable **ingest token** that forms a unique forwarding
  email address.
- Roles can be `open` or `closed`.

### 6.2 Ingestion (the core magic)
- Employer forwards applicant emails (or sets up Gmail/Outlook auto-forwarding)
  to the role's address.
- An inbound worker POSTs normalized mail to `/api/mercury/inbound`.
- The endpoint:
  - Verifies a shared `INBOUND_SECRET` (constant-time compare).
  - Is rate-limited per source IP.
  - Resolves token → role → owner; unknown tokens get a bland `200 ignored`
    (no probing which roles exist).
  - Handles **auto-forward verification** emails (Gmail/Outlook confirmation
    codes) by capturing the code for the employer — and never creating a card
    from a spoofed confirmation.
  - Resolves the **true original sender** when an email is a manual forward (the
    real candidate is in the quoted block, not the envelope From).
  - Is **idempotent**: dedupes re-delivered mail via a unique
    `(role_id, dedupe_key)` constraint.
- **Never drops an applicant:** the raw email is always stored first; parse or
  upload failures produce a `needs_review` card, never a lost row.

### 6.3 CV parsing
- Extract text from CV attachments (PDF via `pdf-parse`, DOCX via `mammoth`).
- Parse into visible facts: years of experience, skills (normalized against the
  role's required skills), current role, location.
- Missing/failed parse → card is still created and flagged `needs_review`.

### 6.4 The board
- Per-role board of uniform applicant cards.
- Cards show parsed facts, an HK salary band for the role/experience level (§6.8),
  and link to the original CV (private, signed URL).
- Human sort/filter on visible facts only.
- Move applicants across stages:
  `new → reviewing → shortlisted → contacted → interviewing → hired → declined`.

### 6.5 Responses
- One-click templated replies: invite-to-interview, request-info,
  polite-decline, or custom.
- Sent via Resend; a snapshot of the subject/body is stored per response.
- Sending marks the applicant no longer `response_owed`.

### 6.6 "Who's owed a reply"
- A dashboard view surfaces every applicant still awaiting a response
  (`response_owed = true`), so no one is ghosted.
- A cron job (`/api/cron/response-reminders`, protected by `CRON_SECRET`) nudges
  employers about outstanding replies.

### 6.7 Would-you-pay prompt
- An in-product prompt captures a willingness-to-pay signal (would pay?, monthly
  HKD amount, comment) into `mercury_pay_feedback` — the core validation metric.

### 6.8 HK salary context (metro layer)
- Every role shows a **market salary band** (p25–p75 + median) for the role
  family and experience level, from **bundled local data + a local log-linear
  (Mincer-style) regression** — no external/paid API, no applicant PII leaving
  the server.
- Market config is a data structure (`MetroConfig`), so multi-local is a *design
  constraint*, not new pipelines: `src/lib/mercury/metro/` holds the shape; only
  **Hong Kong** (`metro/hk.ts`) is built. `mercury_roles.metro_id` (nullable →
  `'hk'`) selects the market; currency/period/labels flow from the config.
- **Confidence + suppression:** each band carries `high`/`medium` confidence
  (from sample size + whether the queried years sit inside the observed range).
  Medium widens the displayed band and is labelled "rough estimate"; **low
  confidence or an unknown role family suppresses the number entirely** ("market
  estimate unavailable") — Mercury never fabricates precision.
- Every shown band carries a one-line **basis** (source + role family + years)
  and the reassurance that it's context, not a verdict.
- **Correction loop:** beside any shown band, a "does this look right?" affordance
  (looks right / too low / too high + optional expected figure) writes to
  `mercury_salary_feedback` and fires an event — data collection to sharpen the
  bundled estimates, not a support ticket.

### 6.9 Hired-salary capture + offer letter
- Moving an applicant to `hired` opens a lightweight, optional, **private**
  prompt for the agreed monthly salary (`mercury_applicants.hired_salary_hkd`) —
  a real HK offer/acceptance data point that seeds a future proprietary dataset.
  Provenance is kept separate; agreed figures are **not** auto-mixed into the
  reference data.
- After a hire, the employer can generate a plain, templated **offer-letter
  draft** (role, salary if given, start-date placeholder) rendered client-side
  for copy/download. A scaffold the employer edits and issues — never auto-sent.

### 6.10 Response-rate measurement (verifiable anti-ghosting)
- Compute, per employer, the **share of engaged applicants** (stage past `new`)
  who have received ≥1 response, plus **median time-to-first-response**, from
  data already captured (`responseRate.ts`, owner-scoped).
- Surface the employer their **own** rate as a professionalism instrument
  ("Response rate 92% · median 26h"), framed as a benefit, never a scold.
- A daily cron (`/api/cron/response-stats`, `CRON_SECRET`-guarded) writes a
  per-owner snapshot to `mercury_response_stats` so history exists for cohort
  analysis and a future "verified responder" threshold.

### 6.11 Auth & workspace
- Better Auth email/password sign-in; one employer workspace per user.
- Sign-in, sign-up, privacy, and terms pages exist.

### 6.12 Marketing landing
- Root `/` redirects signed-in users to `/mercury`, everyone else to a vendored
  marketing landing served verbatim from `public/landing/`. Its three
  differentiators read employer-first — built for Hong Kong hiring · free · know
  what roles really pay — with the Mercury messenger/planet theme intact.
  (Copy-only edits to the landing are owner-authorized; no structural changes.)

## 7. Non-functional requirements

- **Security / privacy:**
  - Ownership filter enforced on every data path (service-role client bypasses
    RLS; `requireOwnerId()` is the single chokepoint).
  - CVs and raw emails in **private** buckets, served only via short-lived
    signed URLs.
  - Inbound endpoint is a hardened trust boundary (secret, rate limit,
    idempotency, no enumeration).
  - Service-role key is server-only. All Mercury tables (incl. the new
    `mercury_salary_feedback`, `mercury_response_stats`) use deny-all RLS; the
    service client bypasses it and app code is always owner-scoped.
  - Salary computation is fully local — no applicant PII leaves the server, no
    paid/external API.
  - Both crons (`response-reminders`, `response-stats`) require `CRON_SECRET`
    (constant-time compare).
- **Reliability:** ingestion never loses data; idempotent against re-delivery
  and races.
- **Performance:** owner-scoped composite indexes back all hot queries.
- **Aesthetic:** a calm, instrument-like UI (muted stage tones, not loud status
  colors) consistent with the landing.

## 8. Data model

| Table | Purpose |
|---|---|
| `mercury_employers` | One workspace per user (company name, reply-to). |
| `mercury_roles` | A job + its `ingest_token` (forwarding address); `open`/`closed`; `metro_id` (salary market, → `'hk'`). |
| `mercury_applicants` | One card: parsed facts, `stage`, `response_owed`, `needs_review`, `dedupe_key`, `hired_salary_hkd` (optional agreed salary). |
| `mercury_responses` | Sent templated replies (subject/body snapshot). |
| `mercury_pay_feedback` | Would-you-pay validation signal. |
| `mercury_salary_feedback` | Corrections on a shown market band (verdict + optional expected figure). |
| `mercury_response_stats` | Daily per-employer response-rate snapshots (history for cohort analysis). |
| Better Auth tables | `user`, `session`, `account`, `verification` — identity source of truth. |

Stages enum: `new · reviewing · shortlisted · contacted · interviewing · hired · declined`.

Salary data itself is **not** a table: it's bundled, version-controlled config in
`src/lib/mercury/metro/` (only Hong Kong built today).

## 9. Success metrics

Read straight from PostHog (all events keyed on `owner_id`; funnel table in the
[README](README.md)):

- **A1 — does anyone start?** unique users on `mercury_created_role`.
- **A2 — is it working for them?** unique users on `mercury_second_role_created`
  (an owner who opens a second role is getting value); supported by hires
  (`mercury_hire_recorded`) and responses per owner.
- **A3 — do they come back?** `mercury_returned_session` filtered to
  `days_since_signup >= 7`.
- **Activation:** % of new employers who reach first ingest (`mercury_first_ingest`).
- **Core loop:** applicants ingested per active role; % of applicants that reach
  a sent response.
- **Anti-ghosting (verifiable):** per-employer response rate + median
  time-to-first-response (daily `mercury_response_rate_snapshot`); applicants
  left `response_owed` beyond N days (lower is better).
- **Salary engagement:** `mercury_salary_feedback_given` rate and verdict mix.
- **Validation:** would-you-pay conversion and stated HKD amounts.

## 10. Tech stack

Next.js 16 (App Router, TS) · Supabase (Postgres + Storage) · Better Auth ·
Resend · PostHog · Tailwind v4. See [CLAUDE.md](CLAUDE.md) for architecture
invariants and setup.

## 11. Status & what's left

- **Done:** full MVP + Stage-A (metro/salary layer with confidence + suppression
  + correction loop, hired-salary capture + offer-letter draft, per-employer
  response-rate measurement + daily snapshot, employer-first copy, A1/A2/A3
  instrumentation). `npm run build`, `eslint`, and `vitest` (90 tests) clean.
- **Migrations:** apply `0001`–`0007` in order (each idempotent). The Stage-A
  additions are `0005_metro`, `0006_salary_feedback`, `0007_response_stats`.
- **Not yet runnable:** needs a Supabase project, `.env.local`, the migrations
  applied, and an inbound email worker wired to `/api/mercury/inbound`.

## 12. Open questions / future

- Which inbound-email provider (Resend Inbound, Postmark, Cloudflare Email
  Workers) hosts the production worker?
- Bulk CSV import path exists (`/api/mercury/roles/[roleId]/import`) — confirm
  its role in onboarding vs. email-only.
- The `response-stats` cron computes each owner's rate with two owner-scoped
  reads (O(employers) daily) — fine at MVP scale; revisit as a single grouped
  query / RPC if the employer count grows large.
- When do captured `hired_salary_hkd` points graduate into the reference dataset
  (provenance is kept separate for now)? Needs a volume + validation threshold.
- Second metro: only HK is built. Adding one is a data change (`metro/*.ts` +
  `metro_id`) — decide the trigger and the source data.
- Pricing model once validation signal is in (core stays free).
