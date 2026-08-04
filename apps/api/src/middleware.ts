import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitIdentity,
  rateLimitResponse,
} from "rate-limit";
// The shared 429 is a plain Response, and every reply out of this middleware has
// to carry the CORS headers below, so it is re-wrapped rather than returned as-is.
// Duplicating the body and the Retry-After header here instead would let the
// rejection this API sends drift from the one the other apps send.
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

export const middleware = async (request: NextRequest) => {
  // Answer the CORS preflight before it ever reaches a route handler. Not
  // counted against the limit: a preflight is the browser's doing, not the
  // caller's, and charging for it would halve every browser client's budget.
  if (request.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }));
  }

  // Keyed on IP rather than user. The session token is present in the
  // Authorization header, but its `sub` is only trustworthy after verification,
  // and a limiter keyed on an unverified claim is no limiter at all — a caller
  // would just send a new sub each request for a fresh budget. An IP costs real
  // network resources to vary. The trade-off is that everyone behind one office
  // NAT or carrier gateway shares a tally.
  const decision = await checkRateLimit(rateLimitIdentity(request), {
    bucket: "api",
  });

  if (!decision.allowed) {
    const rejection = rateLimitResponse(decision);
    return withCors(
      new NextResponse(rejection.body, {
        status: rejection.status,
        headers: rejection.headers,
      }),
    );
  }

  const response = withCors(NextResponse.next());
  // Sent on every response, not only rejections — a client can only back off
  // before it is cut off if it learns how much room is left while it still has
  // some.
  for (const [key, value] of Object.entries(rateLimitHeaders(decision))) {
    response.headers.set(key, value);
  }
  return response;
};

export const config = {
  matcher: "/api/:path*",
};
