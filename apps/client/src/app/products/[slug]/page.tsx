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
import { formatSpecValue } from "utils";

type Props = {
  params: Promise<{ slug: string }>;
};

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

  // Values are rendered through the shared formatter, so a range reads
  // "220 – 240 V" and a plain number carries its unit — same as the admin form.
  const attributes = specs
    .map((spec) => ({
      label: spec.label,
      group: spec.groupName,
      value: formatSpecValue(product.technicalAttributes?.[spec.key], spec.unit),
    }))
    .filter((attribute) => attribute.value !== "");

  // Sectioned by library group, groups in first-seen order so the table reads
  // the way the library is organised. Ungrouped attributes trail behind.
  const specGroups = attributes.reduce<
    { name: string | null; attributes: typeof attributes }[]
  >((groups, attribute) => {
    const existing = groups.find((group) => group.name === attribute.group);
    if (existing) {
      existing.attributes.push(attribute);
    } else {
      groups.push({ name: attribute.group, attributes: [attribute] });
    }
    return groups;
  }, []);

  const specFields = specs.map((spec) => ({
    key: spec.key,
    label: spec.label,
    unit: spec.unit,
  }));

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
        specFields={specFields}
      />
      <ProductRelated products={related} />
    </main>
  );
};

export default ProductPage;
