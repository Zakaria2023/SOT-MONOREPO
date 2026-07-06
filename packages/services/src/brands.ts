import { asc, eq, getTableColumns } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "../../../db";
import { Brands, SelectBrands } from "../../../db/schema/brands";

export type { SelectBrands };

export type BrandListItem = SelectBrands & {
  parentName: SelectBrands["name"] | null;
};

const ParentBrands = alias(Brands, "parent_brands");

export const getBrands = async (): Promise<BrandListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Brands),
        parentName: ParentBrands.name,
      })
      .from(Brands)
      .leftJoin(ParentBrands, eq(Brands.parentUuid, ParentBrands.uuid))
      .orderBy(asc(Brands.order));
  } catch {
    throw new Error("Failed to fetch brands");
  }
};

export const getBrand = async (
  uuid: string,
): Promise<SelectBrands | null> => {
  try {
    const [brand] = await db.select().from(Brands).where(eq(Brands.uuid, uuid));

    return brand ?? null;
  } catch {
    throw new Error("Failed to fetch brand");
  }
};
