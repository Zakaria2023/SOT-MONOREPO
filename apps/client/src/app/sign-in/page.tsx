import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description:
    "Sign in to your SOT Solutions account to track orders, review offers and manage your bills of quantities.",
  path: "/sign-in",
  noIndex: true,
});

const SignInPage = () => (
  <AuthShell>
    <SignInForm />
  </AuthShell>
);

export default SignInPage;
