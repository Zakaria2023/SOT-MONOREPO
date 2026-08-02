import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Create your account",
  description:
    "Create a SOT Solutions account to build a bill of quantities, request offers and order networking, infrastructure and security hardware.",
  path: "/sign-up",
  noIndex: true,
});

const SignUpPage = () => (
  <AuthShell>
    <SignUpForm />
  </AuthShell>
);

export default SignUpPage;
