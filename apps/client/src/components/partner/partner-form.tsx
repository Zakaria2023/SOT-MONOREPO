"use client";

import { usePartnerForm } from "@/app/partner/use-partner-form";
import { CertificateUpload } from "@/components/auth/certificate-upload";
import { PhoneInput } from "@/components/auth/phone-input";
import { LocationPicker } from "@/components/location/location-picker";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  Cpu,
  Handshake,
  Hash,
  Landmark,
  Layers,
  LifeBuoy,
  Mail,
  Receipt,
  User,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller } from "react-hook-form";
import { Input } from "ui";
import type { PartnerApplicantType, PartnerCapability } from "validators";

type TypeOption = {
  value: PartnerApplicantType;
  label: string;
  description: string;
  icon: ReactNode;
};

type CapabilityOption = {
  value: PartnerCapability;
  label: string;
  description: string;
  icon: ReactNode;
};

const CAPABILITY_OPTIONS: CapabilityOption[] = [
  {
    value: "system_integrator",
    label: "System Integrator",
    description: "You design and deliver complete solutions end to end",
    icon: <Layers size={20} />,
  },
  {
    value: "stock",
    label: "Have stock",
    description: "You keep inventory and resell hardware",
    icon: <Boxes size={20} />,
  },
  {
    value: "install_program",
    label: "Install & program the network",
    description: "Install and configure the network",
    icon: <Cpu size={20} />,
  },
  {
    value: "install_only",
    label: "Install the network only",
    description: "Physical installation / cabling only",
    icon: <Wrench size={20} />,
  },
  {
    value: "pre_sell",
    label: "Pre-sell partner",
    description: "Help scope and quote solutions",
    icon: <ClipboardList size={20} />,
  },
  {
    value: "post_sell",
    label: "Post-sell partner",
    description: "Service, support and handover",
    icon: <LifeBuoy size={20} />,
  },
];

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
  const [capabilities, setCapabilities] = useState<PartnerCapability[]>([]);
  const [capsDone, setCapsDone] = useState(false);
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

  const toggleCapability = (value: PartnerCapability) => {
    setCapabilities((prev) => {
      const next = prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value];
      setValue("capabilities", next);
      return next;
    });
  };

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

  // Step 1 — what the partner can do (one or more), chosen before the type.
  if (!capsDone) {
    return (
      <>
        <div>
          <h1 className="font-heading text-3xl text-ink">
            Join us as a partner
          </h1>
          <p className="font-grotesk mt-2 text-sm text-muted">
            First, tell us what you do. Pick everything that applies — you can
            choose more than one.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {CAPABILITY_OPTIONS.map((option) => {
            const active = capabilities.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleCapability(option.value)}
                aria-pressed={active}
                className={`font-grotesk flex items-center gap-3 rounded-2xl border bg-surface p-4 text-left transition-colors ${
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "border-search-border hover:border-primary"
                }`}
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
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                    active
                      ? "border-primary bg-primary-solid text-white"
                      : "border-search-border text-transparent"
                  }`}
                >
                  <Check size={13} />
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={capabilities.length === 0}
          onClick={() => setCapsDone(true)}
          className="font-grotesk mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-solid py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-60"
        >
          Continue
          <ArrowRight size={18} />
        </button>
      </>
    );
  }

  // Step 2 — the applicant type.
  if (!selected) {
    return (
      <>
        <button
          type="button"
          onClick={() => setCapsDone(false)}
          className="font-grotesk inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          What you do
        </button>

        <div className="mt-4">
          <h1 className="font-heading text-3xl text-ink">
            Join us as a partner
          </h1>
          <p className="font-grotesk mt-2 text-sm text-muted">
            Now pick your type, submit your details, and we&apos;ll email an
            invitation once approved.
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
          className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-solid py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? "Submitting…" : "Submit request"}
          <ArrowRight size={18} />
        </button>
      </form>
    </>
  );
};
