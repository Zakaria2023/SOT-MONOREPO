"use client";

import { useCompleteProfileForm } from "@/app/complete-profile/use-complete-profile-form";
import { CertificateUpload } from "@/components/auth/certificate-upload";
import { LocationPicker } from "@/components/location/location-picker";
import { cn } from "@/lib/utils";
import { ArrowRight, Building2, Hash, Mail, Phone, Receipt, User } from "lucide-react";
import { Controller } from "react-hook-form";
import { Input } from "ui";

type CompleteProfileFormProps = {
  next: string;
  firstName: string;
  lastName: string;
};

export const CompleteProfileForm = ({
  next,
  firstName,
  lastName,
}: CompleteProfileFormProps) => {
  const {
    form: {
      register,
      control,
      watch,
      setValue,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = useCompleteProfileForm({ next, firstName, lastName });

  const type = watch("type");
  const isFacility = type === "facility";

  return (
    <div className="relative w-full max-w-md rounded-3xl bg-surface p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      <div>
        <h1 className="font-heading text-3xl text-ink">Complete your profile</h1>
        <p className="font-grotesk mt-2 text-sm text-muted">
          Tell us who you are so we can match your requests with the right
          partners.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="font-grotesk mt-6 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink">Account type</span>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-search-border p-1">
            {(["individual", "facility"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setValue("type", option)}
                className={cn(
                  "rounded-lg py-2 text-sm font-semibold capitalize transition-colors",
                  type === option
                    ? "bg-primary-solid text-white"
                    : "text-muted hover:text-ink",
                )}
              >
                {option === "individual" ? "Individual" : "Facility"}
              </button>
            ))}
          </div>
        </div>

        {isFacility ? (
          <>
            <Input
              label="Unified number"
              placeholder="700xxxxxxx"
              icon={<Hash size={16} />}
              error={errors.unifiedNumber?.message}
              {...register("unifiedNumber")}
            />
            <Input
              label="CR number"
              placeholder="Commercial registration"
              icon={<Building2 size={16} />}
              error={errors.crNumber?.message}
              {...register("crNumber")}
            />
            <Input
              label="VAT number"
              placeholder="15-digit tax number"
              icon={<Receipt size={16} />}
              error={errors.vatNumber?.message}
              {...register("vatNumber")}
            />
            <Controller
              control={control}
              name="nationalAddress"
              render={({ field }) => (
                <LocationPicker
                  label="National address"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.nationalAddress?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="crCertificate"
              render={({ field }) => (
                <CertificateUpload
                  label="CR certificate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.crCertificate?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="vatCertificate"
              render={({ field }) => (
                <CertificateUpload
                  label="VAT certificate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.vatCertificate?.message}
                />
              )}
            />
            <Input
              label="Representative name"
              placeholder="Jane Doe"
              icon={<User size={16} />}
              error={errors.representativeName?.message}
              {...register("representativeName")}
            />
            <Input
              label="Representative mobile (optional)"
              type="tel"
              placeholder="+966 5X XXX XXXX"
              icon={<Phone size={16} />}
              error={errors.representativeMobile?.message}
              {...register("representativeMobile")}
            />
            <Input
              label="Representative email (optional)"
              type="email"
              placeholder="rep@company.com"
              icon={<Mail size={16} />}
              error={errors.representativeEmail?.message}
              {...register("representativeEmail")}
            />
          </>
        ) : (
          <>
            <Input
              label="First name"
              placeholder="Jane"
              icon={<User size={16} />}
              autoComplete="given-name"
              error={errors.firstName?.message}
              {...register("firstName")}
            />
            <Input
              label="Middle name"
              placeholder="(optional)"
              icon={<User size={16} />}
              autoComplete="additional-name"
              error={errors.middleName?.message}
              {...register("middleName")}
            />
            <Input
              label="Last name"
              placeholder="Doe"
              icon={<User size={16} />}
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...register("lastName")}
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
          </>
        )}

        {state.error && (
          <p className="font-grotesk text-sm text-red-500">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-solid py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save & continue"}
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
};
