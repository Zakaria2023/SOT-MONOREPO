"use client";

import { MapPin, X } from "lucide-react";
import Link from "next/link";

type ProfileGateModalProps = {
  onClose: () => void;
  next?: string;
};

// Shown when a user with an incomplete profile tries to check out. They can't
// proceed until they add their location, so we point them at /complete-profile.
export const ProfileGateModal = ({
  onClose,
  next = "/cart",
}: ProfileGateModalProps) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="profile-gate-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
  >
    <div className="relative w-full max-w-md rounded-3xl border border-hairline bg-surface-2 p-8 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.5)]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 text-faint transition-colors hover:text-ink"
      >
        <X size={18} />
      </button>

      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
        <MapPin size={22} />
      </div>

      <h2 id="profile-gate-title" className="font-heading mt-4 text-2xl text-ink">
        Complete your profile
      </h2>
      <p className="font-grotesk mt-2 text-sm text-muted">
        Add your location before checking out so we can match your BOQ with the
        right partners.
      </p>

      <Link
        href={`/complete-profile?next=${encodeURIComponent(next)}`}
        className="font-grotesk mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
      >
        Complete profile
      </Link>
    </div>
  </div>
);
