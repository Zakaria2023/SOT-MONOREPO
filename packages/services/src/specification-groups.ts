import { randomUUID } from "node:crypto";
import { asc, count, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import { orderCase } from "./reorder";

export type { SelectSpecificationGroups };

export type SpecificationGroupFields = {
  name: string;
  domain: string | null;
  // The first segment of every external name filed under this group — `pwr` for
  // Power & Battery. Decided once here so no attribute author has to invent one.
  keyPrefix: string | null;
};

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
  fields: SpecificationGroupFields,
): Promise<string> => {
  const uuid = randomUUID();
  const [{ total }] = await db
    .select({ total: count() })
    .from(SpecificationGroups);

  await db.insert(SpecificationGroups).values({
    uuid,
    name: fields.name,
    domain: fields.domain,
    order: total,
  });
  return uuid;
};

export const updateSpecificationGroup = async (
  uuid: string,
  fields: SpecificationGroupFields,
): Promise<void> => {
  await db
    .update(SpecificationGroups)
    .set({
      name: fields.name,
      domain: fields.domain,
      keyPrefix: fields.keyPrefix?.trim().toLowerCase() || null,
    })
    .where(eq(SpecificationGroups.uuid, uuid));
};

export const deleteSpecificationGroup = async (uuid: string): Promise<void> => {
  // Specs in the group survive — their groupUuid is set null by the FK.
  await db
    .delete(SpecificationGroups)
    .where(eq(SpecificationGroups.uuid, uuid));
};

/** Persist a new group order: each group's `order` becomes its list index. */
export const reorderSpecificationGroups = async (
  orderedUuids: string[],
): Promise<void> => {
  if (orderedUuids.length === 0) {
    return;
  }
  await db
    .update(SpecificationGroups)
    .set({ order: orderCase(SpecificationGroups.uuid, orderedUuids) })
    .where(inArray(SpecificationGroups.uuid, orderedUuids));
};
