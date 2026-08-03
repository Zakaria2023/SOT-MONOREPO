import { AuthShell } from "@/components/auth/auth-shell";
import { CompleteProfileForm } from "@/components/profile/complete-profile-form";
import { getCurrentUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isProfileComplete } from "services";

export const metadata: Metadata = pageMetadata({
  title: "Complete your profile",
  description: "Add the details we need before your first order.",
  path: "/complete-profile",
  noIndex: true,
});

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
      <CompleteProfileForm
        next={target}
        firstName={user.firstName ?? ""}
        lastName={user.lastName ?? ""}
      />
    </AuthShell>
  );
};

export default CompleteProfilePage;
