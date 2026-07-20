import { createClient } from "@supabase/supabase-js";

// Service-role client. SERVER-ONLY — never import into a Client Component.
// Bypasses RLS, so EVERY query made with it must filter by the authenticated
// employer's owner_id (see src/lib/mercury/owner.ts).
//
// Intentionally untyped (no <Database> generic): without Supabase-generated
// types, a hand-written Database degrades write (insert/update) inference to
// `never`. Reads are re-typed at the boundary in src/lib/mercury/data.ts, and
// every write body is validated by a Zod schema before it reaches here.
export function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
