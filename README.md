# Mercury

A lightweight, human-controlled hiring workspace.
It turns an inbox of job applications into a calm, skimmable board: forward
applicant emails to a private address, see uniform cards with parsed facts and
the original CV, sort/filter on visible facts, move cards through stages, and
send one-click templated responses. **Every applicant stays visible; ML only
organizes, never judges.**

Stack: Next.js 16 (App Router, TS) · Supabase (Postgres + Storage) · Better Auth
· Resend · PostHog · Tailwind v4.

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Env** — copy `.env.example` to `.env.local` and fill in:
   - Supabase URL + anon + **service-role** key + pooled `DATABASE_URL`
   - `BETTER_AUTH_SECRET` (32+ random chars), `BETTER_AUTH_URL`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   - `INBOUND_SECRET` (shared secret for the inbound webhook) and
     `MERCURY_INBOUND_DOMAIN` (e.g. `apply.yourdomain.com`)
   - `CRON_SECRET`, PostHog keys, `NEXT_PUBLIC_APP_URL`

3. **Migrate** — applies the schema (Better Auth tables, Mercury tables, private
   storage buckets) through the pooled connection:

   ```bash
   npm run migrate supabase/migrations/0001_mercury_init.sql
   ```

4. **Run**

   ```bash
   npm run dev
   ```

## Inbound email contract

An inbound email worker/webhook (e.g. a Cloudflare Email Worker) POSTs to
`/api/mercury/inbound` with the shared secret in the `x-inbound-secret` header
(or `Authorization: Bearer <INBOUND_SECRET>`). Recommended JSON body:

```json
{
  "to": "apply+<token>@apply.yourdomain.com",
  "from": "Jane Doe <jane@example.com>",
  "subject": "Application for Senior Engineer",
  "text": "...",
  "messageId": "<id@mail>",
  "attachments": [
    { "filename": "jane-cv.pdf", "contentType": "application/pdf", "contentBase64": "..." }
  ]
}
```

The `+<token>` in the address routes the email to the right role. Unsigned posts
are rejected; invalid tokens are dropped safely; raw email is always stored; a
failed parse still creates a `needs_review` card — an applicant is never dropped.
Deliveries are idempotent (deduped on message-id / sender per role).

## The landing page

The marketing landing is a self-contained "Mercury Landing" Design Component
served verbatim from `public/landing/` (its own runtime + dithered sphere +
statue asset). The site root `/` redirects signed-in employers to `/mercury` and
everyone else to the landing. Do not edit `public/landing/**` — it's vendored.

## Security model (carries the spec's criticals)

- Service-role key is **server-only**; the service client always pairs with an
  explicit `owner_id` filter (`src/lib/mercury/owner.ts`, `data.ts`).
- Inbound webhook verifies a constant-time secret; ingest tokens are CSPRNG.
- CV / raw email live in **private** buckets, served only via short-lived signed
  URLs after an ownership check.
- Every API body is Zod-validated; the cron route requires `CRON_SECRET`.
- Deleting a role deletes its applicants, their stored files, and responses.
- Strict CSP/security headers on the app; a scoped, looser CSP only on
  `/landing/*` (it boots its own React/Babel UMD from unpkg).

## Scope discipline

This is the MVP cut only (spec §11). No notes, AI summaries, team seats, salary,
candidate accounts, or subscription tiers — those are V2, to be built only after
a real employer validates the MVP on a live role.
