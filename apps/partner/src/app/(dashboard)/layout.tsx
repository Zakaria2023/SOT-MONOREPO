import { Shell } from "@/components/layout/shell";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
};

const DashboardLayout = ({ children }: Props) => <Shell>{children}</Shell>;

export default DashboardLayout;
