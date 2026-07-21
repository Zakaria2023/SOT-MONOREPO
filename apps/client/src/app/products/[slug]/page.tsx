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
  getSpecificationsForCategory,
} from "services";

type Props = {
  params: Promise<{ slug: string }>;
};

type SpecTemplateNode = {
  key: string;
  label: string;
  options: { value: string; children: SpecTemplateNode[] }[];
};

// Walk the template along the product's chosen values: a field shows only when
// filled, and an option's sub-fields show only when that option is selected.
const flattenSpecAttributes = (
  fields: SpecTemplateNode[],
  values: Record<string, string> | null | undefined,
): { label: string; value: string }[] =>
  fields.flatMap((field) => {
    const value = values?.[field.key] ?? "";
    if (!value) {
      return [];
    }
    const option = field.options.find((candidate) => candidate.value === value);
    return [
      { label: field.label, value },
      ...(option ? flattenSpecAttributes(option.children, values) : []),
    ];
  });

// Every field in the template (ignoring selection) — the stable column set for
// the comparison table, where each product fills in its own chosen value.
const collectSpecFields = (
  fields: SpecTemplateNode[],
): { key: string; label: string }[] =>
  fields.flatMap((field) => [
    { key: field.key, label: field.label },
    ...field.options.flatMap((option) => collectSpecFields(option.children)),
  ]);

const ProductPage = async ({ params }: Props) => {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);
  if (!product) notFound();

  const [comparables, related, specTemplate, viewerPricing] = await Promise.all([
    getComparableProducts(product.categoryUuid, product.uuid),
    getRelatedProducts(product.uuid),
    getSpecificationsForCategory(product.categoryUuid),
    getViewerPartnerPricing(),
  ]);

  // Spec template = the specifications assigned to this product's category (and
  // its ancestors). `attributes` follows the product's selected path (skipping
  // branches it didn't choose); `specFields` is every field, for the compare
  // columns.
  const attributes = flattenSpecAttributes(
    specTemplate,
    product.technicalAttributes,
  );
  const specFields = collectSpecFields(specTemplate);

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
