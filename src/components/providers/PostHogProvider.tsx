"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { loadPostHog } from "@/lib/analytics/client";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    void loadPostHog();
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    void loadPostHog().then((posthog) =>
      posthog?.capture("$pageview", { $current_url: window.location.href })
    );
  }, [pathname]);

  return <>{children}</>;
}
