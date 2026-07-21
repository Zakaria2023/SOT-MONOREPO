import { BrandSection } from "@/components/home/brand-section";
import { CategorySection } from "@/components/home/category-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProductSection } from "@/components/home/product-section";
import { TechHero } from "@/components/home/tech-hero";
import { getCachedCategories } from "@/lib/data";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { getBrands, getProducts } from "services";

const HomePage = async () => {
  const [products, categories, brands, viewerPricing] = await Promise.all([
    getProducts(),
    getCachedCategories(),
    getBrands(),
    getViewerPartnerPricing(),
  ]);

  return (
    <>
      <TechHero />
      <HowItWorks />
      <CategorySection categories={categories} />
      <ProductSection
        products={products}
        discountPercent={viewerPricing.discountPercent}
      />
      <BrandSection brands={brands} />
    </>
  );
};

export default HomePage;
