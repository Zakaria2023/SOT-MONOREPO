import type { JsonLd as JsonLdData } from "@/lib/structured-data";
import { headers } from "next/headers";

type JsonLdProps = {
  data: JsonLdData;
};

/**
 * `<` is escaped because a product name or description containing `</script>`
 * would otherwise close this tag and hand the rest of the payload to the parser
 * as markup. The escape is invisible to a JSON parser, so crawlers read it
 * unchanged.
 */
const serialize = (data: JsonLdData): string =>
  JSON.stringify(data).replace(/</g, "\\u003c");

/**
 * Reads the CSP nonce itself rather than taking it as a prop.
 *
 * Four pages render structured data, and a missing nonce does not fail loudly:
 * CSP blocks the tag, the JSON-LD quietly stops reaching crawlers, and the only
 * symptom is rich results vanishing weeks later. Threading a prop through four
 * call sites is four chances to forget one. Reading the header here cannot be
 * forgotten.
 */
export const JsonLd = async ({ data }: JsonLdProps) => {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning for the same reason as the theme script in the
    // root layout: the browser hides the nonce attribute after parsing, so
    // hydration sees nonce="" where the server sent a value.
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
};
