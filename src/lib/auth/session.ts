import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";

// Deduped per request via React.cache(): the layout and page of one navigation
// resolve the session once. The cookie cache in auth.ts keeps that off the DB
// in the common case.
export const getServerSession = cache(async () => {
  const reqHeaders = await headers();
  // Transient DB errors from the Supabase pooler shouldn't bounce a signed-in
  // user. Retry once against a fresh connection before giving up.
  for (let attempt = 0; ; attempt++) {
    try {
      return await auth.api.getSession({ headers: reqHeaders });
    } catch {
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      return null;
    }
  }
});

export async function requireSession() {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
