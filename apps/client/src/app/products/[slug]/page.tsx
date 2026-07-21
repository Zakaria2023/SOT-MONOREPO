import { ProductCompare } from "@/components/product/product-compare";
import { ProductDetails } from "@/components/product/product-details";
import { ProductHero } from "@/components/product/product-hero";
import { ProductRelated } from "@/components/product/product-related";
import { ProductSpecs } from "@/components/product/product-specs";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { notFound } from "next/navigation";
import {
  getComparableProducts,
  getProductDetailBySlug,
  getRelatedProducts,
  getSpecificationsForKeys,
} from "services";

type Props = {
  params: Promise<{ slug: string }>;
};

// Multi-select values are stored comma-joined; render them spaced.
const displayValue = (value: string): string =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

const ProductPage = async ({ params }: Props) => {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);
  if (!product) notFound();

  // The attributes chosen for this product (fallback to whatever it has values
  // for, for products created before per-product selection).
  const specKeys =
    product.specKeys ?? Object.keys(product.technicalAttributes ?? {});

  const [comparables, related, specs, viewerPricing] = await Promise.all([
    getComparableProducts(product.categoryUuid, product.uuid),
    getRelatedProducts(product.uuid),
    getSpecificationsForKeys(specKeys),
    getViewerPartnerPricing(),
  ]);

  const attributes = specs
    .map((spec) => ({
      label: spec.label,
      value: displayValue(product.technicalAttributes?.[spec.key] ?? ""),
    }))
    .filter((attribute) => attribute.value !== "");

  const specFields = specs.map((spec) => ({
    key: spec.key,
    label: spec.label,
  }));

  return (
    <main className="min-h-screen bg-page pb-16">
      <ProductHero
        product={product}
        attributes={attributes}
        discountPercent={viewerPricing.discountPercent}
      />
      <ProductDetails product={product} />
      <ProductSpecs attributes={attributes} />
      <ProductCompare
        current={product}
        others={comparables}
        specFields={specFields}
      />
      <ProductRelated products={related} />
    </main>
  );
};

export default ProductPage;
