"use client";

import { usePartnerForm } from "@/app/partner/use-partner-form";
import { LocationPicker } from "@/components/location/location-picker";
import { PartnerScopeCard } from "@/components/partner/partner-scope-card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  Mail,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { Controller } from "react-hook-form";
import { Input, Textarea } from "ui";
import type { PartnerRequestInput } from "validators";

type IconType = ComponentType<{ size?: number; className?: string }>;

type ScopeOption = {
  value: PartnerRequestInput["serviceScope"];
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
    description: "I install and configure - routing, security, WiFi, policies.",
  },
];

const TOAST_DURATION_MS = 2800;

export const PartnerForm = () => {
  const [toastVisible, setToastVisible] = useState(false);
  const {
    form: {
      register,
      reset,
      control,
      setValue,
      watch,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = usePartnerForm();
  const scope = watch("serviceScope");

  useEffect(() => {
    if (!state.success) return;

    reset();
    // Toggle the toast from async timer callbacks (never synchronously in the
    // effect body) so a successful submit doesn't cascade renders.
    const showTimer = setTimeout(() => setToastVisible(true), 0);
    const hideTimer = setTimeout(
      () => setToastVisible(false),
      TOAST_DURATION_MS,
    );

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [reset, state]);

  return (
    <>
      <form
        onSubmit={onSubmit}
        noValidate
        className="font-grotesk mt-8 flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            label="Partner name"
            placeholder="Abdullah Al-Mutairi"
            icon={<User size={16} />}
            autoComplete="name"
            required
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <Input
            label="Company name"
            placeholder="Acme Integrators"
            icon={<Building2 size={16} />}
            autoComplete="organization"
            required
            error={errors.companyName?.message}
            {...register("companyName")}
          />
        </div>

        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          icon={<Mail size={16} />}
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />

        <Controller
          control={control}
          name="location"
          render={({ field }) => (
            <LocationPicker
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.location?.message}
            />
          )}
        />

        <Textarea
          label="About you"
          rows={3}
          className="resize-y leading-relaxed"
          placeholder="A short intro - who you are, years in the field, team size, notable projects..."
          error={errors.about?.message}
          {...register("about")}
        />
        <Textarea
          label="What you offer"
          rows={3}
          className="resize-y leading-relaxed"
          placeholder="The services and products you deliver - cabling, switching, WiFi, surveillance, support contracts..."
          error={errors.offer?.message}
          {...register("offer")}
        />
        <Textarea
          label="What makes you special"
          rows={3}
          className="resize-y leading-relaxed"
          placeholder="Why should a client pick you over another partner? Certifications, speed, coverage, guarantees..."
          error={errors.special?.message}
          {...register("special")}
        />

        <fieldset>
          <legend className="font-grotesk mb-3 block text-xs font-semibold text-ink">
            Service scope
          </legend>
          <input type="hidden" {...register("serviceScope")} />
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
                onSelect={(value) =>
                  setValue("serviceScope", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                icon={option.icon}
                title={option.title}
                description={option.description}
              />
            ))}
          </div>
          {errors.serviceScope?.message && (
            <p className="font-grotesk mt-1.5 text-xs text-red-500">
              {errors.serviceScope.message}
            </p>
          )}
        </fieldset>

        {state.error && (
          <p className="font-grotesk text-sm text-red-500">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="font-grotesk mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-[0_14px_34px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? "Submitting..." : "Submit application"}
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
