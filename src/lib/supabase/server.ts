import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./types";

// Anon-key, cookie-bound client for Server Components/Route Handlers that act on
// behalf of a request. Mercury authenticates with Better Auth, not Supabase
// Auth, so this client is rarely used; the service client (below) is the
// workhorse, always paired with an explicit owner_id filter.
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll called from a Server Component — safe to ignore.
          }
        },
      },
    }
  );
}

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
