"use client";

import type { PostHog } from "posthog-js";

// posthog-js (~60KB) is loaded lazily after hydration so it splits into its own
// chunk instead of weighing down every page's initial bundle.
let initPromise: Promise<PostHog | null> | null = null;

export function loadPostHog(): Promise<PostHog | null> {
  if (initPromise) return initPromise;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }
  initPromise = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      capture_pageview: false,
      persistence: "localStorage",
    });
    return posthog;
  });
  return initPromise;
}

/** Fire a funnel/analytics event from the client. No-op if PostHog is unset. */
export function track(event: string, properties: Record<string, unknown> = {}) {
  void loadPostHog().then((ph) => ph?.capture(event, properties));
}

/** Associate subsequent events with the signed-in employer. */
export function identify(distinctId: string, properties: Record<string, unknown> = {}) {
  void loadPostHog().then((ph) => ph?.identify(distinctId, properties));
}
