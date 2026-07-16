import { randomUUID } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";

export type { SelectSpecificationGroups };

export const getSpecificationGroups = async (): Promise<
  SelectSpecificationGroups[]
> => {
  try {
    return await db
      .select()
      .from(SpecificationGroups)
      .orderBy(asc(SpecificationGroups.order));
  } catch (error) {
    console.error("getSpecificationGroups failed:", error);
    throw new Error("Failed to fetch specification groups", { cause: error });
  }
};

export const createSpecificationGroup = async (
  name: string,
): Promise<string> => {
  const uuid = randomUUID();
  const [{ total }] = await db
    .select({ total: count() })
    .from(SpecificationGroups);

  await db.insert(SpecificationGroups).values({ uuid, name, order: total });
  return uuid;
};

export const updateSpecificationGroup = async (
  uuid: string,
  name: string,
): Promise<void> => {
  await db
    .update(SpecificationGroups)
    .set({ name })
    .where(eq(SpecificationGroups.uuid, uuid));
};

export const deleteSpecificationGroup = async (
  uuid: string,
): Promise<void> => {
  // Specs in the group survive — their groupUuid is set null by the FK.
  await db
    .delete(SpecificationGroups)
    .where(eq(SpecificationGroups.uuid, uuid));
};
