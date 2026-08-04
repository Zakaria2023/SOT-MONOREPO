import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  checkRateLimit,
  rateLimitIdentity,
  rateLimitResponse,
} from "rate-limit";
import { buildCsp, createNonce } from "security-headers";

/**
 * `/api/documents/:id/image` is exempt because next/image's optimizer fetches it
 * server-side, with no session cookie to present. Protected, it answered the
 * optimizer with a 307 to /sign-in, the optimizer rejected that as an invalid
 * upstream, and every product photo in the admin rendered broken.
 *
 * This does not widen what is reachable: the storefront already serves the same
 * bytes for any document id, unauthenticated, through its own document routes.
 * That is the real gap — those routes hand over a document to anyone who knows
 * its uuid without asking whether the caller may see it, and a partner's CR/VAT
 * certificate is stored as a document too. Worth closing on its own; scoping
 * this exemption tighter buys nothing while that door is open.
 *
 * The image route only. The download route stays protected here.
 */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  // Where the role gate sends a signed-in non-admin. Public, or the gate would
  // gate its own landing page.
  "/no-access",
  "/api/documents/(.*)/image",
]);

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
 * A path whose last segment carries an extension. Middleware still runs on these
 * so `auth()` is available to whatever renders them — including the 404 page —
 * but they are not gated: a signed-out visitor has to be able to load the
 * sign-in page's own favicon and fonts.
 */
const isFileRequest = (request: Request): boolean =>
  /\.[a-zA-Z0-9]+$/.test(new URL(request.url).pathname);

/**
 * CSP is set here rather than in next.config because the nonce must be fresh per
 * request. Next reads the nonce out of this header and stamps it onto its own
 * scripts; `x-nonce` on the REQUEST lets a server component read it for anything
 * it writes inline by hand.
 */
const withCsp = (request: NextRequest): Headers => {
  const requestHeaders = new Headers(request.headers);
  const nonce = createNonce();
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(
    "content-security-policy",
    buildCsp(nonce, process.env.NODE_ENV !== "production"),
  );
  return requestHeaders;
};

const cspResponse = (request: NextRequest): NextResponse => {
  const requestHeaders = withCsp(request);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const csp = requestHeaders.get("content-security-policy");
  if (csp) {
    response.headers.set("content-security-policy", csp);
  }
  return response;
};

export default clerkMiddleware(async (auth, req) => {
  if (isRateLimited(req) && !isInternalFetch(req)) {
    const { userId } = await auth();
    const limited = await enforceRateLimit(req, userId);
    if (limited) {
      return limited;
    }
  }

  if (!isPublicRoute(req) && !isFileRequest(req)) {
    await auth.protect();
  }

  return cspResponse(req);
});

export const config = {
  // Everything but _next, including paths that look like files. Excluding dotted
  // paths meant clerkMiddleware never ran on them, so `auth()` threw inside the
  // root layout and any missing URL with a dot in it answered 500 instead of 404
  // — /nope 404'd, /nope.php did not. Bots probe /.env and /wp-login.php
  // constantly, and a crawler reads sustained 5xx as a broken site. Files are
  // matched but not gated; see isFileRequest above.
  matcher: ["/((?!_next).*)"],
};
