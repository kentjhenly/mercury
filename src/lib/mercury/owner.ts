import { getServerSession } from "@/lib/auth/session";

// [CRITICAL] The single chokepoint every Mercury data path goes through to learn
// "who is asking". The service-role Supabase client bypasses RLS, so the value
// returned here MUST be applied as an explicit `.eq("owner_id", ownerId)` filter
// on every read and write. There is no query without an owner.

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Resolve the authenticated employer's owner_id, or null if unauthenticated. */
export async function getOwnerId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.id ?? null;
}

/** Resolve the owner_id or throw a 401 HttpError. Use in Route Handlers. */
export async function requireOwnerId(): Promise<string> {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new HttpError(401, "Unauthorized");
  return ownerId;
}
