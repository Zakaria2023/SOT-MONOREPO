import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const requireAuth = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return userId;
};

// The admin app is internal-staff-only (gated by Clerk sign-in), so any
// signed-in user is allowed — the same as the rest of the dashboard. We still
// resolve the Clerk user here because callers use it (e.g. reviewer name).
//
// `actor` is what every catalog write stamps onto the audit trail. It is built
// here rather than at each call site so the trail cannot end up naming the same
// person two different ways depending on which screen they were on.
export const requireAdmin = async () => {
  const userId = await requireAuth();
  const user = await currentUser();

  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    // Never blank: an audit line reading "Unknown" is a signal to go and look,
    // where an empty one reads as though nobody was involved.
    "Unknown";

  return { userId, user, actor: { uuid: userId, name } };
};
