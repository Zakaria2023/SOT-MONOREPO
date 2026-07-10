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

/** Parse a JSON request body, returning null instead of throwing on bad JSON. */
export const readBody = async (request: Request): Promise<unknown> =>
  request.json().catch(() => null);

/** Read a single field from an unknown parsed body, or undefined if absent. */
const getField = (body: unknown, key: string): unknown => {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }
  return (body as Record<string, unknown>)[key];
};

/** Read a non-empty string field from an unknown parsed body, or null. */
export const getStringField = (body: unknown, key: string): string | null => {
  const value = getField(body, key);
  return typeof value === "string" && value.length > 0 ? value : null;
};

/** Read a finite number field from an unknown parsed body, or null. */
export const getNumberField = (body: unknown, key: string): number | null => {
  const value = getField(body, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};
