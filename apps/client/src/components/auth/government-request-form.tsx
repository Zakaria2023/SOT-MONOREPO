"use client";

import { PhoneInput } from "@/components/auth/phone-input";
import { LocationPicker } from "@/components/location/location-picker";
import { useGovernmentForm } from "@/app/sign-up/use-government-form";
import { ArrowRight, Building2, Mail, ShieldCheck, User } from "lucide-react";
import { Controller } from "react-hook-form";
import { Input } from "ui";

export const GovernmentRequestForm = () => {
  const {
    form: {
      register,
      control,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = useGovernmentForm();

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <ShieldCheck size={24} />
        </div>
        <h2 className="font-heading text-2xl text-ink">Request received</h2>
        <p className="font-grotesk text-sm text-muted">
          Our team will review your entity and email an invitation to set up
          your account once approved.
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <h2 className="font-heading text-2xl text-ink">Government access</h2>
        <p className="font-grotesk mt-1 text-sm text-muted">
          Government entities are verified by our team. Submit your details and
          we&apos;ll email an invitation once approved.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="font-grotesk mt-6 flex flex-col gap-4"
      >

      <Input
        label="Entity name"
        placeholder="Ministry of …"
        icon={<Building2 size={16} />}
        error={errors.entityName?.message}
        {...register("entityName")}
      />

      <Input
        label="Full name"
        placeholder="Jane Doe"
        icon={<User size={16} />}
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />

      <Input
        label="Official email"
        type="email"
        placeholder="name@entity.gov.sa"
        icon={<Mail size={16} />}
        autoComplete="email"
        error={errors.officialEmail?.message}
        {...register("officialEmail")}
      />

      <Controller
        control={control}
        name="contactNumber"
        render={({ field }) => (
          <PhoneInput
            label="Contact number (optional)"
            value={field.value ?? ""}
            onChange={field.onChange}
            error={errors.contactNumber?.message}
          />
        )}
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

      {state.error && (
        <p className="font-grotesk text-sm text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? "Submitting…" : "Submit request"}
        <ArrowRight size={18} />
      </button>
      </form>
    </>
  );
};
