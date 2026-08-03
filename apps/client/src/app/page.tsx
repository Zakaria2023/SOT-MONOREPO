import { BrandSection } from "@/components/home/brand-section";
import { CategorySection } from "@/components/home/category-section";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProductSection } from "@/components/home/product-section";
import { TechHero } from "@/components/home/tech-hero";
import { getCachedCategories } from "@/lib/data";
import { getViewerPartnerPricing } from "@/lib/partner-pricing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { getBrands, getProducts } from "services";

// Spelled out rather than inherited from the layout so the home page gets a
// self-canonical and its own OG card — the layout's defaults are a fallback for
// pages that forget, not a canonical for this one.
export const metadata: Metadata = {
  ...pageMetadata({
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    path: "/",
  }),
  // The template would otherwise render "SOT Solutions — … · SOT Solutions".
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
};

const HomePage = async () => {
  const [products, categories, brands, viewerPricing] = await Promise.all([
    getProducts(),
    getCachedCategories(),
    getBrands(),
    getViewerPartnerPricing(),
  ]);

  // Every other route wraps its content in <main>; this one was the exception,
  // leaving the home page with no main landmark for a screen reader or a
  // crawler working out where the boilerplate ends.
  return (
    <main>
      <TechHero />
      <HowItWorks />
      <CategorySection categories={categories} />
      <ProductSection
        products={products}
        discountPercent={viewerPricing.discountPercent}
      />
      <BrandSection brands={brands} />
    </main>
  );
};

export default HomePage;
