"use client";

import { usePartnerForm } from "@/app/partner/use-partner-form";
import { CertificateUpload } from "@/components/auth/certificate-upload";
import { PhoneInput } from "@/components/auth/phone-input";
import { LocationPicker } from "@/components/location/location-picker";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronRight,
  Handshake,
  Hash,
  Landmark,
  Mail,
  Receipt,
  User,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller } from "react-hook-form";
import { Input } from "ui";
import type { PartnerApplicantType } from "validators";

type TypeOption = {
  value: PartnerApplicantType;
  label: string;
  description: string;
  icon: ReactNode;
};

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: "individual",
    label: "Individual / Freelancer",
    description: "An independent installer or integrator",
    icon: <User size={20} />,
  },
  {
    value: "facility",
    label: "Private Facility",
    description: "A business with CR & VAT",
    icon: <Building2 size={20} />,
  },
  {
    value: "government",
    label: "Government",
    description: "A government entity, verified by our team",
    icon: <Landmark size={20} />,
  },
];

export const PartnerForm = () => {
  const [selected, setSelected] = useState<PartnerApplicantType | null>(null);
  const {
    form: {
      register,
      control,
      setValue,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = usePartnerForm();

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <Handshake size={24} />
        </div>
        <h2 className="font-heading text-2xl text-ink">Request received</h2>
        <p className="font-grotesk text-sm text-muted">
          Our team will review your application and email an invitation to set
          up your partner account once approved.
        </p>
      </div>
    );
  }

  if (!selected) {
    return (
      <>
        <div>
          <h1 className="font-heading text-3xl text-ink">
            Join us as a partner
          </h1>
          <p className="font-grotesk mt-2 text-sm text-muted">
            Partners are verified by our team. Pick your type, submit your
            details, and we&apos;ll email an invitation once approved.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSelected(option.value);
                setValue("type", option.value);
              }}
              className="font-grotesk flex items-center gap-3 rounded-2xl border border-search-border bg-surface p-4 text-left transition-colors hover:border-primary"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-tint text-primary">
                {option.icon}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-ink">
                  {option.label}
                </span>
                <span className="block text-xs text-faint">
                  {option.description}
                </span>
              </span>
              <ChevronRight size={18} className="text-faint" />
            </button>
          ))}
        </div>
      </>
    );
  }

  const isFacility = selected === "facility";
  const isGovernment = selected === "government";

  return (
    <>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="font-grotesk inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} />
        Change type
      </button>

      <div className="mt-4">
        <h2 className="font-heading text-2xl text-ink">
          {isFacility
            ? "Facility details"
            : isGovernment
              ? "Entity details"
              : "Your details"}
        </h2>
        <p className="font-grotesk mt-1 text-sm text-muted">
          {isFacility
            ? "Tell us about your organization."
            : isGovernment
              ? "Tell us about your entity."
              : "Tell us who you are."}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="font-grotesk mt-6 flex flex-col gap-4"
      >
        {isFacility ? (
          <>
            <Input
              label="Company name"
              placeholder="Acme Integrators"
              icon={<Building2 size={16} />}
              autoComplete="organization"
              error={errors.companyName?.message}
              {...register("companyName")}
            />
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
              autoComplete="name"
              error={errors.representativeName?.message}
              {...register("representativeName")}
            />
          </>
        ) : isGovernment ? (
          <>
            <Input
              label="Entity name"
              placeholder="Ministry of …"
              icon={<Landmark size={16} />}
              error={errors.companyName?.message}
              {...register("companyName")}
            />
            <Input
              label="Full name"
              placeholder="Jane Doe"
              icon={<User size={16} />}
              autoComplete="name"
              error={errors.fullName?.message}
              {...register("fullName")}
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
          </>
        )}

        <Input
          label={
            isFacility
              ? "Representative email"
              : isGovernment
                ? "Official email"
                : "Email"
          }
          type="email"
          placeholder={
            isGovernment ? "name@entity.gov.sa" : "you@company.com"
          }
          icon={<Mail size={16} />}
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Controller
          control={control}
          name="contactNumber"
          render={({ field }) => (
            <PhoneInput
              label="Contact number"
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
