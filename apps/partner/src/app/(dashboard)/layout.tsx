import {
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Sparkles,
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
      // P16. Above earnings, because a lead is where the next earning comes from.
      { icon: Sparkles, label: "Leads", href: "/leads" },
      { icon: Wallet, label: "Earnings", href: "/earnings" },
    ],
  },
  {
    // Its own group, not tucked under Work. Training is what a partner does to be
    // ALLOWED to work, which is a different kind of thing from a job in progress.
    title: "Capability",
    links: [{ icon: GraduationCap, label: "Training", href: "/training" }],
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
