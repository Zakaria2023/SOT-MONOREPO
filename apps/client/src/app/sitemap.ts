import { absoluteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";
import { getBrands, getCategories, getProducts } from "services";

/**
 * Rebuilt hourly rather than at build time. Prerendered once, it would freeze
 * the catalog as it stood at deploy and never list a product added since —
 * the same static-snapshot trap the layouts carry `force-dynamic` for. Cached
 * rather than fully dynamic because a crawler hitting it repeatedly must not
 * turn into three catalog-wide reads per request.
 */
export const revalidate = 3600;

// Three reads for the whole sitemap — the lists are already batched, so this
// never fans out per row against a connection pool the other apps share.
const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const [products, categories, brands] = await Promise.all([
    // A sitemap is read by crawlers, so it lists what a signed-out visitor can
    // see and nothing else. A trade-only product listed here would be indexed,
    // linked from search results, and 404 for everyone who clicked it.
    getProducts({ viewer: "user" }),
    getCategories(),
    getBrands(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    {
      url: absoluteUrl("/categories"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: absoluteUrl("/brands"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/partner"), changeFrequency: "monthly", priority: 0.5 },
  ];

  // `lastModified` comes from the row's own updatedAt, not from now() — a
  // sitemap that claims every URL changed on every fetch teaches crawlers to
  // stop trusting the field, and they then recrawl on their own schedule.
  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: absoluteUrl(`/categories/${category.uuid}`),
    lastModified: category.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const brandRoutes: MetadataRoute.Sitemap = brands.map((brand) => ({
    url: absoluteUrl(`/brands/${brand.uuid}`),
    lastModified: brand.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...productRoutes,
    ...categoryRoutes,
    ...brandRoutes,
  ];
};

export default sitemap;
