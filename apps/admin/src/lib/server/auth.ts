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
export const requireAdmin = async () => {
  const userId = await requireAuth();
  const user = await currentUser();

  return { userId, user };
};
