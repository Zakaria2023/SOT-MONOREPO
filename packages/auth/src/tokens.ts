import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AccessTokenPayload = {
  /** The user's uuid (JWT `sub`). */
  sub: string;
  email: string;
};

/** Access token lifetime — short-lived (15 minutes). */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;

/** Refresh token lifetime — longer-lived (30 days). */
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
};

const base64url = (input: string): string =>
  Buffer.from(input).toString("base64url");

const hmac = (data: string, secret: string): string =>
  createHmac("sha256", secret).update(data).digest("base64url");

/**
 * Signs a short-lived HS256 JWT access token.
 *
 * Verification recomputes the HMAC over the header + payload rather than
 * trusting the token's `alg`, so there is no algorithm-confusion surface.
 */
export const signAccessToken = (payload: AccessTokenPayload): string => {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      sub: payload.sub,
      email: payload.email,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    }),
  );

  const data = `${header}.${body}`;
  return `${data}.${hmac(data, secret)}`;
};

/** Verifies an access token's signature and expiry, returning its payload. */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = getSecret();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed access token");

  const [header, body, signature] = parts;
  const expected = hmac(`${header}.${body}`, secret);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid access token signature");
  }

  const decoded = JSON.parse(
    Buffer.from(body, "base64url").toString(),
  ) as Record<string, unknown>;

  if (typeof decoded.exp !== "number" || decoded.exp * 1000 < Date.now()) {
    throw new Error("Access token expired");
  }
  if (typeof decoded.sub !== "string" || typeof decoded.email !== "string") {
    throw new Error("Invalid access token payload");
  }

  return { sub: decoded.sub, email: decoded.email };
};

/** Generates an opaque, high-entropy refresh token (not a JWT). */
export const generateRefreshToken = (): string =>
  randomBytes(32).toString("base64url");

/** SHA-256-style HMAC hash of a refresh token for at-rest storage. */
export const hashRefreshToken = (token: string): string =>
  createHmac("sha256", getSecret()).update(token).digest("hex");
