import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Reset your password",
  description: "Reset the password on your SOT Solutions account.",
  path: "/forgot-password",
  noIndex: true,
});

const ForgotPasswordPage = () => (
  <AuthShell>
    <ForgotPasswordForm />
  </AuthShell>
);

export default ForgotPasswordPage;
