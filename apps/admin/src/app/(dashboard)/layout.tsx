import { Shell } from "@/components/layout/shell";
import { requireAdmin } from "@/lib/server/auth";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

/**
 * The role gate for every page in the dashboard.
 *
 * It lives here rather than in each page.tsx for the reason CLAUDE.md gives —
 * a page decides what a screen looks like, not who may see it — and rather than
 * in proxy.ts because the role sits in Clerk publicMetadata, which is not in the
 * session token unless a JWT template puts it there. Reading it needs
 * currentUser(), and doing that in middleware would cost a Clerk round trip on
 * every asset request.
 *
 * Actions call requireAdmin themselves, so data paths are gated independently of
 * this. Both matter: without the layout a non-admin could still render the
 * screens, and without the action checks they could still reach the writes.
 */
const DashboardLayout = async ({ children }: Props) => {
  await requireAdmin();

  return <Shell>{children}</Shell>;
};

export default DashboardLayout;
