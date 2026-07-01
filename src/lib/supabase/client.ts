"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Returns a stub during build — real calls happen client-side where env vars are set.
    return createBrowserClient<Database>("https://placeholder.supabase.co", "placeholder-key");
  }

  client = createBrowserClient<Database>(url, key);
  return client;
}
