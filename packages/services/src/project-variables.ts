import { randomUUID } from "node:crypto";
import { asc, count, eq, or } from "drizzle-orm";
import { slugify } from "utils";
import { db } from "../../../db";
import { CompatibilityRules } from "../../../db/schema/compatibility-rules";
import {
  InsertProjectVariables,
  ProjectVariables,
  SelectProjectVariables,
} from "../../../db/schema/project-variables";

export type { SelectProjectVariables };

export type ProjectVariableFields = Omit<
  InsertProjectVariables,
  "id" | "uuid" | "key" | "order" | "createdAt" | "updatedAt"
>;

// A variable plus how many rules read it — deleting one that rules depend on
// would silently disable those rules, so the count is shown before the act.
export type ProjectVariableListItem = SelectProjectVariables & {
  ruleCount: number;
};

// A unique key derived from the label, so a BOQ's stored answers survive a
// rename of the question.
const uniqueKey = (label: string, taken: Set<string>): string => {
  const base = slugify(label) || "variable";
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
};

export const getProjectVariables = async (): Promise<
  ProjectVariableListItem[]
> => {
  try {
    const [variables, rules] = await Promise.all([
      db.select().from(ProjectVariables).orderBy(asc(ProjectVariables.order)),
      db
        .select({
          consumer: CompatibilityRules.consumerVariableUuid,
          provider: CompatibilityRules.providerVariableUuid,
        })
        .from(CompatibilityRules),
    ]);

    const uses = new Map<string, number>();
    for (const rule of rules) {
      for (const uuid of [rule.consumer, rule.provider]) {
        if (uuid) {
          uses.set(uuid, (uses.get(uuid) ?? 0) + 1);
        }
      }
    }

    return variables.map((variable) => ({
      ...variable,
      ruleCount: uses.get(variable.uuid) ?? 0,
    }));
  } catch (error) {
    console.error("getProjectVariables failed:", error);
    throw new Error("Failed to fetch project variables", { cause: error });
  }
};

export const createProjectVariable = async (
  fields: ProjectVariableFields,
): Promise<string> => {
  const uuid = randomUUID();
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ key: ProjectVariables.key })
      .from(ProjectVariables);
    const [{ total }] = await tx
      .select({ total: count() })
      .from(ProjectVariables);
    await tx.insert(ProjectVariables).values({
      ...fields,
      uuid,
      key: uniqueKey(fields.label, new Set(existing.map((row) => row.key))),
      order: total,
    });
  });
  return uuid;
};

// The key is deliberately NOT rewritten on update: BOQs store their answers
// under it, so a rename would orphan every answer already given.
export const updateProjectVariable = async (
  uuid: string,
  fields: ProjectVariableFields,
): Promise<void> => {
  await db
    .update(ProjectVariables)
    .set(fields)
    .where(eq(ProjectVariables.uuid, uuid));
};

export const deleteProjectVariable = async (uuid: string): Promise<void> => {
  const [inUse] = await db
    .select({ total: count() })
    .from(CompatibilityRules)
    .where(
      or(
        eq(CompatibilityRules.consumerVariableUuid, uuid),
        eq(CompatibilityRules.providerVariableUuid, uuid),
      ),
    );

  const total = Number(inUse?.total ?? 0);
  if (total > 0) {
    throw new Error(
      `${total} rule(s) read this variable. Point them elsewhere before deleting it.`,
    );
  }
  await db.delete(ProjectVariables).where(eq(ProjectVariables.uuid, uuid));
};
