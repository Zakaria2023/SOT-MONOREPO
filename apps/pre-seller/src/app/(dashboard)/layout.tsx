import { FileText, LayoutDashboard } from "lucide-react";
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
    title: "Work",
    links: [{ icon: FileText, label: "Assigned BOQs", href: "/boqs" }],
  },
];

type Props = {
  children: ReactNode;
};

const DashboardLayout = ({ children }: Props) => (
  <DashboardShell groups={NAV_GROUPS} labels={{ boqs: "Assigned BOQs" }}>
    {children}
  </DashboardShell>
);

export default DashboardLayout;
