"use client";

import { SignOutButton } from "@clerk/nextjs";
import { ChevronRight, Home, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const LABELS: Record<string, string> = {
  boqs: "Incoming BOQs",
};

// Dynamic route segments (uuids) aren't shown as their own crumb.
const isDynamic = (segment: string) => segment.length >= 20;

const toLabel = (segment: string) =>
  LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);

export const Navbar = () => {
  const pathname = usePathname();
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => !isDynamic(segment));

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-hairline bg-surface px-8 py-3">
      <nav className="flex items-center gap-1.5">
        <Link
          href="/"
          title="Home"
          className={`flex h-8 w-8 items-center justify-center rounded-control transition-colors ${
            segments.length === 0
              ? "bg-primary text-white"
              : "bg-primary-tint text-primary hover:bg-primary-tint-border"
          }`}
        >
          <Home size={16} />
        </Link>

        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const isLast = index === segments.length - 1;

          return (
            <Fragment key={href}>
              <ChevronRight size={15} className="text-faint" />
              <Link
                href={href}
                className={`rounded-control px-3 py-1.5 text-sm font-medium transition-colors ${
                  isLast
                    ? "bg-primary text-white"
                    : "text-secondary hover:bg-hover"
                }`}
              >
                {toLabel(segment)}
              </Link>
            </Fragment>
          );
        })}
      </nav>

      <SignOutButton>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-control border border-hairline px-3 text-sm font-medium text-secondary transition-colors hover:bg-hover"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </SignOutButton>
    </header>
  );
};
