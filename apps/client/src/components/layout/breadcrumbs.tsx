"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Crumb = {
  label: string;
  href: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Turn a URL segment into a readable label. UUID segments (detail pages keyed
// by id) become "Details"; kebab slugs become title case.
const humanize = (segment: string): string => {
  if (UUID_RE.test(segment)) {
    return "Details";
  }
  return segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const Breadcrumbs = () => {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // No breadcrumb on the home page — there's nowhere up to go.
  if (segments.length === 0) {
    return null;
  }

  const crumbs: Crumb[] = segments.map((segment, index) => ({
    label: humanize(segment),
    href: `/${segments.slice(0, index + 1).join("/")}`,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="w-full px-6 pt-4 lg:px-12 xl:px-20"
    >
      <ol className="font-grotesk flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <li>
          <Link href="/" className="transition-colors hover:text-primary">
            Home
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              <ChevronRight size={14} className="shrink-0 text-faint" />
              {isLast ? (
                <span className="font-medium text-ink">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="transition-colors hover:text-primary"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
