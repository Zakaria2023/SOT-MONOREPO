import { SITE_URL, absoluteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";

/**
 * Auth-gated routes: a crawler only ever gets a redirect to /sign-in, so every
 * fetch is budget spent on nothing. Blocked here rather than with `noindex`
 * because they are unreachable without a session — nobody links to them, so
 * there is no URL-only listing to suppress.
 */
const PRIVATE_PATHS = [
  "/api/",
  "/cart",
  "/orders",
  "/offers",
  "/boq/",
  "/complete-profile",
  "/sso-callback",
];

/**
 * The auth screens are deliberately NOT listed above. They are publicly
 * reachable and do attract links, and a blocked URL can still be indexed
 * title-only — Google never fetches it, so it never sees the noindex it was
 * sent. Letting it crawl these and read `robots: noindex` on the page is the
 * only combination that actually keeps them out.
 */

const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
  ],
  sitemap: absoluteUrl("/sitemap.xml"),
  host: SITE_URL,
});

export default robots;
