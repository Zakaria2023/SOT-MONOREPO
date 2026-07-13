import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { getUserByClerkId, syncClerkUser, type AuthUser } from "services";

const metaString = (
  metadata: Record<string, unknown>,
  key: string,
): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * Resolves the signed-in user, or null when there is no valid session. Clerk
 * verifies the session cookie for us (via the middleware); we then map its
 * `userId` to our profile row.
 *
 * If the user is signed in but has no profile row yet — the webhook hasn't
 * landed, or a social sign-up just completed — we sync it on demand from Clerk
 * so the app never treats a signed-in user as missing. Request-scoped via React
 * `cache` so multiple callers in one render share the result.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const existing = await getUserByClerkId(userId);
  if (existing) {
    return existing;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return null;
  }

  const email =
    clerkUser.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  const phone =
    clerkUser.phoneNumbers.find(
      (entry) => entry.id === clerkUser.primaryPhoneNumberId,
    )?.phoneNumber ??
    clerkUser.phoneNumbers[0]?.phoneNumber ??
    null;

  // A user signed up with either an email or a phone — need at least one.
  if (!email && !phone) {
    return null;
  }

  const metadata = clerkUser.unsafeMetadata as Record<string, unknown>;
  const composedName = [clerkUser.firstName, clerkUser.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .trim();

  return syncClerkUser({
    clerkUserId: clerkUser.id,
    email,
    fullName:
      metaString(metadata, "fullName") ?? (composedName || "Unnamed user"),
    phone,
    companyName: metaString(metadata, "companyName"),
    location: metaString(metadata, "location"),
    image: clerkUser.imageUrl ?? null,
  });
});
