import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** Ensures a signed-in Clerk user; otherwise redirects to sign-in. */
export const requireAuth = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return userId;
};

/**
 * Ensures the signed-in user has the pre-seller role
 * ({ role: "pre-seller" } in Clerk publicMetadata); otherwise redirects to the
 * unauthorized page.
 */
export const requirePreSeller = async () => {
  await requireAuth();
  const user = await currentUser();

  if (!user || user.publicMetadata?.role !== "pre-seller") {
    redirect("/unauthorized");
  }

  return user;
};
