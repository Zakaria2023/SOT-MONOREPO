"use client";

import type { LucideIcon } from "lucide-react";
import { Award, Layers, LayoutDashboard, Tags } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  icon: LucideIcon;
  label: string;
  href: string;
};

const MENU_LINKS: NavLink[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Award, label: "Brands", href: "/brands" },
  { icon: Tags, label: "Categories", href: "/categories" },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-62.5 shrink-0 flex-col border-r border-hairline bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-primary text-white">
          <Layers size={18} strokeWidth={2} />
        </div>
        <span className="font-heading text-xl font-extrabold text-ink">
          Stratum
        </span>
        <span className="ml-auto rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">
          ADMIN
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        <span className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-faint uppercase">
          Menu
        </span>
        {MENU_LINKS.map(({ icon: Icon, label, href }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={label}
              href={href}
              className={`flex min-h-11 w-full items-center gap-2.5 rounded-control border px-3 text-sm ${
                active
                  ? "border-primary-tint-border bg-primary-tint font-bold text-primary"
                  : "border-transparent text-secondary hover:bg-hover"
              }`}
            >
              <Icon size={19} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
