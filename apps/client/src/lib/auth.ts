import { cookies } from "next/headers";
import { cache } from "react";
import {
  getUserByRefreshToken,
  getUserByUuid,
  verifyAccessToken,
  type AuthUser,
} from "services";

/**
 * Resolves the signed-in user from cookies, or null when there is no valid
 * session. The short-lived access token is tried first (fast, no DB round-trip
 * for the token itself); when it is missing or expired we fall back to the
 * longer-lived refresh token so the user stays signed in while idle. Verification
 * lives in the transport layer here — the services never touch the access token.
 *
 * Request-scoped via React `cache` so multiple callers in one render share the
 * result.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();

  const accessToken = store.get("access_token")?.value;
  if (accessToken) {
    try {
      const { sub } = verifyAccessToken(accessToken);
      return await getUserByUuid(sub);
    } catch {
      // Access token missing/expired — fall through to the refresh token.
    }
  }

  const refreshToken = store.get("refresh_token")?.value;
  if (!refreshToken) return null;

  return getUserByRefreshToken(refreshToken);
});
