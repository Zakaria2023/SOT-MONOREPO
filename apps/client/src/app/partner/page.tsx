import { PartnerForm } from "@/components/partner/partner-form";
import { PartnerPitchPanel } from "@/components/partner/partner-pitch-panel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join us as a partner · Stratum",
  description:
    "Apply to join Stratum's installer & integrator network — get matched to live deployments and quote from our catalog.",
};

const PartnerPage = () => (
  <main className="flex min-h-[calc(100dvh-4.5rem)] w-full items-stretch justify-center bg-[#F4F3F8] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
    <div className="grid w-full max-w-[1220px] grid-cols-1 overflow-hidden rounded-[28px] bg-white shadow-[0_40px_120px_-40px_rgba(20,22,27,0.45)] min-[940px]:grid-cols-[38fr_62fr]">
      <PartnerPitchPanel />

      <div className="relative flex flex-col overflow-y-auto bg-white p-8 sm:p-12 lg:p-14">
        <div>
          <h2 className="font-heading text-3xl text-ink">
            Join us as a partner
          </h2>
          <p className="font-grotesk mt-2 text-sm text-[#62656B]">
            Tell us who you are and what you deliver. Fields marked{" "}
            <span className="text-primary">*</span> are required.
          </p>
        </div>

        <PartnerForm />
      </div>
    </div>
  </main>
);

export default PartnerPage;
