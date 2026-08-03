import type { ProductStatus } from "@/db/enum";
import { documentDownloadUrl } from "@/lib/documents";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

export type JsonLd = Record<string, unknown>;

type ProductNodeInput = {
  name: string;
  slug: string;
  sku: string | null;
  model: string | null;
  description: string | null;
  shortDescription: string | null;
  image: string | null;
  images: string[] | null;
  brandName: string | null;
  categoryName: string | null;
  price: string | null;
  currency: string | null;
  isAvailable: boolean;
  status: ProductStatus | null;
  warrantyPeriod: string | null;
  countryOfOrigin: string | null;
};

type CollectionNodeInput = {
  name: string;
  description: string;
  path: string;
  items: { name: string; path: string }[];
};

type Crumb = {
  name: string;
  path: string;
};

/**
 * Our storefront status vocabulary mapped onto schema.org's. The two are not
 * the same list, so this is a deliberate translation rather than a passthrough
 * — an unmapped value emitted raw makes Google drop the whole offer, not just
 * the one field.
 */
const AVAILABILITY: Record<ProductStatus, string> = {
  in_stock: "https://schema.org/InStock",
  out_of_stock: "https://schema.org/OutOfStock",
  limited_stock: "https://schema.org/LimitedAvailability",
  pre_order: "https://schema.org/PreOrder",
  in_order: "https://schema.org/BackOrder",
  end_of_sale: "https://schema.org/Discontinued",
  end_of_life: "https://schema.org/Discontinued",
};

/** Document ids become absolute URLs — a crawler cannot resolve a relative one. */
const imageUrls = (image: string | null, images: string[] | null): string[] => {
  const ids = [image, ...(images ?? [])].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  return [...new Set(ids)].map((id) => absoluteUrl(documentDownloadUrl(id)));
};

// No `logo` yet — there is no brand asset to point at, and a logo field aimed
// at a placeholder is worse than its absence: Google would cache the wrong mark
// as the site's identity. Add it here once the real logo exists.
export const organizationNode = (): JsonLd => ({
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  areaServed: {
    "@type": "Country",
    name: "Saudi Arabia",
  },
});

export const webSiteNode = (): JsonLd => ({
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  publisher: { "@id": `${SITE_URL}/#organization` },
  // Declares the catalog search so Google can offer a sitelinks search box.
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
});

export const breadcrumbNode = (crumbs: Crumb[]): JsonLd => ({
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: absoluteUrl(crumb.path),
  })),
});

export const productNode = (product: ProductNodeInput): JsonLd => {
  const url = absoluteUrl(`/products/${product.slug}`);
  const images = imageUrls(product.image, product.images);
  const status = product.status ?? "in_stock";
  const availability = product.isAvailable
    ? AVAILABILITY[status]
    : "https://schema.org/OutOfStock";

  const node: JsonLd = {
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    url,
    description:
      product.shortDescription ?? product.description ?? product.name,
    category: product.categoryName ?? undefined,
    sku: product.sku ?? undefined,
    mpn: product.model ?? undefined,
    image: images.length > 0 ? images : undefined,
    brand: product.brandName
      ? { "@type": "Brand", name: product.brandName }
      : undefined,
    countryOfOrigin: product.countryOfOrigin ?? undefined,
  };

  if (product.warrantyPeriod) {
    node.warranty = {
      "@type": "WarrantyPromise",
      durationOfWarranty: product.warrantyPeriod,
    };
  }

  // Only publish an offer when there is a real price. An offer with a null or
  // zero price is an invalid rich result, and Search Console reports it as an
  // error against the page rather than ignoring it.
  if (product.price && Number(product.price) > 0) {
    node.offers = {
      "@type": "Offer",
      url,
      price: Number(product.price).toFixed(2),
      priceCurrency: product.currency ?? "SAR",
      availability,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${SITE_URL}/#organization` },
    };
  }

  return node;
};

export const collectionNode = ({
  name,
  description,
  path,
  items,
}: CollectionNodeInput): JsonLd => ({
  "@type": "CollectionPage",
  "@id": `${absoluteUrl(path)}#collection`,
  name,
  description,
  url: absoluteUrl(path),
  isPartOf: { "@id": `${SITE_URL}/#website` },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  },
});

/**
 * Wraps nodes in a single `@graph`. One script tag per page beats several: the
 * nodes can then reference each other by `@id` (a product pointing at the
 * organization that sells it) instead of each repeating the same entity.
 */
export const graph = (nodes: JsonLd[]): JsonLd => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});
