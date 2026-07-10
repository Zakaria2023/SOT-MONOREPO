import { BrandSection } from "@/components/home/brand-section";
import { CategorySection } from "@/components/home/category-section";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProductSection } from "@/components/home/product-section";
import { getBrands, getCategories, getProducts } from "services";

const HomePage = async () => {
  const [products, categories, brands] = await Promise.all([
    getProducts(),
    getCategories(),
    getBrands(),
  ]);

  return (
    <>
      <HeroSection />
      <HowItWorks />
      <CategorySection categories={categories} />
      <ProductSection products={products} />
      <BrandSection brands={brands} />
    </>
  );
};

export default HomePage;
