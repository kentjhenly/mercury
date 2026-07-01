// Shared Route Handler helpers for consistent, non-leaky responses and
// server-side input validation.

import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { HttpError } from "@/lib/mercury/owner";

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
 * `await request.json()` directly.
 */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<ParseResult<T>> {
  const parsed = await parseJsonObject(request);
  if (!parsed.ok) return parsed;
  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "Invalid request body";
    return { ok: false, response: NextResponse.json({ error: msg }, { status: 400 }) };
  }
  return { ok: true, data: result.data };
}
