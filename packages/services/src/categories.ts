import { asc, eq, getTableColumns } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "../../../db";
import { Categories, SelectCategories } from "../../../db/schema/categories";

export type CategoryListItem = SelectCategories & {
  parentName: SelectCategories["name"] | null;
};

const ParentCategories = alias(Categories, "parent_categories");

export const getCategories = async (): Promise<CategoryListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Categories),
        parentName: ParentCategories.name,
      })
      .from(Categories)
      .leftJoin(ParentCategories, eq(Categories.parentUuid, ParentCategories.uuid))
      .orderBy(asc(Categories.order));
  } catch {
    throw new Error("Failed to fetch categories");
  }
};

export const getCategory = async (
  uuid: string,
): Promise<SelectCategories | null> => {
  try {
    const [category] = await db
      .select()
      .from(Categories)
      .where(eq(Categories.uuid, uuid));

    return category ?? null;
  } catch {
    throw new Error("Failed to fetch category");
  }
};
