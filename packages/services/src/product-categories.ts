import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  ProductCategories,
  SelectProductCategories,
} from "../../../db/schema/product-categories";

export type { SelectProductCategories };

export const getProductLinkedCategories = async (
  productUuid: string,
): Promise<SelectProductCategories[]> => {
  try {
    return await db
      .select()
      .from(ProductCategories)
      .where(eq(ProductCategories.productUuid, productUuid));
  } catch {
    throw new Error("Failed to fetch product linked categories");
  }
};

/**
 * Replace a product's linked (non-home) categories. Blank entries and the
 * product's own home category are the caller's concern to exclude; duplicates
 * are collapsed here.
 */
export const setProductLinkedCategories = async (
  productUuid: string,
  categoryUuids: string[],
): Promise<void> => {
  try {
    await db
      .delete(ProductCategories)
      .where(eq(ProductCategories.productUuid, productUuid));

    const unique = [...new Set(categoryUuids.filter((uuid) => uuid.length > 0))];
    if (unique.length > 0) {
      await db.insert(ProductCategories).values(
        unique.map((categoryUuid) => ({
          uuid: randomUUID(),
          productUuid,
          categoryUuid,
        })),
      );
    }
  } catch {
    throw new Error("Failed to save product linked categories");
  }
};
