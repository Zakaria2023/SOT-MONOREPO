"use client";

import { useClerk } from "@clerk/nextjs";
import { getInitials } from "utils";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ProfileMenuProps = {
  fullName: string;
};

export const ProfileMenu = ({ fullName }: ProfileMenuProps) => {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
        className="font-grotesk flex h-10 w-10 items-center justify-center rounded-full bg-primary-solid text-sm font-bold text-white"
      >
        {getInitials(fullName)}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-[14px] border border-hairline bg-overlay shadow-[0_24px_48px_-24px_rgba(20,22,27,0.25)]">
          <div className="border-b border-hairline px-4 py-3">
            <p className="font-grotesk text-sm font-semibold text-ink">
              {fullName}
            </p>
          </div>

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="font-grotesk flex items-center gap-2.5 px-4 py-2.5 text-sm text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
          >
            <User size={16} /> Account
          </Link>

          <button
            type="button"
            onClick={() => void signOut({ redirectUrl: "/" })}
            className="font-grotesk flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
};
