"use client";

import { useForgotPasswordForm } from "@/app/forgot-password/use-forgot-password-form";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "ui";

export const ForgotPasswordForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const {
    step,
    state,
    isPending,
    email,
    requestForm,
    resetForm,
    onRequest,
    onReset,
    resend,
  } = useForgotPasswordForm();

  return (
    <div className="relative w-full max-w-md rounded-3xl bg-surface p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      <div>
        <h1 className="font-heading text-3xl text-ink">
          {step === "request" ? "Reset your password" : "Check your email"}
        </h1>
        <p className="font-grotesk mt-2 text-sm text-muted">
          {step === "request" ? (
            <>
              Remembered it?{" "}
              <Link href="/sign-in" className="font-bold text-primary">
                Sign in
              </Link>
            </>
          ) : (
            <>We sent a code to {email}. Enter it and choose a new password.</>
          )}
        </p>
      </div>

      {step === "request" ? (
        <form
          onSubmit={onRequest}
          noValidate
          className="font-grotesk mt-6 flex flex-col gap-4"
        >
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            icon={<Mail size={16} />}
            autoComplete="email"
            error={requestForm.formState.errors.email?.message}
            {...requestForm.register("email")}
          />

          {state.error && (
            <p className="font-grotesk text-sm text-red-500">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send reset code"}
            <ArrowRight size={18} />
          </button>
        </form>
      ) : (
        <form
          onSubmit={onReset}
          noValidate
          className="font-grotesk mt-6 flex flex-col gap-4"
        >
          <Input
            label="Reset code"
            type="text"
            inputMode="numeric"
            placeholder="Enter the 6-digit code"
            icon={<KeyRound size={16} />}
            autoComplete="one-time-code"
            error={resetForm.formState.errors.code?.message}
            {...resetForm.register("code")}
          />

          <Input
            label="New password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            icon={<Lock size={16} />}
            autoComplete="new-password"
            error={resetForm.formState.errors.password?.message}
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
            {...resetForm.register("password")}
          />

          <Input
            label="Confirm new password"
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your new password"
            icon={<Lock size={16} />}
            autoComplete="new-password"
            error={resetForm.formState.errors.confirmPassword?.message}
            {...resetForm.register("confirmPassword")}
          />

          {state.error && (
            <p className="font-grotesk text-sm text-red-500">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60"
          >
            {isPending ? "Resetting…" : "Reset password"}
            <ArrowRight size={18} />
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={resend}
              className="font-grotesk font-bold text-primary"
            >
              Resend code
            </button>
            <Link
              href="/sign-in"
              className="font-grotesk inline-flex items-center gap-1.5 text-muted transition-colors hover:text-primary"
            >
              <ArrowLeft size={15} />
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};
