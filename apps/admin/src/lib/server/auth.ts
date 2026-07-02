import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const requireAuth = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return userId;
};

export const requireAdmin = async () => {
  const userId = await requireAuth();
  const user = await currentUser();
  const role = user?.publicMetadata?.role;

  if (role !== "admin") {
    redirect("/unauthorized");
  }

  return { userId, user };
};
