import { verifyToken } from "@clerk/backend";
import { NextResponse } from "next/server";
import {
  getPartnerPricingForClerkUser,
  getUserByClerkId,
  type AuthUser,
  type Viewer,
} from "services";

/**
 * Resolve the caller from the `Authorization: Bearer <Clerk session token>`
 * header — the mobile transport's equivalent of the web client's cookie lookup.
 * The mobile app authenticates directly with Clerk (via the Clerk Flutter SDK)
 * and sends its short-lived session token here; we verify it networklessly and
 * map the Clerk user id to our profile row. Returns null when the header is
 * missing or the token is invalid/expired.
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

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing required environment variable: CLERK_SECRET_KEY");
  }

  try {
    const { sub } = await verifyToken(token, { secretKey });
    return await getUserByClerkId(sub);
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

/**
 * Which shopper audience the caller belongs to, for attribute visibility.
 *
 * The same distinction the web client makes: an approved partner sees
 * partner-only attributes, everyone else — including an unauthenticated
 * caller — is a plain user. Not a ladder; a user never sees partner detail
 * and a partner never sees user-only detail.
 */
export const getViewerFromRequest = async (
  request: Request,
): Promise<Viewer> => {
  const user = await getUserFromRequest(request);
  if (!user?.clerkUserId) {
    return "user";
  }
  const pricing = await getPartnerPricingForClerkUser(user.clerkUserId);
  return pricing.isPartner ? "partner" : "user";
};
