import { BoqView } from "@/components/boq/boq-view";
import { OffersSection } from "@/components/boq/offers-section";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getApprovedOffersForUser, getBoq } from "services";

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

  const offers = await getApprovedOffersForUser(user.uuid, uuid);
  const currency = detail.items[0]?.currency ?? "SAR";

  return (
    <>
      <BoqView boq={detail.boq} items={detail.items} />
      <OffersSection
        boqUuid={detail.boq.uuid}
        offers={offers}
        currency={currency}
        awaiting={detail.boq.status !== "draft"}
      />
    </>
  );
};

export default BoqPage;
