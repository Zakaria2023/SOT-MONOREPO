import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../../db";
import { UserType } from "../../../db/enum";
import { InsertUsers, SelectUsers, Users } from "../../../db/schema/users";

/**
 * The signed-in user. Identity (email/phone/password/verification) is owned by
 * Clerk; this row is our profile store, kept in sync by the Clerk webhook. Both
 * transports (web Server Actions and the mobile REST API) resolve the caller to
 * one of these via their Clerk user id.
 */
export type AuthUser = SelectUsers;

/**
 * Everything the Clerk webhook mirrors into our profile row. Identity comes from
 * Clerk itself; the rest is carried in the user's Clerk `unsafeMetadata`, set on
 * the sign-up form (so a `user.created` event has all of it).
 */
export type ClerkUserSync = {
  clerkUserId: string;
  type: UserType | null;
  // Either email or phone identifies the user (never required to give both).
  email: string | null;
  phone: string | null;
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  companyName: string | null;
  location: string | null;
  image: string | null;
  // Facility fields (null for other types).
  unifiedNumber: string | null;
  crNumber: string | null;
  vatNumber: string | null;
  nationalAddress: string | null;
  crCertificate: string | null;
  vatCertificate: string | null;
  representativeName: string | null;
  representativeMobile: string | null;
  representativeEmail: string | null;
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
    // On update, only refresh identity-derived fields. Everything else is
    // app-owned after creation (type, facility fields, location) — a later
    // Clerk event must not wipe a profile the user completed in-app.
    const values = {
      email: input.email,
      phone: input.phone,
      fullName: input.fullName,
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
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
    type: input.type,
    email: input.email,
    phone: input.phone,
    fullName: input.fullName,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    companyName: input.companyName,
    location: input.location,
    image: input.image,
    unifiedNumber: input.unifiedNumber,
    crNumber: input.crNumber,
    vatNumber: input.vatNumber,
    nationalAddress: input.nationalAddress,
    crCertificate: input.crCertificate,
    vatCertificate: input.vatCertificate,
    representativeName: input.representativeName,
    representativeMobile: input.representativeMobile,
    representativeEmail: input.representativeEmail,
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

/**
 * Profile fields a user can set/complete after sign-up — the type and its
 * type-specific fields. Identity (email/phone) stays with Clerk. Derived from
 * the table so it can't drift from the schema.
 */
export type UpdateUserProfileInput = Partial<
  Pick<
    InsertUsers,
    | "type"
    | "fullName"
    | "firstName"
    | "middleName"
    | "lastName"
    | "companyName"
    | "location"
    | "unifiedNumber"
    | "crNumber"
    | "vatNumber"
    | "nationalAddress"
    | "crCertificate"
    | "vatCertificate"
    | "representativeName"
    | "representativeMobile"
    | "representativeEmail"
  >
>;

/** Updates the caller's own profile row and returns the fresh user. */
export const updateUserProfile = async (
  userUuid: string,
  input: UpdateUserProfileInput,
): Promise<AuthUser> => {
  await db.update(Users).set(input).where(eq(Users.uuid, userUuid));

  const user = await getUserByUuid(userUuid);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

/**
 * Whether a user has filled in the fields required before they can check out.
 * Depends on the account type; kept in one place so the checkout guard and the
 * profile form agree on what "complete" means.
 */
export const isProfileComplete = (user: AuthUser): boolean => {
  if (!user.type) {
    return false;
  }
  if (user.type === "facility") {
    return Boolean(
      user.unifiedNumber &&
        user.crNumber &&
        user.vatNumber &&
        user.nationalAddress &&
        user.representativeName,
    );
  }
  // Individuals and (approved) government users are complete once typed.
  return true;
};
