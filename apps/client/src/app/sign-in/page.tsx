import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · Stratum",
};

const SignInPage = () => (
  <AuthShell>
    <SignInForm />
  </AuthShell>
);

export default SignInPage;
