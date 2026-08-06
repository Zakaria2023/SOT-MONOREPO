"use client";

import { useSignUpForm } from "@/app/sign-up/use-sign-up-form";
import { CertificateUpload } from "@/components/auth/certificate-upload";
import { PhoneInput } from "@/components/auth/phone-input";
import { SocialButtons } from "@/components/auth/social-buttons";
import { LocationPicker } from "@/components/location/location-picker";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Lock,
  Mail,
  Receipt,
  User,
} from "lucide-react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Input } from "ui";
import type { SignUpAccountType } from "validators";

type AccountSignUpFormProps = {
  type: SignUpAccountType;
};

const SUBMIT_CLASSES =
  "font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-solid py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-60";

export const AccountSignUpForm = ({ type }: AccountSignUpFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    form: {
      register,
      control,
      watch,
      setValue,
      formState: { errors },
    },
    step,
    state,
    isPending,
    onSubmitDetails,
    code,
    setCode,
    onVerify,
    resend,
    verifyMethod,
    contact,
  } = useSignUpForm(type);

  const method = watch("method");
  const isFacility = type === "facility";
  const emailField = isFacility ? "representativeEmail" : "email";
  const phoneField = isFacility ? "representativeMobile" : "phone";
  const emailLabel = isFacility ? "Representative email" : "Work email";

  if (step === "verify") {
    return (
      <>
        <div>
          <h1 className="font-heading text-3xl text-ink">Verify it&apos;s you</h1>
          <p className="font-grotesk mt-2 text-sm text-muted">
            We sent a code to <span className="font-bold text-ink">{contact}</span>.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onVerify();
          }}
          noValidate
          className="font-grotesk mt-6 flex flex-col gap-4"
        >
          <Input
            label={verifyMethod === "email" ? "Email code" : "Phone code"}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            icon={<KeyRound size={16} />}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />

          {state.error && (
            <p className="font-grotesk text-sm text-red-500">{state.error}</p>
          )}

          <button type="submit" disabled={isPending} className={SUBMIT_CLASSES}>
            {isPending ? "Verifying…" : "Verify & continue"}
            <KeyRound size={18} />
          </button>

          <button
            type="button"
            onClick={() => void resend()}
            className="font-grotesk text-sm font-bold text-primary"
          >
            Resend code
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <div>
        <h2 className="font-heading text-2xl text-ink">
          {isFacility ? "Facility details" : "Your details"}
        </h2>
        <p className="font-grotesk mt-1 text-sm text-muted">
          {isFacility
            ? "Tell us about your organization."
            : "Create your personal account."}
        </p>
      </div>

      <form
        onSubmit={onSubmitDetails}
        noValidate
        className="font-grotesk mt-6 flex flex-col gap-4"
      >
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
            autoComplete="name"
            error={errors.representativeName?.message}
            {...register("representativeName")}
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

      {/* One identifier so Clerk sends a single verification code. */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Verify with</span>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-search-border p-1">
          {(["email", "phone"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setValue("method", option)}
              className={cn(
                "rounded-lg py-2 text-sm font-semibold capitalize transition-colors",
                method === option
                  ? "bg-primary-solid text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {method === "email" ? (
        <Input
          label={emailLabel}
          type="email"
          placeholder="you@company.com"
          icon={<Mail size={16} />}
          autoComplete="email"
          error={errors[emailField]?.message}
          {...register(emailField)}
        />
      ) : (
        <Controller
          control={control}
          name={phoneField}
          render={({ field }) => (
            <PhoneInput
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors[phoneField]?.message}
            />
          )}
        />
      )}

      <Input
        label="Password"
        type={showPassword ? "text" : "password"}
        placeholder="Create a password"
        icon={<Lock size={16} />}
        autoComplete="new-password"
        error={errors.password?.message}
        rightSlot={
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-faint transition-colors hover:text-ink"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...register("password")}
      />

      <Input
        label="Confirm password"
        type={showConfirmPassword ? "text" : "password"}
        placeholder="Re-enter your password"
        icon={<Lock size={16} />}
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        rightSlot={
          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            className="text-faint transition-colors hover:text-ink"
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...register("confirmPassword")}
      />

      {/* Clerk mounts its bot-protection widget here during create(). */}
      <div id="clerk-captcha" />

      {state.error && (
        <p className="font-grotesk text-sm text-red-500">{state.error}</p>
      )}

      <button type="submit" disabled={isPending} className={SUBMIT_CLASSES}>
        {isPending ? "Creating account…" : "Create account"}
        <ArrowRight size={18} />
      </button>

      <SocialButtons />
      </form>
    </>
  );
};
