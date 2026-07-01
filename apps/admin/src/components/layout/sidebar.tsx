import {
  Layers,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type NavLink = {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
};

const MENU_LINKS: NavLink[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", active: true },
  { icon: Package, label: "Products", href: "/products" },
  { icon: ShoppingCart, label: "Orders", href: "/orders" },
  { icon: Users, label: "Customers", href: "/customers" },
];

export const Sidebar = () => (
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
      {MENU_LINKS.map(({ icon: Icon, label, href, active }) => (
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
      ))}

      <span className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-faint uppercase">
        System
      </span>
      <Link
        href="/settings"
        className="flex min-h-11 w-full items-center gap-2.5 rounded-control border border-transparent px-3 text-sm text-secondary hover:bg-hover"
      >
        <Settings size={19} strokeWidth={2} />
        Settings
      </Link>
    </nav>

    <div className="flex flex-col gap-3 p-3">
      <div className="rounded-card bg-gradient-to-br from-primary to-primary-hover p-4 text-white">
        <p className="text-sm font-semibold">Storage usage</p>
        <p className="mt-1 text-xs text-white/80">
          68% of your product media storage used
        </p>
      </div>

      <div className="flex items-center gap-2.5 rounded-control border border-hairline p-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-sm font-semibold text-primary">
          JD
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">Jordan Diaz</span>
          <span className="text-xs text-muted">Store manager</span>
        </div>
      </div>
    </div>
  </aside>
);
