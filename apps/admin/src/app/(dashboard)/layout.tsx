import { Shell } from "@/components/layout/shell";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

// Render every dashboard page dynamically (per request), never as a build-time
// static snapshot. These pages read live data — category trees, brands, the
// specification templates products fill — with no dynamic API of their own, so
// on Vercel they would otherwise be prerendered once at build and served frozen:
// categories/specs added or reparented afterwards would show locally (dev is
// always fresh) but never on live. Forcing dynamic keeps the admin in lockstep
// with the database. Applies to all nested routes via route-segment config.
export const dynamic = "force-dynamic";

const DashboardLayout = ({ children }: Props) => <Shell>{children}</Shell>;

export default DashboardLayout;
