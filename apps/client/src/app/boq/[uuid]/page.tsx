import { BoqView } from "@/components/boq/boq-view";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBoq } from "services";

export const metadata: Metadata = {
  title: "Your BOQ · Stratum",
};

type Props = {
  params: Promise<{ uuid: string }>;
};

const BoqPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const detail = await getBoq(uuid);
  if (!detail || detail.boq.userUuid !== user.uuid) {
    notFound();
  }

  return <BoqView boq={detail.boq} items={detail.items} />;
};

export default BoqPage;
