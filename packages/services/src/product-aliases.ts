import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  ProductAliases,
  SelectProductAliases,
} from "../../../db/schema/product-aliases";
import { AliasTermType } from "../../../db/enum";

export type { SelectProductAliases };

/** One alias as submitted from a form — no db-managed fields. */
export type ProductAliasInput = {
  searchTerm: string;
  termType: AliasTermType;
  label?: string | null;
};

export const getProductAliases = async (
  productUuid: string,
): Promise<SelectProductAliases[]> => {
  try {
    return await db
      .select()
      .from(ProductAliases)
      .where(eq(ProductAliases.productUuid, productUuid));
  } catch {
    throw new Error("Failed to fetch product aliases");
  }
};

/**
 * Replace a product's alias set with the given rows. Empty search terms are
 * dropped so blank editor rows never persist.
 */
export const setProductAliases = async (
  productUuid: string,
  aliases: ProductAliasInput[],
): Promise<void> => {
  try {
    await db
      .delete(ProductAliases)
      .where(eq(ProductAliases.productUuid, productUuid));

    const rows = aliases
      .filter((alias) => alias.searchTerm.trim().length > 0)
      .map((alias) => ({
        uuid: randomUUID(),
        productUuid,
        searchTerm: alias.searchTerm.trim(),
        termType: alias.termType,
        label: alias.label?.trim() || null,
      }));

    if (rows.length > 0) {
      await db.insert(ProductAliases).values(rows);
    }
  } catch {
    throw new Error("Failed to save product aliases");
  }
};
