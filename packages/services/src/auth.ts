import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { InsertUsers, SelectUsers, Users } from "../../../db/schema/users";

/**
 * The signed-in user. Identity (email/phone/password/verification) is owned by
 * Clerk; this row is our profile store, kept in sync by the Clerk webhook. Both
 * transports (web Server Actions and the mobile REST API) resolve the caller to
 * one of these via their Clerk user id.
 */
export type AuthUser = SelectUsers;

/** Fields the Clerk webhook mirrors into our profile row. */
export type ClerkUserSync = {
  clerkUserId: string;
  email: string;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  location: string | null;
  image: string | null;
};

/** Looks up a user by our internal uuid. */
export const getUserByUuid = async (
  uuid: string,
): Promise<AuthUser | null> => {
  const [user] = await db.select().from(Users).where(eq(Users.uuid, uuid));
  return user ?? null;
};

/**
 * Resolves the profile row behind a Clerk user id. This is the single lookup
 * both transports use after Clerk has verified the caller (cookie session on
 * the web, Bearer session token on mobile). Returns null when no synced row
 * exists yet — e.g. the webhook hasn't landed.
 */
export const getUserByClerkId = async (
  clerkUserId: string,
): Promise<AuthUser | null> => {
  const [user] = await db
    .select()
    .from(Users)
    .where(eq(Users.clerkUserId, clerkUserId));
  return user ?? null;
};

/**
 * Upserts a profile row from a Clerk `user.created` / `user.updated` event,
 * keyed by the Clerk user id. Called only from the Clerk webhook — Clerk is the
 * source of truth for identity, this keeps our relational profile in step so the
 * rest of the app (carts, BOQs, etc.) can keep joining on `Users.uuid`.
 */
export const syncClerkUser = async (
  input: ClerkUserSync,
): Promise<AuthUser> => {
  const [existing] = await db
    .select()
    .from(Users)
    .where(eq(Users.clerkUserId, input.clerkUserId));

  if (existing) {
    const values = {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      companyName: input.companyName,
      location: input.location,
      image: input.image,
    } satisfies Partial<InsertUsers>;

    await db.update(Users).set(values).where(eq(Users.id, existing.id));

    const [updated] = await db
      .select()
      .from(Users)
      .where(eq(Users.id, existing.id));
    if (!updated) {
      throw new Error("Failed to update synced user");
    }
    return updated;
  }

  const uuid = randomUUID();
  await db.insert(Users).values({
    uuid,
    clerkUserId: input.clerkUserId,
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    companyName: input.companyName,
    location: input.location,
    image: input.image,
  });

  const [created] = await db.select().from(Users).where(eq(Users.uuid, uuid));
  if (!created) {
    throw new Error("Failed to create synced user");
  }
  return created;
};

/** Removes a profile row on a Clerk `user.deleted` event. No-op if absent. */
export const deleteClerkUser = async (clerkUserId: string): Promise<void> => {
  await db.delete(Users).where(eq(Users.clerkUserId, clerkUserId));
};
