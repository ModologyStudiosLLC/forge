import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// Optional HTTP Basic auth for the whole app. FORGE's API routes spend
// Anthropic credits and forward uploads to internal services, so any
// non-local deployment must set FORGE_BASIC_AUTH="user:password".
// Unset = open, which is only appropriate for local development.
const CREDENTIALS = process.env.FORGE_BASIC_AUTH;

if (!CREDENTIALS && process.env.NODE_ENV === "production") {
  console.warn("[forge] FORGE_BASIC_AUTH is not set — the app and its paid API routes are unauthenticated.");
}

function matches(header: string | null): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const supplied = Buffer.from(Buffer.from(header.slice(6), "base64").toString("utf8"));
  const expected = Buffer.from(CREDENTIALS!);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function proxy(request: NextRequest) {
  if (!CREDENTIALS || matches(request.headers.get("authorization"))) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FORGE", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
