import { Shell } from "@/components/layout/shell";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

const DashboardLayout = ({ children }: Props) => <Shell>{children}</Shell>;

export default DashboardLayout;
