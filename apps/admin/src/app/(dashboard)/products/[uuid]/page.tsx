import {
  getProductDetail,
  getProductSpecs,
} from "@/app/(dashboard)/products/action";
import { ProductDetail } from "@/components/products/product-detail";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ uuid: string }>;
};

const ProductDetailPage = async ({ params }: Props) => {
  const { uuid } = await params;
  const product = await getProductDetail(uuid);

  if (!product) {
    notFound();
  }

  // Needs the product's category and values, so it cannot join the read above.
  // Costs one small query on a warm model cache.
  const specs = await getProductSpecs(
    product.categoryUuid,
    product.specValues ?? {},
  );

  return <ProductDetail product={product} specs={specs} />;
};

export default ProductDetailPage;
