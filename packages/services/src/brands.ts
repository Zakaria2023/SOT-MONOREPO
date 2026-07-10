import { asc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { Brands, SelectBrands } from "../../../db/schema/brands";

export type { SelectBrands };

export const getBrands = async (): Promise<SelectBrands[]> => {
  try {
    return await db.select().from(Brands).orderBy(asc(Brands.order));
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
