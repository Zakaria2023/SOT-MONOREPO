import { BrandSection } from "@/components/home/brand-section";
import { CategorySection } from "@/components/home/category-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProductSection } from "@/components/home/product-section";
import { TechHero } from "@/components/home/tech-hero";
import { getCurrentUser } from "@/lib/auth";
import { getCachedCategories } from "@/lib/data";
import { getBrands, getProducts } from "services";

const HomePage = async () => {
  const [products, categories, brands, user] = await Promise.all([
    getProducts(),
    getCachedCategories(),
    getBrands(),
    getCurrentUser(),
  ]);

  return (
    <>
      <TechHero />
      <HowItWorks />
      <CategorySection categories={categories} />
      <ProductSection products={products} canAdd={Boolean(user)} />
      <BrandSection brands={brands} />
    </>
  );
};

export default HomePage;
