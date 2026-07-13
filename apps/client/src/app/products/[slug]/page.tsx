import { ProductCompare } from "@/components/product/product-compare";
import { ProductDetails } from "@/components/product/product-details";
import { ProductHero } from "@/components/product/product-hero";
import { ProductRelated } from "@/components/product/product-related";
import { ProductSpecs } from "@/components/product/product-specs";
import { notFound } from "next/navigation";
import {
  getComparableProducts,
  getProductDetailBySlug,
  getRelatedProducts,
} from "services";

type Props = {
  params: Promise<{ slug: string }>;
};

const ProductPage = async ({ params }: Props) => {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);
  if (!product) notFound();

  const [comparables, related] = await Promise.all([
    getComparableProducts(product.categoryUuid, product.uuid),
    getRelatedProducts(product.uuid),
  ]);

  // Products inherit their spec structure from their category, so fall back to
  // the category's highlights / spec groups when the product has none of its own.
  const highlights =
    (product.highlights?.length
      ? product.highlights
      : product.category?.highlights) ?? [];
  const specGroups =
    (product.specGroups?.length
      ? product.specGroups
      : product.category?.specGroups) ?? [];

  // Machine-reasonable specs: the category template gives labels + order; the
  // product's technicalAttributes gives the chosen values.
  const attributes = (product.category?.specTemplate ?? [])
    .map((field) => ({
      label: field.label,
      value: product.technicalAttributes?.[field.key] ?? "",
    }))
    .filter((attribute) => attribute.value.length > 0);

  return (
    <main className="min-h-screen bg-surface pb-16">
      <ProductHero product={product} highlights={highlights} />
      <ProductDetails product={product} />
      <ProductSpecs specGroups={specGroups} attributes={attributes} />
      <ProductCompare
        current={product}
        others={comparables}
        categoryHighlights={product.category?.highlights ?? []}
      />
      <ProductRelated products={related} />
    </main>
  );
};

export default ProductPage;
