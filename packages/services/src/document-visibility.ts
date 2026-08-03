import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { Brands } from "../../../db/schema/brands";
import { Categories } from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";

/**
 * Is this document one of the assets a storefront visitor is meant to see?
 *
 * There is no Documents table. A document id is a bare uuid written into a column
 * on whatever row happens to reference it, and the R2 object key is
 * `documents/{uuid}` with nothing recording who owns it or whether it is public.
 * So "may this caller see it" cannot be answered from the document — it has to be
 * answered by asking which column points at it.
 *
 * Everything not listed below is private by omission rather than by rule, which
 * is the safe direction: a new private column is protected the moment it exists,
 * and a new public asset simply will not serve until it is added here. The
 * columns deliberately left out are the ones that matter —
 * partner_requests.cr_certificate and vat_certificate, users.cr_certificate and
 * vat_certificate, and payouts.invoice_document. Those are a company's
 * registration papers and a supplier's invoices, and before this check any of
 * them could be fetched from the public storefront by anyone who knew the uuid.
 *
 * `images` is a JSON array of ids, so membership needs JSON_CONTAINS with the
 * value quoted as JSON rather than an equality test.
 */
export const isPublicDocument = async (
  documentId: string,
): Promise<boolean> => {
  if (!documentId) {
    return false;
  }

  try {
    // Three EXISTS in one scalar SELECT rather than a UNION of limited selects:
    // MySQL rejects LIMIT inside a UNION branch unless the branch is parenthesised,
    // and EXISTS short-circuits on the first matching row anyway. One round trip,
    // because a page of thumbnails would otherwise pay for three.
    const [rows] = await db.execute(sql`
      SELECT (
        EXISTS(
          SELECT 1 FROM ${Products}
           WHERE ${Products.image} = ${documentId}
              OR ${Products.datasheet} = ${documentId}
              OR JSON_CONTAINS(${Products.images}, JSON_QUOTE(${documentId}))
        )
        OR EXISTS(SELECT 1 FROM ${Categories} WHERE ${Categories.image} = ${documentId})
        OR EXISTS(SELECT 1 FROM ${Brands} WHERE ${Brands.image} = ${documentId})
      ) AS visible
    `);

    // mysql2 types execute() as returning a ResultSetHeader, which is what a
    // write returns; a SELECT gives rows. Narrowed through unknown rather than
    // asserted straight across, since the two shapes genuinely do not overlap.
    const [row] = rows as unknown as { visible: number | bigint }[];
    return Number(row?.visible ?? 0) === 1;
  } catch (error) {
    console.error("isPublicDocument failed:", error);
    // Deny on failure. A visibility check that opens up when the database is
    // unreachable is not a check.
    return false;
  }
};
