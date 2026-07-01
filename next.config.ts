import type { NextConfig } from "next";

// Derive the Supabase origin so the CSP can allow API + Realtime (wss) traffic
// to it without opening up to all hosts.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseOrigin = "";
let supabaseWsOrigin = "";
try {
  if (supabaseUrl) {
    const u = new URL(supabaseUrl);
    supabaseOrigin = u.origin;
    supabaseWsOrigin = `wss://${u.host}`;
  }
} catch {
  // Invalid/empty URL — leave the CSP without an explicit Supabase entry.
}

// Content-Security-Policy. Next.js App Router injects inline bootstrap scripts
// and the app uses inline styles in places, so 'unsafe-inline' is required for
// script/style; 'unsafe-eval' is needed for the dev/Turbopack runtime. The
// hardening that matters most here is locking down object-src, base-uri,
// frame-ancestors and form-action, plus constraining connect/img sources.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "frame-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:" + (supabaseOrigin ? ` ${supabaseOrigin}` : ""),
  `connect-src 'self' https://*.posthog.com${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseWsOrigin}` : ""}`,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

// The marketing landing (/landing/*) is a self-contained Design Component that
// boots its own React 18 + Babel UMD from unpkg and pulls Google Fonts. It needs
// a looser CSP than the app. It carries no app data, so this stays isolated to
// that path; the rest of the app keeps the strict policy above.
const landingCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // Babel standalone transpiles the component class at runtime → needs unsafe-eval.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://unpkg.com",
  "upgrade-insecure-requests",
].join("; ");

const landingHeaders = [
  { key: "Content-Security-Policy", value: landingCsp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // While we're iterating on the landing, never let the browser serve a stale
  // copy — every reload must fetch the current index.html / sphere / runtime.
  { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
];

const nextConfig: NextConfig = {
  // Don't leak the framework/version to clients.
  poweredByHeader: false,
  // pdf-parse / mammoth are server-only CommonJS deps with optional native bits;
  // keep them external so the server bundle requires them at runtime instead of
  // Turbopack trying to trace/bundle their test fixtures.
  serverExternalPackages: ["pdf-parse", "mammoth"],
  async headers() {
    return [
      // Strict policy for the whole app EXCEPT the self-contained landing.
      {
        source: "/((?!landing/).*)",
        headers: securityHeaders,
      },
      // Looser, isolated policy for the static marketing landing.
      {
        source: "/landing/:path*",
        headers: landingHeaders,
      },
    ];
  },
};

export default nextConfig;
