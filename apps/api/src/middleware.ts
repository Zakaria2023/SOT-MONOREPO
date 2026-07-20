import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This API is consumed by the mobile app. On native there is no CORS, but when
// the app runs on Expo web (or any browser client) every request is subject to
// the browser's same-origin policy, so responses must carry CORS headers or the
// browser blocks them — the request still returns 200 but the body is never
// exposed to the caller. Auth is a Clerk session token sent in the
// `Authorization` header (not a cookie), so a wildcard origin is safe: CORS is
// not the security boundary here, the Bearer token is.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const withCors = (response: NextResponse): NextResponse => {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
};

export const middleware = (request: NextRequest) => {
  // Answer the CORS preflight before it ever reaches a route handler.
  if (request.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }));
  }
  return withCors(NextResponse.next());
};

export const config = {
  matcher: "/api/:path*",
};
