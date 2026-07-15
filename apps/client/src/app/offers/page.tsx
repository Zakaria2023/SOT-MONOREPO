import { OffersList } from "@/components/offers/offers-list";
import { getCurrentUser } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOffersForUser } from "services";

export const metadata: Metadata = {
  title: "Your offers · Stratum",
};

const OffersPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const offers = await getOffersForUser(user.uuid);

  return (
    <main className="px-6 py-12 lg:px-16">
      <h1 className="font-heading text-3xl text-ink">Your offers</h1>
      <p className="font-grotesk mt-1 text-sm text-muted">
        Approved offers from our partners across all your BOQs. Pick the one
        that fits you best.
      </p>

      <OffersList offers={offers} />
    </main>
  );
};

export default OffersPage;
