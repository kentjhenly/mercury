import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";

const handlers = toNextJsHandler(auth.handler);

async function handle(req: NextRequest, inner: (r: NextRequest) => Promise<Response>) {
  try {
    return await inner(req);
  } catch (e) {
    console.error("[auth] unhandled error:", e);
    return NextResponse.json(
      { message: "Authentication service error — check server logs", code: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}

export function GET(req: NextRequest) {
  return handle(req, handlers.GET);
}
export function POST(req: NextRequest) {
  return handle(req, handlers.POST);
}
