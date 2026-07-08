import { ProductCompare } from "@/components/product/product-compare";
import { ProductHero } from "@/components/product/product-hero";
import { ProductRelated } from "@/components/product/product-related";
import { ProductSpecs } from "@/components/product/product-specs";
import { getCurrentUser } from "@/lib/auth";
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

  const [comparables, related, user] = await Promise.all([
    getComparableProducts(product.categoryUuid, product.uuid),
    getRelatedProducts(product.uuid),
    getCurrentUser(),
  ]);

  return (
    <main className="min-h-screen bg-surface pb-16">
      <ProductHero product={product} isAuthenticated={Boolean(user)} />
      <ProductSpecs specGroups={product.specGroups ?? []} />
      <ProductCompare current={product} others={comparables} />
      <ProductRelated products={related} />
    </main>
  );
};

export default ProductPage;
