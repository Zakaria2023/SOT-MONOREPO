import { asc, count, eq, getTableColumns } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "../../../db";
import { Brands, SelectBrands } from "../../../db/schema/brands";
import { Products } from "../../../db/schema/products";

export type { SelectBrands };

export type BrandListItem = SelectBrands & {
  parentName: SelectBrands["name"] | null;
  productCount: number;
};

const ParentBrands = alias(Brands, "parent_brands");

export const getBrands = async (): Promise<BrandListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Brands),
        parentName: ParentBrands.name,
        productCount: count(Products.id),
      })
      .from(Brands)
      .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
      .leftJoin(Products, eq(Products.brandUuid, Brands.uuid))
      .groupBy(Brands.id)
      .orderBy(asc(Brands.order));
  } catch (error) {
    console.error("getBrands failed:", error);
    throw new Error("Failed to fetch brands", { cause: error });
  }
};

export const getBrand = async (
  uuid: string,
): Promise<SelectBrands | null> => {
  try {
    const [brand] = await db.select().from(Brands).where(eq(Brands.uuid, uuid));

    return brand ?? null;
  } catch (error) {
    console.error("getBrand failed:", error);
    throw new Error("Failed to fetch brand", { cause: error });
  }
};
