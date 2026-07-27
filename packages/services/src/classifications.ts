import { asc, count, eq, getTableColumns } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import {
  Classifications,
  InsertClassifications,
  SelectClassifications,
} from "../../../db/schema/classifications";
import { Categories } from "../../../db/schema/categories";

export type { SelectClassifications };

export type ClassificationListItem = SelectClassifications & {
  categoryCount: number;
};

export type ClassificationFields = Omit<
  InsertClassifications,
  "id" | "uuid" | "createdAt" | "updatedAt"
>;

// The row selection shared by list queries: the classification columns plus
// how many categories are filed under it.
const classificationListSelection = {
  ...getTableColumns(Classifications),
  categoryCount: count(Categories.id),
};

/** Every classification with its category count, ordered by name. */
export const getClassifications = async (): Promise<
  ClassificationListItem[]
> => {
  try {
    return await db
      .select(classificationListSelection)
      .from(Classifications)
      .leftJoin(
        Categories,
        eq(Categories.classificationUuid, Classifications.uuid),
      )
      .groupBy(Classifications.id)
      .orderBy(asc(Classifications.name));
  } catch (error) {
    console.error("getClassifications failed:", error);
    throw new Error("Failed to fetch classifications", { cause: error });
  }
};

export const getClassification = async (
  uuid: string,
): Promise<SelectClassifications | null> => {
  try {
    const [classification] = await db
      .select()
      .from(Classifications)
      .where(eq(Classifications.uuid, uuid));

    return classification ?? null;
  } catch (error) {
    console.error("getClassification failed:", error);
    throw new Error("Failed to fetch classification", { cause: error });
  }
};

/** Create a classification. Returns its uuid. */
export const createClassification = async (
  fields: ClassificationFields,
): Promise<string> => {
  const uuid = generateUuid();
  await db.insert(Classifications).values({ ...fields, uuid });
  return uuid;
};

export const updateClassification = async (
  uuid: string,
  fields: ClassificationFields,
): Promise<void> => {
  await db
    .update(Classifications)
    .set(fields)
    .where(eq(Classifications.uuid, uuid));
};

// Categories reference this row with onDelete: "set null", so deleting a
// classification simply unfiles its categories rather than blocking.
export const deleteClassification = async (uuid: string): Promise<void> => {
  await db.delete(Classifications).where(eq(Classifications.uuid, uuid));
};
