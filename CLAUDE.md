# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repo. See also
[AGENTS.md](AGENTS.md) for the short list of non-negotiables — read it first.

## What Mercury is

A standalone, lightweight, **human-controlled hiring workspace**. It turns an
employer's inbox of job applications into a calm, skimmable board:

> forward applicant emails to a per-role address → uniform cards with parsed CV
> facts + the original CV → sort/filter on visible facts → move through stages →
> one-click templated responses → a "who's owed a reply" view + a
> would-you-pay validation prompt.

**Brand rule (load-bearing, not a nicety):** ML only *organizes* (CV parsing,
skill-synonym normalization). It never scores, ranks-as-judgement, or hides.
Every applicant stays visible; every filter is human-set and visible. Do not add
features that violate this, even if asked casually — flag the conflict first.

Mercury is its own product. It is **not** a phase of, or connected to, any other
project in this account.

## Stack

- **Next.js 16.2.7**, App Router, TypeScript. This is not the Next.js you may
  remember — route params and `cookies()`/`headers()` are async. Check
  `node_modules/next/dist/docs/` before writing routing/data-fetching code.
- **Supabase** — Postgres + Storage. Auth is **Better Auth** (not Supabase
  Auth); Better Auth owns the `user`/`session`/`account`/`verification` tables
  and is the source of truth for identity.
- **Resend** — outbound templated candidate responses + reminder emails.
- **PostHog** — funnel analytics (ingest → respond → would-pay).
- **Tailwind v4**, Space Grotesk + JetBrains Mono, `#06070a` canvas, silver
  gradient buttons — tuned to match the vendored landing.

## Architecture invariants (do not violate)

1. **Ownership on every data path.** The service-role Supabase client
   (`getSupabaseServiceClient`) bypasses RLS, so every read/write MUST filter by
   the authenticated employer's `owner_id`. Resolve it through
   [requireOwnerId()](src/lib/mercury/owner.ts) — it is the single chokepoint.
   There is no query without an owner.
2. **Service-role key is server-only.** Never import `getSupabaseServiceClient`
   into a Client Component. It is guarded by `server-only`.
3. **Never drop an applicant.** Ingestion always stores the raw email first, then
   creates a card. Parse/upload failures set `needs_review = true` — never a
   dropped row. See [inbound/route.ts](src/app/api/mercury/inbound/route.ts).
4. **ML organizes, never judges.** No auto-scoring, ranking-as-judgement, or
   hiding. `declined` is a *stage* (always visible), never a delete/hide.
5. **Files are private.** CVs and raw emails live in private Supabase buckets
   (`mercury-cvs`, `mercury-raw-emails`) and are served only via short-lived
   signed URLs from server code.
6. **The inbound endpoint is a trust boundary.** It verifies `INBOUND_SECRET`
   with a constant-time compare, is idempotent (unique `(role_id, dedupe_key)`),
   rate-limited per IP, and returns a bland `200 {ok:true, ignored:true}` for
   unknown tokens so it can't be used to probe which roles exist.

## The vendored landing — hands off

`public/landing/**` is a vendored Claude **Design Component**, served verbatim
(its own `support.js` runtime, `mercury-sphere.js` dot-sphere,
`statue-dithered.png`). **Never edit or lint it.** Root `/` redirects signed-in
users → `/mercury`, everyone else → the landing. A scoped, looser CSP applies to
`/landing/*` only (it loads React/Babel UMD from unpkg + Google Fonts).

## Data model (see [0001_mercury_init.sql](supabase/migrations/0001_mercury_init.sql))

- `mercury_employers` — one workspace per user (company name, reply-to).
- `mercury_roles` — a job; carries an unguessable `ingest_token` that forms the
  forwarding address. `status`: `open` | `closed`.
- `mercury_applicants` — one card. Parsed facts (`parsed_years_exp`,
  `parsed_skills`, `parsed_current_role`, `parsed_location`), `stage`,
  `response_owed`, `needs_review`, `dedupe_key`.
- `mercury_stage` enum (board order):
  `new → reviewing → shortlisted → contacted → interviewing → hired → declined`.
- `mercury_responses` — sent templated replies (snapshot of subject/body).
- `mercury_pay_feedback` — the would-you-pay validation signal.

## Commands

```bash
npm run dev       # next dev
npm run build     # next build — keep this clean
npm run lint      # eslint — keep this clean
npm run migrate supabase/migrations/0001_mercury_init.sql   # apply a migration (needs DATABASE_URL)
```

## Running locally (not yet runnable out of the box)

Needs a Supabase project, a `.env.local`, the migration applied, and an inbound
email worker POSTing normalized mail to `/api/mercury/inbound`. Required env:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooled connection string)
- `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- `INBOUND_SECRET`, `MERCURY_INBOUND_DOMAIN`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `CRON_SECRET` (protects `/api/cron/response-reminders`)
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (optional analytics)

## Conventions

- Untyped service-role client is intentional: a hand-written `Database` type
  degraded write inference to `never`. Don't "fix" it by re-adding the generic.
- Keep `npm run build` and `npm run lint` green before considering a task done.
- Match the surrounding code's comment density and idiom. `[CRITICAL]` comments
  mark security/correctness chokepoints — preserve them.
