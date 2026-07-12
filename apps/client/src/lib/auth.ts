import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { getUserByClerkId, type AuthUser } from "services";

/**
 * Resolves the signed-in user, or null when there is no valid session. Clerk
 * verifies the session cookie for us (via the middleware); we then map its
 * `userId` to our profile row so the rest of the app keeps working with our
 * internal `AuthUser` (and `user.uuid`) exactly as before.
 *
 * Request-scoped via React `cache` so multiple callers in one render share the
 * result.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  return getUserByClerkId(userId);
});
