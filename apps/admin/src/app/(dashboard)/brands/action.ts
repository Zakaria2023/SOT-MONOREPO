"use server";

import { db } from "@/db";
import { Brands, SelectBrands } from "@/db/schema/brands";
import { asc } from "drizzle-orm";

export const getBrands = async (): Promise<SelectBrands[]> => {
  try {
    return await db.select().from(Brands).orderBy(asc(Brands.order));
  } catch {
    throw new Error("Failed to fetch brands");
  }
};
