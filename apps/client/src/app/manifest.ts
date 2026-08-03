import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo";
import type { MetadataRoute } from "next";

const manifest = (): MetadataRoute.Manifest => ({
  name: `${SITE_NAME} — ${SITE_TAGLINE}`,
  short_name: SITE_NAME,
  description: SITE_DESCRIPTION,
  start_url: "/",
  display: "standalone",
  background_color: "#f5f4fa",
  theme_color: "#7c3aed",
  categories: ["business", "shopping"],
  // `icons` deliberately omitted until there is a real logo. An installed app
  // then falls back to the existing favicon rather than to a placeholder mark.
});

export default manifest;
