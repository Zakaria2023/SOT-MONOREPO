import { AuthShell } from "@/components/auth/auth-shell";
import { CompleteProfileForm } from "@/components/profile/complete-profile-form";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isProfileComplete } from "services";

export const metadata: Metadata = {
  title: "Complete your profile · Stratum",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

const CompleteProfilePage = async ({ searchParams }: Props) => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { next } = await searchParams;
  const target =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // Nothing to complete — send them on their way.
  if (isProfileComplete(user)) {
    redirect(target);
  }

  return (
    <AuthShell>
      <CompleteProfileForm next={target} />
    </AuthShell>
  );
};

export default CompleteProfilePage;
