import type { ReactNode } from "react";
import { DashboardNavbar } from "./dashboard-navbar";
import { DashboardSidebar, type NavGroup } from "./dashboard-sidebar";

type DashboardShellProps = {
  groups: NavGroup[];
  /** Crumb label overrides for the breadcrumb bar, keyed by path segment. */
  labels?: Record<string, string>;
  children: ReactNode;
};

/**
 * The partner and pre-seller dashboard chrome, which existed twice.
 *
 * shell.tsx and proxy.ts were byte-identical between the two apps; navbar.tsx and
 * sidebar.tsx differed by a single string each ("Incoming BOQs" against "Assigned
 * BOQs"). Roughly 250 lines kept in step by hand, and this session edited both
 * proxies identically twice, which is what that costs.
 */
export const DashboardShell = ({
  groups,
  labels,
  children,
}: DashboardShellProps) => (
  <div className="min-h-screen">
    <DashboardSidebar groups={groups} />

    <div className="ml-18 flex min-h-screen flex-col">
      <DashboardNavbar labels={labels} />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  </div>
);
