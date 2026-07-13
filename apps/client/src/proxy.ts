import { clerkMiddleware } from "@clerk/nextjs/server";

// The storefront is public — browsing products, brands and categories never
// requires a session. This middleware only makes Clerk's `auth()` available to
// Server Components and Actions; individual pages/actions decide what to gate
// (they call getCurrentUser and handle the null case themselves). The Clerk
// webhook is skipped by the matcher below so its raw body reaches the handler.
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|api/webhooks|.*\\..*).*)"],
};
