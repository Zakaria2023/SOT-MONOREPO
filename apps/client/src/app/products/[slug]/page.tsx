import { ProductCompare } from "@/components/product/product-compare";
import { ProductDetails } from "@/components/product/product-details";
import { ProductHero } from "@/components/product/product-hero";
import { ProductRelated } from "@/components/product/product-related";
import { ProductSpecs } from "@/components/product/product-specs";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { notFound } from "next/navigation";
import {
  getComparableProducts,
  getComparisonSpecs,
  getProductDetailBySlug,
  getRelatedProducts,
  getProductSpecsForDisplay,
  sectionSpecs,
} from "services";

type Props = {
  params: Promise<{ slug: string }>;
};

const ProductPage = async ({ params }: Props) => {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);
  if (!product) {
    notFound();
  }

  const viewerPricing = await getViewerPartnerPricing();

  const [comparables, related, specs] = await Promise.all([
    getComparableProducts(product.categoryUuid, product.uuid),
    getRelatedProducts(product.uuid),
    // Audience gates reading too: a partner-only attribute must be absent from
    // this table for a regular user, not merely missing from the filters.
    // WHICH attributes appear comes from the category's assignments, and the
    // reveal is applied too — so a product whose PoE is "No" does not show a PoE
    // Budget row. Audience gates reading as well as filtering: a partner-only
    // attribute is absent from this table for a regular user, not merely missing
    // from the facets.
    getProductSpecsForDisplay(
      product.categoryUuid,
      product.specValues ?? {},
      viewerPricing.isPartner ? "partner" : "user",
    ),
  ]);

  // Already formatted server-side, through the same renderer the engine uses to
  // explain a finding — so a spec row and a design message never describe the
  // same value two different ways.
  const attributes = specs.map((spec) => ({
    label: spec.label,
    group: spec.groupName,
    value: spec.value,
  }));

  // Sectioned by library group, groups in first-seen order so the table reads the
  // way the library is organised. Shared with the admin detail panel, so the two
  // cannot section the same product differently.
  const specGroups = sectionSpecs(specs).map((section) => ({
    name: section.name,
    attributes: section.specs.map((spec) => ({
      label: spec.label,
      group: spec.groupName,
      value: spec.value,
    })),
  }));

  // Has to follow the comparables — it needs their values. One small read on top
  // of the batch above, not one per column.
  const comparisonRows =
    comparables.length > 0
      ? await getComparisonSpecs(
          product.categoryUuid,
          [product, ...comparables].map((entry) => ({
            uuid: entry.uuid,
            values: entry.specValues ?? {},
          })),
          viewerPricing.isPartner ? "partner" : "user",
        )
      : [];

  return (
    <main className="min-h-screen bg-page pb-16">
      <ProductHero
        product={product}
        attributes={attributes}
        discountPercent={viewerPricing.discountPercent}
      />
      <ProductDetails product={product} />
      <ProductSpecs groups={specGroups} />
      <ProductCompare
        current={product}
        others={comparables}
        rows={comparisonRows}
      />
      <ProductRelated products={related} />
    </main>
  );
};

export default ProductPage;
