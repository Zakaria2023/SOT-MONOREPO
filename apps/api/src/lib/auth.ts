import { NextResponse } from "next/server";
import { getUserByUuid, verifyAccessToken, type AuthUser } from "services";

/**
 * Resolve the caller from the `Authorization: Bearer <access token>` header —
 * the mobile transport's equivalent of the web client's cookie lookup. Returns
 * null when the header is missing or the token is invalid/expired.
 */
export const getUserFromRequest = async (
  request: Request,
): Promise<AuthUser | null> => {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  try {
    const { sub } = verifyAccessToken(token);
    return await getUserByUuid(sub);
  } catch {
    return null;
  }
};

/** Standard 401 response for requests without a valid access token. */
export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });
