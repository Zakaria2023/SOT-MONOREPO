import { Shell } from "@/components/layout/shell";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

const DashboardLayout = ({ children }: Props) => <Shell>{children}</Shell>;

export default DashboardLayout;
