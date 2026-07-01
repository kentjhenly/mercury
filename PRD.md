# Mercury — Product Requirements Document

**Status:** MVP build complete (2026-06-30) · **Owner:** kentjhenly · **Doc updated:** 2026-07-01

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
- Validate willingness-to-pay with an in-product prompt.

### Non-goals
- No automated scoring, ranking-as-judgement, or hiding of applicants — ever.
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
- Cards show parsed facts and link to the original CV (private, signed URL).
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

### 6.8 Auth & workspace
- Better Auth email/password sign-in; one employer workspace per user.
- Sign-in, sign-up, privacy, and terms pages exist.

### 6.9 Marketing landing
- Root `/` redirects signed-in users to `/mercury`, everyone else to a vendored
  marketing landing served verbatim from `public/landing/`.

## 7. Non-functional requirements

- **Security / privacy:**
  - Ownership filter enforced on every data path (service-role client bypasses
    RLS; `requireOwnerId()` is the single chokepoint).
  - CVs and raw emails in **private** buckets, served only via short-lived
    signed URLs.
  - Inbound endpoint is a hardened trust boundary (secret, rate limit,
    idempotency, no enumeration).
  - Service-role key is server-only.
- **Reliability:** ingestion never loses data; idempotent against re-delivery
  and races.
- **Performance:** owner-scoped composite indexes back all hot queries.
- **Aesthetic:** a calm, instrument-like UI (muted stage tones, not loud status
  colors) consistent with the landing.

## 8. Data model

| Table | Purpose |
|---|---|
| `mercury_employers` | One workspace per user (company name, reply-to). |
| `mercury_roles` | A job + its `ingest_token` (forwarding address); `open`/`closed`. |
| `mercury_applicants` | One card: parsed facts, `stage`, `response_owed`, `needs_review`, `dedupe_key`. |
| `mercury_responses` | Sent templated replies (subject/body snapshot). |
| `mercury_pay_feedback` | Would-you-pay validation signal. |
| Better Auth tables | `user`, `session`, `account`, `verification` — identity source of truth. |

Stages enum: `new · reviewing · shortlisted · contacted · interviewing · hired · declined`.

## 9. Success metrics

- **Activation:** % of new employers who reach first ingest (`FIRST_INGEST`).
- **Core loop:** applicants ingested per active role; % of applicants that reach
  a sent response.
- **Ghost rate:** applicants left `response_owed` beyond N days (lower is better).
- **Validation:** would-you-pay conversion and stated HKD amounts.

## 10. Tech stack

Next.js 16 (App Router, TS) · Supabase (Postgres + Storage) · Better Auth ·
Resend · PostHog · Tailwind v4. See [CLAUDE.md](CLAUDE.md) for architecture
invariants and setup.

## 11. Status & what's left

- **Done:** full MVP build; `npm run build` + `eslint` clean.
- **Not yet runnable:** needs a Supabase project, `.env.local`, the migration
  applied, and an inbound email worker wired to `/api/mercury/inbound`.

## 12. Open questions / future

- Which inbound-email provider (Resend Inbound, Postmark, Cloudflare Email
  Workers) hosts the production worker?
- Bulk CSV import path exists (`/api/mercury/roles/[roleId]/import`) — confirm
  its role in onboarding vs. email-only.
- Pricing model once validation signal is in.
