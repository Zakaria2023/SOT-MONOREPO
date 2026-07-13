"use client";

import { useSignUpForm } from "@/app/sign-up/use-sign-up-form";
import { PhoneInput } from "@/components/auth/phone-input";
import { SocialButtons } from "@/components/auth/social-buttons";
import { LocationPicker } from "@/components/location/location-picker";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Input } from "ui";

const SUBMIT_CLASSES =
  "font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60";

export const SignUpForm = () => {
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
  } = useSignUpForm();

  const method = watch("method");

  return (
    <div className="relative w-full max-w-md rounded-3xl bg-surface p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      {step === "details" ? (
        <>
          <div>
            <h1 className="font-heading text-3xl text-ink">
              Create your account
            </h1>
            <p className="font-grotesk mt-2 text-sm text-muted">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-bold text-primary">
                Sign in
              </Link>
            </p>
          </div>

          <form
            onSubmit={onSubmitDetails}
            noValidate
            className="font-grotesk mt-6 flex flex-col gap-4"
          >
            <Input
              label="Full name"
              placeholder="Jane Doe"
              icon={<User size={16} />}
              autoComplete="name"
              error={errors.fullName?.message}
              {...register("fullName")}
            />

            {/* Sign up with one identifier so Clerk sends a single code. */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink">
                Sign up with
              </span>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-search-border p-1">
                {(["email", "phone"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setValue("method", option)}
                    className={cn(
                      "rounded-lg py-2 text-sm font-semibold capitalize transition-colors",
                      method === option
                        ? "bg-primary text-white"
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
                label="Work email"
                type="email"
                placeholder="you@company.com"
                icon={<Mail size={16} />}
                autoComplete="email"
                error={errors.email?.message}
                {...register("email")}
              />
            ) : (
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    error={errors.phone?.message}
                  />
                )}
              />
            )}

            <Input
              label="Company name"
              placeholder="Acme Corp"
              icon={<Building2 size={16} />}
              autoComplete="organization"
              error={errors.companyName?.message}
              {...register("companyName")}
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
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
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
      ) : (
        <>
          <div>
            <h1 className="font-heading text-3xl text-ink">Verify it&apos;s you</h1>
            <p className="font-grotesk mt-2 text-sm text-muted">
              We sent a code to{" "}
              <span className="font-bold text-ink">{contact}</span>.
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
      )}
    </div>
  );
};
