"use client";

import { TextField, TextareaField } from "@/components/partner/partner-fields";
import { PartnerScopeCard } from "@/components/partner/partner-scope-card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Mail,
  MapPin,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ComponentType, type FormEvent } from "react";

type IconType = ComponentType<{ size?: number; className?: string }>;

type ScopeOption = {
  value: string;
  icon: IconType;
  title: string;
  description: string;
};

const scopeOptions: ScopeOption[] = [
  {
    value: "installation",
    icon: Wrench,
    title: "Installation only",
    description: "I deploy, cable and mount the hardware on-site.",
  },
  {
    value: "install-program",
    icon: Cpu,
    title: "Install + program",
    description: "I install and configure — routing, security, WiFi, policies.",
  },
];

const TOAST_DURATION_MS = 2800;

export const PartnerForm = () => {
  const [scope, setScope] = useState("install-program");
  const [toastVisible, setToastVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToastVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => setToastVisible(false),
      TOAST_DURATION_MS,
    );
  };

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="partnerName"
            name="partnerName"
            label="Partner name"
            placeholder="Abdullah Al-Mutairi"
            icon={User}
            autoComplete="name"
            required
          />
          <TextField
            id="companyName"
            name="companyName"
            label="Company name"
            placeholder="Acme Integrators"
            icon={Building2}
            autoComplete="organization"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="email"
            name="email"
            label="Email"
            type="email"
            placeholder="you@company.com"
            icon={Mail}
            autoComplete="email"
            required
          />
          <TextField
            id="location"
            name="location"
            label="Location"
            placeholder="Riyadh, Saudi Arabia"
            icon={MapPin}
            autoComplete="address-level2"
          />
        </div>

        <TextareaField
          id="about"
          name="about"
          label="About you"
          placeholder="A short intro — who you are, years in the field, team size, notable projects…"
        />
        <TextareaField
          id="offer"
          name="offer"
          label="What you offer"
          placeholder="The services and products you deliver — cabling, switching, WiFi, surveillance, support contracts…"
        />
        <TextareaField
          id="special"
          name="special"
          label="What makes you special"
          placeholder="Why should a client pick you over another partner? Certifications, speed, coverage, guarantees…"
        />

        <fieldset>
          <legend className="font-grotesk mb-3 block text-xs font-semibold text-ink">
            Service scope
          </legend>
          <div
            role="radiogroup"
            aria-label="Service scope"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {scopeOptions.map((option) => (
              <PartnerScopeCard
                key={option.value}
                value={option.value}
                selected={scope === option.value}
                onSelect={setScope}
                icon={option.icon}
                title={option.title}
                description={option.description}
              />
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="font-grotesk mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-[0_14px_34px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          Submit application
          <ArrowRight size={18} />
        </button>

        <p className="font-grotesk text-center text-xs text-[#9CA0A8]">
          By applying you agree to Stratum’s{" "}
          <Link href="/partner-terms" className="text-primary">
            Partner Terms
          </Link>
          . No commitment until we both sign off.
        </p>
      </form>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed bottom-6 left-1/2 z-50 flex items-center gap-2.5 rounded-full bg-ink px-5 py-3 shadow-[0_18px_40px_-12px_rgba(20,22,27,0.55)] transition-all duration-300",
          toastVisible
            ? "-translate-x-1/2 translate-y-0 opacity-100"
            : "pointer-events-none -translate-x-1/2 translate-y-3 opacity-0",
        )}
      >
        <CheckCircle2 size={18} className="text-green-400" />
        <span className="font-grotesk text-sm font-medium text-white">
          Application received — we’ll be in touch soon
        </span>
      </div>
    </>
  );
};
