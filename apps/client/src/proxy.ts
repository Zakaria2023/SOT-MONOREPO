import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, createNonce } from "security-headers";
import {
  checkRateLimit,
  rateLimitIdentity,
  rateLimitResponse,
} from "rate-limit";

// The storefront is public — browsing products, brands and categories never
// requires a session. This middleware only makes Clerk's `auth()` available to
// Server Components and Actions; individual pages/actions decide what to gate
// (they call getCurrentUser and handle the null case themselves). The Clerk
// webhook is skipped by the matcher below so its raw body reaches the handler.

/**
 * Applied to /api/* only, deliberately.
 *
 * Page routes are left alone because a crawler is a legitimate burst: Googlebot
 * can outpace any per-minute ceiling a human would need, and 429-ing it would
 * undo the indexing work rather than protect anything. The API is where a
 * runaway client does damage — a mobile screen once fired ~1950 requests at one
 * endpoint in seconds.
 *
 * Keyed on the Clerk user id when there is a session, IP otherwise. The user id
 * is verified here (clerkMiddleware has already run), so unlike a raw token
 * claim it cannot be swapped for a fresh budget.
 */
const isRateLimited = createRouteMatcher(["/api/(.*)"]);

/**
 * next/image fetches this one server-side to optimize a photo, so the request
 * arrives with no client IP to key on and every optimizer fetch across the whole
 * deployment would share a single bucket. A catalog page with twenty thumbnails
 * would exhaust a per-minute ceiling by itself and images would start 429-ing.
 */
const isInternalFetch = createRouteMatcher(["/api/documents/(.*)/image"]);

const enforceRateLimit = async (
  request: Request,
  userId: string | null,
): Promise<Response | null> => {
  const decision = await checkRateLimit(rateLimitIdentity(request, userId), {
    bucket: "web-api",
  });
  return decision.allowed ? null : rateLimitResponse(decision);
};

/**
 * CSP is set here rather than in next.config because the nonce has to be fresh
 * per request. Next picks the nonce out of this header and applies it to its own
 * scripts; `x-nonce` on the REQUEST is how a server component can read it to
 * stamp any inline script it writes by hand.
 */
const withCsp = (request: NextRequest): Headers => {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(
    "content-security-policy",
    buildCsp(nonce, process.env.NODE_ENV !== "production"),
  );
  return requestHeaders;
};

export default clerkMiddleware(async (auth, req) => {
  if (isRateLimited(req) && !isInternalFetch(req)) {
    const { userId } = await auth();
    const limited = await enforceRateLimit(req, userId);
    if (limited) {
      return limited;
    }
  }

  const requestHeaders = withCsp(req);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const csp = requestHeaders.get("content-security-policy");
  if (csp) {
    response.headers.set("content-security-policy", csp);
  }
  return response;
});

export const config = {
  // Everything but _next and the Clerk webhook, including paths that look like
  // files. Excluding dotted paths meant clerkMiddleware never ran on them, so
  // `auth()` threw inside the navbar and any missing URL containing a dot
  // answered 500 rather than 404 — /nope 404'd, /nope.php did not. Bots probe
  // /.env and /wp-login.php constantly, and a crawler reads sustained 5xx as a
  // broken site. The webhook stays out so its raw body reaches the handler
  // unread.
  matcher: ["/((?!_next|api/webhooks).*)"],
};
