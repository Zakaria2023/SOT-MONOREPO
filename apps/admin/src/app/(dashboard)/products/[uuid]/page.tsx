import { ProductDetail } from "@/components/products/product-detail";
import { notFound } from "next/navigation";
import {
  getCompatibilityLinks,
  getCompositionLinks,
  getLinkableProducts,
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
  //
  // The three link reads go out WITH it rather than after: they share nothing
  // with each other, and run serially they would add three round trips to a page
  // that already waited for two.
  const [specs, compatibility, composition, linkable] = await Promise.all([
    getProductSpecsForDisplay(
      product.categoryUuid,
      product.specValues ?? {},
      "admin",
    ),
    getCompatibilityLinks(uuid),
    getCompositionLinks(uuid),
    getLinkableProducts(uuid),
  ]);

  return (
    <ProductDetail
      product={product}
      specs={specs}
      compatibility={compatibility}
      composition={composition}
      linkable={linkable}
    />
  );
};

export default ProductDetailPage;
