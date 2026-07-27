import type { ProductValues } from "../../../db/types";
import { facetAssignments, type Viewer } from "./assignment-resolver";
import { getCatalogModel, resolveFromModel } from "./catalog-model";
import type { CategoryFacet } from "./facet-selection";

// ---------------------------------------------------------------------------
// Storefront facets — the "sideways" direction of the same rules.
//
// A facet is not a property of an attribute; it is a property of WHERE THE
// SHOPPER IS STANDING. The same Port Speed attribute is a branch-wide facet at
// Networking and absent on a leaf that suppressed it, and the options it offers
// are that category's slice, never the master list.
// ---------------------------------------------------------------------------

/**
 * The facets a category offers this shopper.
 *
 * `selection` is the shopper's own current filter state, and it drives the
 * conditional reveal the same way a product's values drive it on the admin form:
 * the PoE Budget facet appears once they have ticked PoE = Yes. Without that, a
 * PoE Budget slider sits on a page of non-PoE switches as pure noise.
 */
export const getCategoryFacets = async (
  categoryUuid: string,
  viewer: Viewer,
  selection: ProductValues = {},
): Promise<CategoryFacet[]> => {
  const model = await getCatalogModel();
  const resolved = resolveFromModel(model, categoryUuid);

  return (
    facetAssignments(resolved, viewer, selection)
      .map((assignment) => ({
        key: assignment.definition.uuid,
        label: assignment.definition.label,
        type: assignment.definition.type,
        unit: assignment.definition.unit,
        ordered: assignment.definition.ordered,
        options: assignment.offeredOptions.map((option) => ({
          value: option.value,
          label: option.label,
          rank: option.rank,
        })),
      }))
      // A facet with nothing to tick cannot be filtered on. A `number` marked as
      // a filter has no option list at all, and it was rendering as a heading
      // over an empty box — a control the shopper cannot use and cannot be told
      // why. Dropped here rather than in each surface, so the client, the API and
      // mobile agree.
      .filter((facet) => facet.options.length > 0)
  );
};

// The pure half — choice expansion and reveal values — lives in
// `facet-selection.ts` so it is testable without database credentials.
export * from "./facet-selection";
