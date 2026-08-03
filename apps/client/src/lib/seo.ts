import type { Metadata } from "next";

type PageMetadataInput = {
  /** Page-specific part only — the root layout's template appends the site name. */
  title: string;
  description: string;
  /** Route path, leading slash, no origin. Becomes the canonical URL. */
  path: string;
  /** Absolute or root-relative image URL. Falls back to the site-wide OG image. */
  image?: string | null;
  imageAlt?: string;
  type?: "website" | "article";
  /**
   * Signed-in-only screens. Their content is real for the person looking at it
   * and worthless in an index — a crawler sees either a sign-in redirect or,
   * worse, a thin near-duplicate of every other account page.
   */
  noIndex?: boolean;
  keywords?: string[];
};

export const SITE_NAME = "SOT Solutions";

export const SITE_TAGLINE =
  "Networking, infrastructure & security hardware, designed and installed";

export const SITE_DESCRIPTION =
  "Design a complete networking, passive infrastructure or security system from a single catalog — SOT Solutions supplies the hardware, validates the design, and installs it.";

export const SITE_LOCALE = "en_SA";

/**
 * The public origin, used for canonicals, OG URLs and the sitemap. Set
 * NEXT_PUBLIC_SITE_URL per environment; the fallback keeps local builds and
 * previews from emitting `undefined` into a canonical tag, which is worse than
 * a wrong-but-well-formed one.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://i.sot.com.sa"
).replace(/\/$/, "");

export const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * The generated card from app/opengraph-image.tsx. Named explicitly because a
 * page that returns its own `openGraph` object replaces the inherited one
 * wholesale — the file convention does NOT merge back in, so a product with no
 * photo would ship with no og:image at all.
 */
export const DEFAULT_OG_IMAGE = "/opengraph-image";

/**
 * Every page's metadata goes through here so a canonical, an OG card and a
 * Twitter card can never drift apart — the failure mode of hand-writing these
 * per page is that one of the three quietly goes missing.
 */
export const pageMetadata = ({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
  noIndex = false,
  keywords,
}: PageMetadataInput): Metadata => {
  const url = absoluteUrl(path);
  // Dimensions are declared only for the generated card, whose size we know.
  // A product photo is whatever the supplier uploaded, and stating 1200x630 for
  // a square one makes Twitter crop against a box that was never true.
  const images = image
    ? [{ url: image, alt: imageAlt ?? title }]
    : [
        {
          url: DEFAULT_OG_IMAGE,
          alt: imageAlt ?? title,
          width: 1200,
          height: 630,
        },
      ];

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((entry) => entry.url),
    },
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : undefined,
  };
};

/**
 * Trim a description to something a search result will actually show. Google
 * renders roughly 155-160 characters; anything past that is invisible weight,
 * and a mid-word cut reads as broken.
 */
export const clampDescription = (text: string, limit = 158): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:\-\s]+$/, "")}…`;
};
