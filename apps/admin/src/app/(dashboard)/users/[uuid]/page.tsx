import {
  getUserAuditAction,
  getUserDetailAction,
} from "@/app/(dashboard)/users/action";
import { UserTabs } from "@/components/users/user-tabs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ uuid: string }>;
};

const UserDetailPage = async ({ params }: Props) => {
  const { uuid } = await params;

  // Fired together: the detail and its audit share nothing, and run serially
  // they would add a round trip to a page already waiting for six queries.
  const [detail, audit] = await Promise.all([
    getUserDetailAction(uuid),
    getUserAuditAction(uuid),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/users"
          className="flex h-9 w-9 items-center justify-center rounded-control border border-hairline text-secondary hover:bg-hover"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="font-heading text-2xl text-ink">
            {detail.user.fullName}
          </h1>
          <p className="text-sm text-muted">
            {detail.user.email ?? detail.user.phone ?? "No contact details"}
          </p>
        </div>
      </div>

      <UserTabs detail={detail} audit={audit} />
    </div>
  );
};

export default UserDetailPage;
