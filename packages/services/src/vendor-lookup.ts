import * as cheerio from "cheerio";
import { z } from "zod";

export const vendors = ["ajax", "huawei"] as const satisfies readonly string[];
export type Vendor = (typeof vendors)[number];

// The only place these literal URLs exist. The tool the model calls only
// ever accepts the closed `vendor` enum below — never a raw URL — so there
// is no code path (model-driven or otherwise) that can turn this into an
// SSRF vector.
const VENDOR_URLS: Record<Vendor, string> = {
  ajax: "https://ajax.systems/software/#desktop",
  huawei: "https://ekit.huawei.com/brand/en",
};

export const vendorArgsSchema = z.object({ vendor: z.enum(vendors) });
export const vendorArgsJsonSchema = z.toJSONSchema(vendorArgsSchema);

export type VendorLookupResult = {
  vendor: Vendor;
  sourceUrl: string;
  ok: boolean;
  text: string;
};

const FETCH_TIMEOUT_MS = 8000;
const MIN_USABLE_TEXT_LENGTH = 200;
const MAX_RETURNED_TEXT_LENGTH = 8000;
const CACHE_TTL_MS = 20 * 60 * 1000;
const NO_DATA_TEXT =
  "No current product data could be retrieved from this source right now.";

const cache = new Map<Vendor, { result: VendorLookupResult; expiresAt: number }>();

const extractReadableText = (html: string): string => {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, svg, noscript, iframe").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
};

// Fetches and extracts text from one of the two approved vendor pages.
// Ajax's software page is plain server-rendered HTML and extracts well.
// Huawei eKit's page is a Nuxt.js SPA shell — a plain fetch often can't see
// its JS-rendered content, so a too-short extraction is treated the same as
// a failed fetch: report "no data" rather than hand the model a fragment it
// might try to build an answer from anyway.
export const fetchVendorProductInfo = async (
  vendor: Vendor,
): Promise<VendorLookupResult> => {
  const cached = cache.get(vendor);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const sourceUrl = VENDOR_URLS[vendor];

  const result = await (async (): Promise<VendorLookupResult> => {
    try {
      const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": "SOT-SalesAssistantBot/1.0" },
      });
      if (!response.ok) {
        return { vendor, sourceUrl, ok: false, text: NO_DATA_TEXT };
      }

      const html = await response.text();
      const text = extractReadableText(html);
      if (text.length < MIN_USABLE_TEXT_LENGTH) {
        return { vendor, sourceUrl, ok: false, text: NO_DATA_TEXT };
      }

      return {
        vendor,
        sourceUrl,
        ok: true,
        text: text.slice(0, MAX_RETURNED_TEXT_LENGTH),
      };
    } catch {
      return { vendor, sourceUrl, ok: false, text: NO_DATA_TEXT };
    }
  })();

  cache.set(vendor, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
};

export const vendorLookupToolDefinition = {
  type: "function",
  function: {
    name: "lookup_vendor_products",
    description:
      "Fetch current product info from an approved vendor site: Ajax Systems (intrusion/alarm, CCTV) or Huawei eKit (network, IP telephony). Returns extracted page text, or a 'no data available' result if the source couldn't be read.",
    parameters: vendorArgsJsonSchema,
    strict: true,
  },
} as const;

// =============================================================================
// FUTURE REFERENCE — NOT INSTALLED, NOT EXECUTED, NOT WIRED IN.
// =============================================================================
//
// Once a real product catalog/database exists, RAG_LOOKUP and WEB_SEARCH stop
// being the same action (see sales-assistant.ts's note on this). This is
// where a DB-backed lookup would replace, or run before, the live vendor
// fetch above — checking our own catalog first, only falling through to a
// vendor site when nothing relevant is stored yet.
//
// A first pass, before any embeddings/vector search infra exists, can reuse
// the *real* keyword search already sitting in ./products — getProducts()
// already does a fuzzy LIKE match across name/model/sku/description/brand/
// category (see products.ts):
//
// import { getProducts, getProductsByBrand, getProductsByCategory } from "./products";
//
// type KnowledgeBaseLookupResult = {
//   ok: boolean;
//   products: ProductListItem[];
//   text: string; // products flattened into model-readable context
// };
//
// const searchProductKnowledgeBase = async (
//   query: string,
// ): Promise<KnowledgeBaseLookupResult> => {
//   const products = await getProducts({ search: query });
//   if (products.length === 0) {
//     return { ok: false, products: [], text: "" };
//   }
//   const text = products
//     .map((p) => `${p.name} (${p.sku}) — ${p.shortDescription ?? p.description ?? ""}`)
//     .join("\n");
//   return { ok: true, products, text };
// };
//
// // "Judge: Sufficient?" for this path specifically — a real relevance check,
// // not just "did we get zero rows back". A naive LIKE match can return
// // dozens of loosely-related rows; before trusting them as sufficient,
// // score/rank against the query (or, once available, an embeddings
// // similarity search) and only skip the vendor-site fallback above once
// // confident the catalog actually answers the question:
// //
// // const isSufficient = (result: KnowledgeBaseLookupResult, query: string) =>
// //   result.ok && scoreRelevance(result.products, query) > SUFFICIENCY_THRESHOLD;
//
// // Once this exists for real, the tool-calling loop in sales-assistant.ts
// // would try searchProductKnowledgeBase() first, and only fall through to
// // fetchVendorProductInfo() (or offer the model both tools and let it pick)
// // when the catalog genuinely doesn't have an answer.
//
// =============================================================================
// END FUTURE REFERENCE
// =============================================================================
