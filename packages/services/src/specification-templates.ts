import { randomUUID } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import { db } from "../../../db";
import { SpecificationGroups } from "../../../db/schema/specification-groups";
import {
  SelectSpecificationTemplates,
  SpecificationTemplates,
} from "../../../db/schema/specification-templates";
import { Specifications } from "../../../db/schema/specifications";

export type { SelectSpecificationTemplates };

export const getSpecificationTemplates = async (): Promise<
  SelectSpecificationTemplates[]
> =>
  db
    .select()
    .from(SpecificationTemplates)
    .orderBy(asc(SpecificationTemplates.order));

export const createSpecificationTemplate = async (
  name: string,
  attributeKeys: string[],
): Promise<string> => {
  const uuid = randomUUID();
  const [{ total }] = await db
    .select({ total: count() })
    .from(SpecificationTemplates);
  await db
    .insert(SpecificationTemplates)
    .values({ uuid, name, attributeKeys, order: total });
  return uuid;
};

/** Bundle every attribute in a group into a new reusable template. */
export const createTemplateFromGroup = async (
  groupUuid: string,
  name?: string,
): Promise<string> => {
  const [group] = await db
    .select()
    .from(SpecificationGroups)
    .where(eq(SpecificationGroups.uuid, groupUuid));
  const specs = await db
    .select({ key: Specifications.key })
    .from(Specifications)
    .where(eq(Specifications.groupUuid, groupUuid))
    .orderBy(asc(Specifications.order));
  return createSpecificationTemplate(
    name ?? group?.name ?? "Template",
    specs.map((spec) => spec.key),
  );
};

export const updateSpecificationTemplate = async (
  uuid: string,
  name: string,
  attributeKeys: string[],
): Promise<void> => {
  await db
    .update(SpecificationTemplates)
    .set({ name, attributeKeys })
    .where(eq(SpecificationTemplates.uuid, uuid));
};

export const deleteSpecificationTemplate = async (
  uuid: string,
): Promise<void> => {
  await db
    .delete(SpecificationTemplates)
    .where(eq(SpecificationTemplates.uuid, uuid));
};
