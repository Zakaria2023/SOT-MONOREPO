"use client";

import { useSignInForm } from "@/app/sign-in/use-sign-in-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "ui";

export const SignInForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const {
    form: {
      register,
      watch,
      formState: { errors },
    },
    state,
    isPending,
    onSubmit,
  } = useSignInForm();

  const keepSignedIn = watch("keepSignedIn");

  return (
    <div className="relative w-full max-w-md rounded-3xl bg-surface p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      <div>
        <h1 className="font-heading text-3xl text-ink">Welcome back</h1>
        <p className="font-grotesk mt-2 text-sm text-muted">
          New to Stratum?{" "}
          <Link href="/sign-up" className="font-bold text-primary">
            Create one
          </Link>
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="font-grotesk mt-6 flex flex-col gap-4"
      >
        <Input
          label="Email or phone"
          type="text"
          placeholder="you@company.com or +9665…"
          icon={<Mail size={16} />}
          autoComplete="username"
          error={errors.identifier?.message}
          {...register("identifier")}
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          icon={<Lock size={16} />}
          autoComplete="current-password"
          error={errors.password?.message}
          labelAccessory={
            <Link
              href="/forgot-password"
              className="font-grotesk text-sm font-bold text-primary"
            >
              Forgot?
            </Link>
          }
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

        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          <input
            type="checkbox"
            className="sr-only"
            {...register("keepSignedIn")}
          />
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
              keepSignedIn
                ? "border-primary bg-primary-solid"
                : "border-search-border bg-surface",
            )}
          >
            {keepSignedIn && (
              <Check size={13} strokeWidth={3} className="text-white" />
            )}
          </span>
          <span className="font-grotesk text-sm text-secondary">
            Keep me signed in
          </span>
        </label>

        {state.error && (
          <p className="font-grotesk text-sm text-red-500">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-solid py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-solid-hover disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? "Signing in…" : "Sign in"}
          <ArrowRight size={18} />
        </button>

        <SocialButtons />
      </form>
    </div>
  );
};
