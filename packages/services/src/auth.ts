import {
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  verifyPassword,
} from "auth";
import { and, eq, gt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { Sessions } from "../../../db/schema/sessions";
import { InsertUsers, SelectUsers, Users } from "../../../db/schema/users";

/** A user safe to return to a caller — never includes the password hash. */
export type AuthUser = Omit<SelectUsers, "password">;

export type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type RegisterUserInput = Omit<
  InsertUsers,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type LoginUserInput = {
  email: string;
  password: string;
};

const toAuthUser = (user: SelectUsers): AuthUser => {
  const { password: _password, ...rest } = user;
  void _password;
  return rest;
};

/**
 * Issues a session for a user: generates a refresh token, stores its hash in
 * the Sessions table, and signs a short-lived access token.
 */
const createSession = async (user: SelectUsers): Promise<AuthResult> => {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await db.insert(Sessions).values({
    uuid: randomUUID(),
    userUuid: user.uuid,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt,
  });

  const accessToken = signAccessToken({ sub: user.uuid, email: user.email });

  return { user: toAuthUser(user), accessToken, refreshToken };
};

export const registerUser = async (
  input: RegisterUserInput,
): Promise<AuthResult> => {
  const existing = await db
    .select({ id: Users.id })
    .from(Users)
    .where(eq(Users.email, input.email));
  if (existing.length > 0) {
    throw new Error("An account with this email already exists");
  }

  const uuid = randomUUID();
  const password = await hashPassword(input.password);

  await db.insert(Users).values({ ...input, uuid, password });

  const [user] = await db.select().from(Users).where(eq(Users.uuid, uuid));
  if (!user) throw new Error("Failed to create user");

  return createSession(user);
};

export const loginUser = async ({
  email,
  password,
}: LoginUserInput): Promise<AuthResult> => {
  const [user] = await db.select().from(Users).where(eq(Users.email, email));
  if (!user) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, user.password);
  if (!valid) throw new Error("Invalid email or password");

  return createSession(user);
};

/**
 * Validates a refresh token against the Sessions table and rotates it: the
 * old session is deleted and a fresh access + refresh token pair is issued.
 */
export const refreshSession = async (
  refreshToken: string,
): Promise<AuthResult> => {
  const tokenHash = hashRefreshToken(refreshToken);

  const [session] = await db
    .select()
    .from(Sessions)
    .where(
      and(eq(Sessions.tokenHash, tokenHash), gt(Sessions.expiresAt, new Date())),
    );
  if (!session) throw new Error("Invalid or expired session");

  const [user] = await db
    .select()
    .from(Users)
    .where(eq(Users.uuid, session.userUuid));
  if (!user) throw new Error("Invalid or expired session");

  await db.delete(Sessions).where(eq(Sessions.id, session.id));

  return createSession(user);
};

/** Revokes a session by deleting the row matching the refresh token. */
export const logoutUser = async (refreshToken: string): Promise<void> => {
  await db
    .delete(Sessions)
    .where(eq(Sessions.tokenHash, hashRefreshToken(refreshToken)));
};
