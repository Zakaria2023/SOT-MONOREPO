import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { FlagEmojiPolyfill } from "@/components/common/flag-emoji-polyfill";
import { JsonLd } from "@/components/seo/json-ld";
import { Navbar } from "@/components/layout/navbar";
import {
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/seo";
import { graph, organizationNode, webSiteNode } from "@/lib/structured-data";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  // Resolves every relative URL below — and every page's OG image — against the
  // real origin. Without it Next emits relative OG tags, which crawlers drop.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    // Pages set only their own part; the site name is appended here so the two
    // can never disagree about how the brand is spelled.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  keywords: [
    "networking hardware",
    "structured cabling",
    "passive infrastructure",
    "security systems",
    "CCTV",
    "network switches",
    "access points",
    "Saudi Arabia",
    "system integrator",
    "bill of quantities",
  ],
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

// Always render against live data — never a build-time static snapshot.
export const dynamic = "force-dynamic";

// Separate from `metadata` because the theme colour has to match whichever
// theme THEME_SCRIPT below actually applied, and the browser reads it before
// hydration.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14161b" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

type Props = {
  children: ReactNode;
};

// Applies the saved (or system) theme before first paint to avoid a flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const RootLayout = ({ children }: Props) => (
  <ClerkProvider>
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Site-wide identity: every page inherits it, and per-page nodes
            reference these by @id rather than repeating them. */}
        <JsonLd data={graph([organizationNode(), webSiteNode()])} />
        <FlagEmojiPolyfill />
        <Navbar />
        <Breadcrumbs />
        {children}
      </body>
    </html>
  </ClerkProvider>
);

export default RootLayout;
