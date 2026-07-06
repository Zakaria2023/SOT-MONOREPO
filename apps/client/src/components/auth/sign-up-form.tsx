"use client";

import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export const SignUpForm = () => {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    // UI only for now — auth is wired up later.
    event.preventDefault();
  };

  return (
    <div className="relative w-full max-w-md rounded-3xl bg-white p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-ink">
          Create your account
        </h1>
        <p className="font-grotesk mt-2 text-sm text-[#62656B]">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-bold text-primary">
            Sign in
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          id="fullName"
          label="Full name"
          placeholder="Jane Doe"
          icon={User}
          autoComplete="name"
        />

        <Input
          id="email"
          label="Work email"
          type="email"
          placeholder="you@company.com"
          icon={Mail}
          autoComplete="email"
        />

        <Input
          id="phone"
          label="Phone"
          type="tel"
          placeholder="+966 5X XXX XXXX"
          icon={Phone}
          autoComplete="tel"
        />

        <Input
          id="companyName"
          label="Company name"
          placeholder="Acme Corp"
          icon={Building2}
          autoComplete="organization"
        />

        <Input
          id="location"
          label="Location"
          placeholder="Riyadh, Saudi Arabia"
          icon={MapPin}
          autoComplete="address-level2"
        />

        <Input
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Create a password"
          icon={Lock}
          autoComplete="new-password"
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

        <button
          type="submit"
          className="font-grotesk mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(124,58,237,0.6)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          Create account
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
};
