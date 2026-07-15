"use server";

import { db } from "@/db";
import {
  InsertVendors,
  SelectVendors,
  Vendors,
} from "@/db/schema/vendors";
import { generateUuid } from "utils";
import { alias } from "drizzle-orm/mysql-core";
import { asc, eq, getTableColumns } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type VendorFields = Omit<
  InsertVendors,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

export type VendorActionResult = {
  vendorUuid?: string;
  error?: string;
  success?: boolean;
};

export type VendorListItem = SelectVendors & {
  parentName: SelectVendors["name"] | null;
};

const ParentVendors = alias(Vendors, "parent_vendors");

export const getVendors = async (): Promise<VendorListItem[]> => {
  try {
    return await db
      .select({
        ...getTableColumns(Vendors),
        parentName: ParentVendors.name,
      })
      .from(Vendors)
      .leftJoin(ParentVendors, eq(Vendors.parentUuid, ParentVendors.uuid))
      .orderBy(asc(Vendors.name));
  } catch {
    throw new Error("Failed to fetch vendors");
  }
};

export const getVendor = async (
  uuid: string,
): Promise<SelectVendors | null> => {
  try {
    const [vendor] = await db
      .select()
      .from(Vendors)
      .where(eq(Vendors.uuid, uuid));

    return vendor ?? null;
  } catch {
    throw new Error("Failed to fetch vendor");
  }
};

export const createVendor = async (
  _prevState: VendorActionResult,
  fields: VendorFields,
): Promise<VendorActionResult> => {
  const uuid = generateUuid();
  try {
    await db.insert(Vendors).values({ ...fields, uuid });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create vendor",
    };
  }

  revalidatePath("/vendors");
  redirect("/vendors");
};

export const updateVendor = async (
  uuid: string,
  _prevState: VendorActionResult,
  fields: VendorFields,
): Promise<VendorActionResult> => {
  try {
    await db.update(Vendors).set(fields).where(eq(Vendors.uuid, uuid));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update vendor",
    };
  }

  revalidatePath("/vendors");
  redirect("/vendors");
};

export const deleteVendor = async (
  uuid: string,
): Promise<VendorActionResult> => {
  try {
    await db.delete(Vendors).where(eq(Vendors.uuid, uuid));
    revalidatePath("/vendors");
    return { success: true, vendorUuid: uuid };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete vendor",
    };
  }
};
