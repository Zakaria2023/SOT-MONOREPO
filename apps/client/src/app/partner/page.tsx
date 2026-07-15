import { PartnerForm } from "@/components/partner/partner-form";
import { AuthShell } from "@/components/auth/auth-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join us as a partner · Stratum",
  description:
    "Apply to join Stratum's installer & integrator network — get matched to live deployments and quote from our catalog.",
};

const PartnerPage = () => (
  <AuthShell>
    <div className="relative w-full max-w-md rounded-3xl bg-surface p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      <PartnerForm />
    </div>
  </AuthShell>
);

export default PartnerPage;
