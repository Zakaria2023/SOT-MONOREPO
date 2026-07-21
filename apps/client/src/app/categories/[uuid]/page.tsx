import { CategorySolution } from "@/components/category/category-solution";
import { getCurrentUser } from "@/lib/auth";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, getProductsByCategory } from "services";

type Props = {
  params: Promise<{ uuid: string }>;
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const { uuid } = await params;
  const category = await getCategory(uuid);
  return {
    title: category ? `${category.name} · SOT Solutions` : "Category",
  };
};

const CategoryPage = async ({ params }: Props) => {
  const { uuid } = await params;
  const [category, products, user, viewerPricing] = await Promise.all([
    getCategory(uuid),
    getProductsByCategory(uuid),
    getCurrentUser(),
    getViewerPartnerPricing(),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <CategorySolution
      category={category}
      products={products}
      canAdd={Boolean(user)}
      discountPercent={viewerPricing.discountPercent}
    />
  );
};

export default CategoryPage;
