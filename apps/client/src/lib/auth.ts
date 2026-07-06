import { cookies } from "next/headers";
import { cache } from "react";
import { getUserByUuid, verifyAccessToken, type AuthUser } from "services";

/**
 * Resolves the signed-in user from the access-token cookie, or null when there
 * is no valid session. Request-scoped via React `cache` so multiple callers in
 * one render share the result. Verification lives in the transport layer here —
 * the services never touch the token.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;

  try {
    const { sub } = verifyAccessToken(token);
    return await getUserByUuid(sub);
  } catch {
    return null;
  }
});
