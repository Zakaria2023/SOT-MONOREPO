"use client";

import type { LucideIcon } from "lucide-react";
import {
  Award,
  FileText,
  FlaskConical,
  Inbox,
  Landmark,
  Layers,
  LifeBuoy,
  LayoutDashboard,
  Library,
  Network,
  Package,
  Percent,
  Search,
  Shapes,
  Tags,
  Ticket,
  TrendingUp,
  Wallet,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type NavLink = {
  icon: LucideIcon;
  label: string;
  href: string;
};

type NavGroup = {
  title: string;
  links: NavLink[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    links: [{ icon: LayoutDashboard, label: "Dashboard", href: "/" }],
  },
  {
    title: "Catalog",
    links: [
      { icon: Award, label: "Brands", href: "/brands" },
      { icon: Tags, label: "Categories", href: "/categories" },
      { icon: Shapes, label: "Classifications", href: "/classifications" },
      { icon: Library, label: "Spec Library", href: "/library" },
      { icon: Workflow, label: "Assignments", href: "/assignments" },
      { icon: Package, label: "Products", href: "/products" },
      { icon: Inbox, label: "Imports", href: "/imports" },
      { icon: FlaskConical, label: "Sandbox", href: "/sandbox" },
    ],
  },
  {
    title: "Money",
    links: [
      { icon: Wallet, label: "Partner Payables", href: "/payables" },
      { icon: TrendingUp, label: "Platform Financials", href: "/financials" },
    ],
  },
  {
    title: "Sales",
    links: [
      { icon: FileText, label: "BOQs", href: "/boqs" },
      { icon: Network, label: "Partners", href: "/partners" },
      { icon: Percent, label: "Partner Discounts", href: "/partner-discounts" },
      { icon: Landmark, label: "Government", href: "/government" },
      { icon: Ticket, label: "Offers", href: "/offers" },
      { icon: LifeBuoy, label: "Expert Desk", href: "/expert-desk" },
    ],
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return NAV_GROUPS;
    }
    return NAV_GROUPS.map((group) => ({
      ...group,
      links: group.links.filter((link) => link.label.toLowerCase().includes(q)),
    })).filter((group) => group.links.length > 0);
  }, [query]);

  return (
    <aside className="group fixed inset-y-0 left-0 z-40 flex w-18 flex-col overflow-x-hidden border-r border-hairline bg-surface transition-[width] duration-200 ease-out hover:w-64 hover:shadow-[0_20px_50px_-24px_rgba(27,35,51,0.28)]">
      <div className="flex h-16 shrink-0 items-center gap-3 px-4.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary text-white">
          <Layers size={19} strokeWidth={2} />
        </div>
        <span className="font-heading text-xl whitespace-nowrap text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          SOT Solutions
        </span>
      </div>

      <div className="h-0 shrink-0 overflow-hidden px-3 opacity-0 transition-all duration-200 group-hover:h-12 group-hover:opacity-100">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search menu..."
            className="w-full rounded-control border border-search-border bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-3 py-3 scrollbar-none">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <span className="mb-0.5 h-4 px-3 text-[11px] font-bold tracking-wider whitespace-nowrap text-faint uppercase opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {group.title}
            </span>

            {group.links.map(({ icon: Icon, label, href }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);

              return (
                <Link
                  key={label}
                  href={href}
                  title={label}
                  className={`flex h-11 items-center gap-3 rounded-control px-3 text-sm transition-colors ${
                    active
                      ? "bg-primary font-semibold text-white"
                      : "text-secondary hover:bg-hover hover:text-ink"
                  }`}
                >
                  <Icon size={20} strokeWidth={2} className="shrink-0" />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};
