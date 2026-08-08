"use server";

import { requirePartner } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";
import {
  addToCart,
  expandFacetChoices,
  facetSelectionValues,
  getCategories,
  getCategoryFacets,
  getPartnerPricingForClerkUser,
  getProducts,
  getUserByClerkId,
  type CategoryFacet,
  type ProductSummary,
} from "services";
import { fail, type ActionResult } from "utils";

// P4 — the partner's browse.
//
// 4.3 gave a partner a basket and nothing to put in it. This is the other half,
// and it deliberately reuses the SAME facet services the customer catalogue and
// the mobile API use. A second filtering implementation would eventually show a
// partner a different catalogue from the one a customer sees, and neither would
// know.

export type BrowseResult = {
  products: ProductSummary[];
  facets: CategoryFacet[];
  categories: { uuid: string; name: string; path: string | null }[];
  discountPercent: number;
};

export type BrowseQuery = {
  search?: string;
  categoryUuid?: string;
  specs?: Record<string, string[]>;
};

/**
 * Browse, filtered.
 *
 * A partner sees the `partner` viewer's facets — "everyone" plus their own side,
 * never a superset of both. A trade-only attribute is theirs to filter on; a
 * customer-only one is not theirs to see.
 */
export const browseAction = async (
  query: BrowseQuery,
): Promise<BrowseResult> => {
  const clerkUser = await requirePartner();
  const pricing = await getPartnerPricingForClerkUser(clerkUser.id);
  const viewer = pricing.isPartner ? "partner" : "user";

  const categories = await getCategories();

  // Facets belong to a category. An attribute assigned at Networking has nothing
  // to narrow on an all-categories view, so there is nothing to resolve until a
  // category is chosen.
  //
  // Resolved twice on purpose, exactly as the customer catalogue does it: the
  // first pass gives the facets always offered, the second re-resolves with what
  // has actually been ticked, so a conditional facet appears once its trigger is
  // set.
  const facets: CategoryFacet[] = query.categoryUuid
    ? await (async () => {
        const base = await getCategoryFacets(query.categoryUuid ?? "", viewer);
        return getCategoryFacets(
          query.categoryUuid ?? "",
          viewer,
          facetSelectionValues(query.specs ?? {}, base),
        );
      })()
    : [];

  const products = await getProducts({
    search: query.search,
    categoryUuids: query.categoryUuid ? [query.categoryUuid] : undefined,
    specValues:
      facets.length > 0
        ? expandFacetChoices(facets, query.specs ?? {})
        : undefined,
    viewer,
  });

  return {
    products,
    facets,
    categories: categories.map((category) => ({
      uuid: category.uuid,
      name: category.name,
      path: category.path,
    })),
    discountPercent: pricing.discountPercent,
  };
};

/** Put one in the basket. */
export const addToBasketAction = async (
  productUuid: string,
  quantity: number,
): Promise<ActionResult> => {
  const clerkUser = await requirePartner();
  try {
    const user = await getUserByClerkId(clerkUser.id);
    if (!user) {
      return { error: "No profile is linked to this account." };
    }
    await addToCart({ userUuid: user.uuid, productUuid, quantity });
    revalidatePath("/cart");
    return { success: true };
  } catch (error) {
    return fail(error, "Failed to add that to the basket");
  }
};
