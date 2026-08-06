"use server";

import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { getProducts, type ProductSummary } from "services";

/**
 * The products under one category, for the navbar's catalogue menu.
 *
 * The menu used to be handed every product in the catalogue by the navbar, which
 * meant a ~500ms read on the server before ANY page in the app could render — for
 * a panel most visits never open. It now asks for one family's products the first
 * time that family is opened, off the critical path.
 *
 * The caller passes the whole subtree, because products sit in the leaves and a
 * query for "Networking" alone comes back empty.
 */
export const getMenuProducts = async (
  categoryUuids: string[],
): Promise<ProductSummary[]> => {
  if (categoryUuids.length === 0) {
    return [];
  }
  // Resolved from the session here, never taken as an argument. This is a server
  // action the browser calls directly, so a viewer passed in would be a viewer
  // anyone could claim — and the whole point of the field is that some products
  // are not for everyone.
  const { isPartner } = await getViewerPartnerPricing();
  return getProducts({
    categoryUuids,
    viewer: isPartner ? "partner" : "user",
  });
};
