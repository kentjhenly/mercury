// Shared Route Handler helpers for consistent, non-leaky responses and
// server-side input validation.

import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { HttpError } from "@/lib/mercury/owner";

/**
 * CSRF defense-in-depth for cookie-authenticated, state-changing routes.
 * Session cookies are SameSite=Lax (so cross-site form posts don't carry them),
 * but we additionally reject any browser request whose `Origin` doesn't match
 * this deployment. Requests without an `Origin` (server-to-server, same-origin
 * GETs) are allowed through — those can't be forged cross-site via a browser.
 * Throw-based so callers just `assertSameOrigin(request)` inside their try block.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Invalid origin");
  }

  const allowed = new Set<string>();
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (host) allowed.add(host);
  if (forwardedHost) allowed.add(forwardedHost);
  for (const envUrl of [process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL]) {
    if (!envUrl) continue;
    try {
      allowed.add(new URL(envUrl).host);
    } catch {
      /* ignore malformed env */
    }
  }

  if (!allowed.has(originHost)) {
    throw new HttpError(403, "Cross-origin request blocked");
  }
}

/**
 * Generic 500 that never leaks DB/internal error detail to the client. The real
 * cause is logged server-side under `context` so it stays debuggable.
 */
export function serverError(context: string, detail?: unknown): NextResponse {
  console.error(`[${context}]`, detail);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Map a thrown HttpError to its JSON response; rethrow anything else. */
export function errorResponse(context: string, err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return serverError(context, err);
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

async function parseJsonObject(request: Request): Promise<ParseResult<Record<string, unknown>>> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }) };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }) };
  }
  return { ok: true, data: data as Record<string, unknown> };
}

/**
 * Read and validate a JSON request body against a Zod schema. Returns the
 * parsed, typed value or a ready-to-return 400. Routes never touch
 * `await request.json()` directly. `maxBytes` bounds the body up front (via
 * Content-Length) so an authenticated caller can't force a huge parse.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = 1_000_000
): Promise<ParseResult<T>> {
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request body too large" }, { status: 413 }) };
  }
  const parsed = await parseJsonObject(request);
  if (!parsed.ok) return parsed;
  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "Invalid request body";
    return { ok: false, response: NextResponse.json({ error: msg }, { status: 400 }) };
  }
  return { ok: true, data: result.data };
}
