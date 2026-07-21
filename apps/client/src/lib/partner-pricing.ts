import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import {
  getPartnerPricingForClerkUser,
  type ViewerPartnerPricing,
} from "services";

/**
 * The signed-in viewer's shopping pricing: whether they're an approved partner
 * and their stacked discount off MSRP (0 for guests and regular clients).
 * Request-scoped via React `cache` so every price on a page shares one lookup.
 */
export const getViewerPartnerPricing = cache(
  async (): Promise<ViewerPartnerPricing> => {
    const { userId } = await auth();
    return getPartnerPricingForClerkUser(userId);
  },
);
