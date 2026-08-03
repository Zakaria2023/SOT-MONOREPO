import { BrandProducts } from "@/components/brand/brand-products";
import { JsonLd } from "@/components/seo/json-ld";
import { getCachedBrand } from "@/lib/data";
import { documentImageUrl } from "@/lib/documents";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { clampDescription, pageMetadata } from "@/lib/seo";
import { breadcrumbNode, collectionNode, graph } from "@/lib/structured-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductsByBrand } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const { uuid } = await params;
  const brand = await getCachedBrand(uuid);

  if (!brand) {
    return { title: "Brand not found", robots: { index: false } };
  }

  return pageMetadata({
    title: brand.name,
    description: clampDescription(
      brand.description ??
        `${brand.name} networking, infrastructure and security hardware, supplied and installed by SOT Solutions in Saudi Arabia.`,
    ),
    path: `/brands/${brand.uuid}`,
    image: brand.image ? documentImageUrl(brand.image) : null,
    imageAlt: brand.name,
    keywords: [brand.name, `${brand.name} Saudi Arabia`],
  });
};

const BrandPage = async ({ params }: Props) => {
  const { uuid } = await params;
  const [brand, products, viewerPricing] = await Promise.all([
    getCachedBrand(uuid),
    getProductsByBrand(uuid),
    getViewerPartnerPricing(),
  ]);

  if (!brand) {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={graph([
          collectionNode({
            name: brand.name,
            description:
              brand.description ?? `${brand.name} products from SOT Solutions.`,
            path: `/brands/${brand.uuid}`,
            items: products.map((product) => ({
              name: product.name,
              path: `/products/${product.slug}`,
            })),
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Brands", path: "/brands" },
            { name: brand.name, path: `/brands/${brand.uuid}` },
          ]),
        ])}
      />
      <BrandProducts
        brand={brand}
        products={products}
        discountPercent={viewerPricing.discountPercent}
      />
    </>
  );
};

export default BrandPage;
