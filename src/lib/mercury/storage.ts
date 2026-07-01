import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

// Private buckets — files are NEVER public. They're served only through
// short-lived signed URLs minted server-side after an ownership check.
export const CV_BUCKET = "mercury-cvs";
export const RAW_BUCKET = "mercury-raw-emails";

/** Signed URL lifetime for CV / raw-email downloads (seconds). */
const SIGNED_URL_TTL = 120;

export async function createSignedUrl(
  bucket: typeof CV_BUCKET | typeof RAW_BUCKET,
  path: string,
  ttl: number = SIGNED_URL_TTL
): Promise<string | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data) {
    console.error("[storage.createSignedUrl]", bucket, error);
    return null;
  }
  return data.signedUrl;
}

export async function uploadPrivate(
  bucket: typeof CV_BUCKET | typeof RAW_BUCKET,
  path: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ ok: boolean; error?: unknown }> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}
