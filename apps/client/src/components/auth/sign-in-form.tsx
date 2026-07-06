"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export const SignInForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    // UI only for now — auth is wired up later.
    event.preventDefault();
  };

  return (
    <div className="relative w-full max-w-md rounded-3xl bg-white p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-ink">
          Welcome back
        </h1>
        <p className="font-grotesk mt-2 text-sm text-[#62656B]">
          New to Stratum?{" "}
          <Link href="/sign-up" className="font-bold text-primary">
            Create one
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          id="email"
          label="Work email"
          type="email"
          placeholder="you@company.com"
          icon={Mail}
          autoComplete="email"
        />

        <Input
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          icon={Lock}
          autoComplete="current-password"
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
              className="text-[#8A8F98] transition-colors hover:text-ink"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(event) => setKeepSignedIn(event.target.checked)}
            className="sr-only"
          />
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
              keepSignedIn
                ? "border-primary bg-primary"
                : "border-[#E3E4E9] bg-white",
            )}
          >
            {keepSignedIn && (
              <Check size={13} strokeWidth={3} className="text-white" />
            )}
          </span>
          <span className="font-grotesk text-sm text-[#4B4E55]">
            Keep me signed in
          </span>
        </label>

        <button
          type="submit"
          className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          Sign in
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
};
