import { CategorySection } from "@/components/home/category-section";
import { HeroSection } from "@/components/home/hero-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProductSection } from "@/components/home/product-section";
import { getProducts } from "services";

const HomePage = async () => {
  const products = await getProducts();

  return (
    <>
      <HeroSection />
      <HowItWorks />
      <CategorySection />
      <ProductSection products={products} />
    </>
  );
};

export default HomePage;
