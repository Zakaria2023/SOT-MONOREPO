import { BoqView } from "@/components/boq/boq-view";
import { OffersSection } from "@/components/boq/offers-section";
import { getCurrentUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getApprovedOffersForUser, getUserBoq } from "services";

export const metadata: Metadata = pageMetadata({
  title: "Your bill of quantities",
  description: "The hardware list for your deployment, and the offers on it.",
  path: "/boq",
  noIndex: true,
});

type Props = {
  params: Promise<{ uuid: string }>;
};

const BoqPage = async ({ params }: Props) => {
  const { uuid } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const detail = await getUserBoq(user.uuid, uuid);
  if (!detail) {
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
