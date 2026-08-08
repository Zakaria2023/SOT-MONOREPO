import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { DashboardShell, type NavGroup } from "ui";
import type { ReactNode } from "react";

// Always render against live data — never a build-time static snapshot.
export const dynamic = "force-dynamic";

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    links: [{ icon: LayoutDashboard, label: "Dashboard", href: "/" }],
  },
  {
    title: "Buy",
    links: [
      { icon: Package, label: "Catalogue", href: "/browse" },
      { icon: ShoppingCart, label: "Your basket", href: "/cart" },
    ],
  },
  {
    title: "Work",
    links: [
      { icon: ClipboardList, label: "Your work", href: "/work" },
      { icon: FileText, label: "Incoming BOQs", href: "/boqs" },
      { icon: Wallet, label: "Earnings", href: "/earnings" },
    ],
  },
];

type Props = {
  children: ReactNode;
};

const DashboardLayout = ({ children }: Props) => (
  <DashboardShell groups={NAV_GROUPS} labels={{ boqs: "Incoming BOQs" }}>
    {children}
  </DashboardShell>
);

export default DashboardLayout;
