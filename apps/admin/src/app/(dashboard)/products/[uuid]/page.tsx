import { getProductDetail } from "@/app/(dashboard)/products/action";
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

  return <ProductDetail product={product} />;
};

export default ProductDetailPage;
