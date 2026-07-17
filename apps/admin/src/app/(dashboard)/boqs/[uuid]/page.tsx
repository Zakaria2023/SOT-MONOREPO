import { BoqDetail } from "@/components/boqs/boq-detail";
import { requireAdmin } from "@/lib/server/auth";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminBoq } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const AdminBoqPage = async ({ params }: Props) => {
  await requireAdmin();
  const { uuid } = await params;

  const detail = await getAdminBoq(uuid);
  if (!detail) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/boqs"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft size={16} />
        All BOQs
      </Link>

      <BoqDetail detail={detail} />
    </div>
  );
};

export default AdminBoqPage;
