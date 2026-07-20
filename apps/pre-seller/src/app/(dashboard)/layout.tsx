import { Shell } from "@/components/layout/shell";
import type { ReactNode } from "react";

// Always render against live data — never a build-time static snapshot.
export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
};

const DashboardLayout = ({ children }: Props) => <Shell>{children}</Shell>;

export default DashboardLayout;
