import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password · Stratum",
};

const ForgotPasswordPage = () => (
  <AuthShell>
    <ForgotPasswordForm />
  </AuthShell>
);

export default ForgotPasswordPage;
