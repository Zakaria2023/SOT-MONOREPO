import { ProductDetail } from "@/components/products/product-detail";
import { notFound } from "next/navigation";
import {
  getProductDetailByUuid,
  getProductSpecsForDisplay,
} from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

const ProductDetailPage = async ({ params }: Props) => {
  const { uuid } = await params;
  const product = await getProductDetailByUuid(uuid);

  if (!product) {
    notFound();
  }

  // Needs the product's category and values, so it cannot join the read above.
  // Costs one small query on a warm model cache.
  //
  // Asked as "admin" so the panel shows partner-only and staff-only attributes:
  // this is where the catalog is authored, and an attribute an author cannot see
  // is one they cannot notice is wrong.
  const specs = await getProductSpecsForDisplay(
    product.categoryUuid,
    product.specValues ?? {},
    "admin",
  );

  return <ProductDetail product={product} specs={specs} />;
};

export default ProductDetailPage;
