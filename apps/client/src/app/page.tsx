import { BrandSection } from "@/components/home/brand-section";
import { CategorySection } from "@/components/home/category-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProductSection } from "@/components/home/product-section";
import { TechHero } from "@/components/home/tech-hero";
import { getCachedCategories } from "@/lib/data";
import { getBrands, getProducts } from "services";

const HomePage = async () => {
  const [products, categories, brands] = await Promise.all([
    getProducts(),
    getCachedCategories(),
    getBrands(),
  ]);

  return (
    <>
      <TechHero />
      <HowItWorks />
      <CategorySection categories={categories} />
      <ProductSection products={products} />
      <BrandSection brands={brands} />
    </>
  );
};

export default HomePage;
