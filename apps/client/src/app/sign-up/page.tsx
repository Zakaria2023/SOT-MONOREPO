import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account · Stratum",
};

const SignUpPage = () => (
  <AuthShell>
    <SignUpForm />
  </AuthShell>
);

export default SignUpPage;
