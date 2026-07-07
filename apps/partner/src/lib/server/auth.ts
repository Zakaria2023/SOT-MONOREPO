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
 * Ensures the signed-in user has the partner role
 * ({ role: "partner" } in Clerk publicMetadata); otherwise redirects to the
 * unauthorized page.
 */
export const requirePartner = async () => {
  await requireAuth();
  const user = await currentUser();

  if (!user || user.publicMetadata?.role !== "partner") {
    redirect("/unauthorized");
  }

  return user;
};
