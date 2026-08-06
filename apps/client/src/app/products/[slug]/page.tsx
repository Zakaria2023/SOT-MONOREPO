import { JsonLd } from "@/components/seo/json-ld";
import { ProductCompare } from "@/components/product/product-compare";
import { ProductDetails } from "@/components/product/product-details";
import { ProductHero } from "@/components/product/product-hero";
import { ProductRelated } from "@/components/product/product-related";
import { ProductSpecs } from "@/components/product/product-specs";
import { getCachedProductBySlug } from "@/lib/data";
import { documentImageUrl } from "@/lib/documents";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { clampDescription, pageMetadata } from "@/lib/seo";
import { breadcrumbNode, graph, productNode } from "@/lib/structured-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getComparableProducts,
  getComparisonSpecs,
  getRelatedProducts,
  getProductSpecsForDisplay,
  sectionSpecs,
  type ProductDetail,
} from "services";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Brand and model belong in the title because that is what a shopper actually
 * types — "Ubiquiti U6-Pro", not the descriptive name we display on the page.
 */
const productTitle = (product: ProductDetail): string => {
  const parts = [product.brandName, product.name].filter(Boolean);
  const base = parts.join(" ");
  return product.model && !base.includes(product.model)
    ? `${base} (${product.model})`
    : base;
};

const productDescription = (product: ProductDetail): string => {
  const written = product.shortDescription ?? product.description;
  if (written) {
    return clampDescription(written);
  }
  // No copy written yet — assemble something true and specific rather than
  // letting the page fall back to the site-wide description, which would make
  // every un-described product a duplicate of every other.
  const facts = [
    product.brandName,
    product.categoryName,
    product.model,
    product.warrantyPeriod ? `${product.warrantyPeriod} warranty` : null,
  ].filter(Boolean);
  return clampDescription(
    `${product.name} — ${facts.join(" · ")}. Available from SOT Solutions with design validation and installation.`,
  );
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);

  if (!product) {
    // The page will 404 — say so here too, so a stale link that a crawler still
    // holds does not keep a soft-404 in the index under a real-looking title.
    return { title: "Product not found", robots: { index: false } };
  }

  // A trade-only product is never indexed, whoever is asking. Metadata is
  // generated for crawlers as much as for browsers, and a title and description
  // in a search result is the product being advertised to exactly the people the
  // page itself would turn away.
  if (product.audience !== "everyone") {
    return { title: "Product not found", robots: { index: false } };
  }

  return pageMetadata({
    title: productTitle(product),
    description: productDescription(product),
    path: `/products/${product.slug}`,
    image: product.image ? documentImageUrl(product.image) : null,
    imageAlt: product.name,
    keywords: [
      product.name,
      product.brandName,
      product.categoryName,
      product.model,
      product.sku,
    ].filter((value): value is string => Boolean(value)),
  });
};

const ProductPage = async ({ params }: Props) => {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);
  if (!product) {
    notFound();
  }

  const viewerPricing = await getViewerPartnerPricing();
  const viewer = viewerPricing.isPartner ? "partner" : "user";

  // Keeping a trade-only product out of the LISTING leaves its page reachable by
  // anyone who has the URL, and a URL is exactly the thing that gets forwarded.
  // 404 rather than a "you may not see this": the difference between a product
  // that does not exist and one this shopper is not allowed to know exists is
  // information, and it is not information we have any reason to give out.
  if (product.audience !== "everyone" && product.audience !== viewer) {
    notFound();
  }

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
      viewer,
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
      {/* Product + trail in one graph, so the offer's seller resolves to the
          Organization declared once in the root layout. */}
      <JsonLd
        data={graph([
          productNode(product),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Catalog", path: "/products" },
            ...(product.categoryName
              ? [
                  {
                    name: product.categoryName,
                    path: `/categories/${product.categoryUuid}`,
                  },
                ]
              : []),
            { name: product.name, path: `/products/${product.slug}` },
          ]),
        ])}
      />
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
