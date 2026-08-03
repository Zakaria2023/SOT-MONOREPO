import type { JsonLd as JsonLdData } from "@/lib/structured-data";

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

export const JsonLd = ({ data }: JsonLdProps) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: serialize(data) }}
  />
);
