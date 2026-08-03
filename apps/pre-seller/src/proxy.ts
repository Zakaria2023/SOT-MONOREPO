import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  checkRateLimit,
  rateLimitIdentity,
  rateLimitResponse,
} from "rate-limit";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);


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

export default clerkMiddleware(async (auth, req) => {
  if (isRateLimited(req) && !isInternalFetch(req)) {
    const { userId } = await auth();
    const limited = await enforceRateLimit(req, userId);
    if (limited) {
      return limited;
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
