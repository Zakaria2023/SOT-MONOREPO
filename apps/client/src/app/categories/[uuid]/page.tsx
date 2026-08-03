import { CategorySolution } from "@/components/category/category-solution";
import { JsonLd } from "@/components/seo/json-ld";
import { getCurrentUser } from "@/lib/auth";
import { getCachedCategory } from "@/lib/data";
import { documentImageUrl } from "@/lib/documents";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { clampDescription, pageMetadata } from "@/lib/seo";
import { breadcrumbNode, collectionNode, graph } from "@/lib/structured-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductsByCategory } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const { uuid } = await params;
  const category = await getCachedCategory(uuid);

  if (!category) {
    return { title: "Category not found", robots: { index: false } };
  }

  return pageMetadata({
    title: category.name,
    description: clampDescription(
      category.description ??
        `${category.name} hardware from SOT Solutions — compare specifications, check compatibility, and add a complete ${category.name.toLowerCase()} system to your deployment.`,
    ),
    path: `/categories/${category.uuid}`,
    image: category.image ? documentImageUrl(category.image) : null,
    imageAlt: category.name,
    keywords: [category.name],
  });
};

const CategoryPage = async ({ params }: Props) => {
  const { uuid } = await params;
  const [category, products, user, viewerPricing] = await Promise.all([
    getCachedCategory(uuid),
    getProductsByCategory(uuid),
    getCurrentUser(),
    getViewerPartnerPricing(),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={graph([
          collectionNode({
            name: category.name,
            description:
              category.description ?? `${category.name} from SOT Solutions.`,
            path: `/categories/${category.uuid}`,
            items: products.map((product) => ({
              name: product.name,
              path: `/products/${product.slug}`,
            })),
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Solutions", path: "/categories" },
            { name: category.name, path: `/categories/${category.uuid}` },
          ]),
        ])}
      />
      <CategorySolution
        category={category}
        products={products}
        canAdd={Boolean(user)}
        discountPercent={viewerPricing.discountPercent}
      />
    </>
  );
};

export default CategoryPage;
