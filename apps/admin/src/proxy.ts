import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
  "/api/documents/(.*)/image",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
