<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.2.7, App Router) has breaking changes — APIs, conventions, and
file structure may differ from older Next.js. Read the relevant guide in
`node_modules/next/dist/docs/` before writing routing/data-fetching code. Heed
deprecation notices. Route params and `cookies()`/`headers()` are async.
<!-- END:nextjs-agent-rules -->

# Mercury — non-negotiables

- **Ownership on every data path.** The service-role Supabase client bypasses
  RLS, so every read/write must filter by the authenticated employer's
  `owner_id`. Use `requireOwner()` from `src/lib/mercury/owner.ts`.
- **Service-role key is server-only.** Never import `getSupabaseServiceClient`
  into a Client Component.
- **Never drop an applicant.** Ingestion failures create a `needs_review` card,
  never a dropped row. Raw email is always stored.
- **ML organizes, never judges.** No auto-scoring/ranking-as-judgement/hiding.
  Every applicant stays visible; every filter is human-set and visible.
- **Files are private.** CV/raw-email served only via short-lived signed URLs.
