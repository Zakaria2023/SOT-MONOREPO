import { BoqDetail } from "@/components/boqs/boq-detail";
import { notFound } from "next/navigation";
import { getAdminBoq } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const AdminBoqPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const detail = await getAdminBoq(uuid);
  if (!detail) {
    notFound();
  }

  return <BoqDetail detail={detail} />;
};

export default AdminBoqPage;
