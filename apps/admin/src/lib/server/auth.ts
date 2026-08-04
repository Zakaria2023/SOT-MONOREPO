import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * The role an admin session must carry, in Clerk publicMetadata.
 *
 * It already existed and was already used — clerk.ts filters staff by
 * `user.role === "admin"` to populate reviewer pickers — but nothing checked it
 * before letting somebody in.
 */
const ADMIN_ROLE = "admin";

/** Ensures a signed-in Clerk user; otherwise redirects to sign-in. */
export const requireAuth = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return userId;
};

/**
 * Ensures the caller is staff, and returns the audit actor.
 *
 * This used to check nothing beyond a session, with a comment explaining that the
 * admin app is internal-staff-only and therefore any signed-in user was fine.
 * That reasoning does not hold: one Clerk instance backs the storefront, the
 * mobile app and all three dashboards, so a customer who signs up on the
 * storefront holds a session this app accepted. They could open the dashboard,
 * read every BOQ, every partner's certificates and every cost price, and run the
 * writes — create, update, delete, approve — because those actions only asked
 * whether somebody was signed in.
 *
 * partner and pre-seller already gated on their own role. Admin was the one that
 * did not.
 *
 * Sends a wrong-role session to /no-access rather than /sign-in: it is already
 * signed in, so a sign-in screen either loops or reports "session already
 * exists", and neither says what actually happened.
 *
 * `actor` is what every catalog write stamps onto the audit trail. It is built
 * here rather than at each call site so the trail cannot end up naming the same
 * person two different ways depending on which screen they were on.
 */
export const requireAdmin = async () => {
  const userId = await requireAuth();
  const user = await currentUser();

  if (user?.publicMetadata?.role !== ADMIN_ROLE) {
    redirect("/no-access");
  }

  const name =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    // Never blank: an audit line reading "Unknown" is a signal to go and look,
    // where an empty one reads as though nobody was involved.
    "Unknown";

  return { userId, user, actor: { uuid: userId, name } };
};

/**
 * The same check for a route handler, which must answer rather than redirect.
 *
 * Returns a Response to send back, or null to carry on. 403 and not 404 here,
 * unlike the document visibility check: these endpoints are staff tools whose
 * existence is not a secret, and the caller needs to know the difference between
 * "no such thing" and "not for you".
 */
export const forbidNonAdmin = async (): Promise<Response | null> => {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  if (user?.publicMetadata?.role !== ADMIN_ROLE) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
};
