"use client";

import { AccountSignUpForm } from "@/components/auth/account-sign-up-form";
import { GovernmentRequestForm } from "@/components/auth/government-request-form";
import { ArrowLeft, Building2, ChevronRight, Landmark, User } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { SignUpAccountType } from "validators";

type SignupType = SignUpAccountType | "government";

type TypeOption = {
  value: SignupType;
  label: string;
  description: string;
  icon: ReactNode;
};

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: "individual",
    label: "Individual / Freelancer",
    description: "A personal account",
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
    description: "Verified by our team",
    icon: <Landmark size={20} />,
  },
];

const CARD_CLASSES =
  "relative w-full max-w-md rounded-3xl bg-surface p-9 shadow-[0_30px_80px_-24px_rgba(20,22,27,0.2),0_24px_70px_-34px_rgba(124,58,237,0.5)]";

export const SignUpForm = () => {
  const [selected, setSelected] = useState<SignupType | null>(null);

  if (!selected) {
    return (
      <div className={CARD_CLASSES}>
        <div>
          <h1 className="font-heading text-3xl text-ink">Create your account</h1>
          <p className="font-grotesk mt-2 text-sm text-muted">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-bold text-primary">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value)}
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
      </div>
    );
  }

  return (
    <div className={CARD_CLASSES}>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="font-grotesk inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} />
        Change type
      </button>

      <div className="mt-4">
        {selected === "government" ? (
          <GovernmentRequestForm />
        ) : (
          <AccountSignUpForm key={selected} type={selected} />
        )}
      </div>
    </div>
  );
};
