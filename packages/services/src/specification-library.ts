import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { generateUuid, slugify } from "utils";
import { db } from "../../../db";
import type { AssignmentAudience, SpecificationType } from "../../../db/enum";
import { isOptionBacked } from "../../../db/enum";
import { ProjectVariables } from "../../../db/schema/project-variables";
import { Relationships } from "../../../db/schema/relationships";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import {
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";
import { SpecificationGroups } from "../../../db/schema/specification-groups";
import {
  operandSpecUuid,
  predicateAttributes,
  type SpecGroupField,
  type SpecOption,
} from "../../../db/types";
import { recordAudit } from "./catalog-audit";
import { invalidateCatalogModel } from "./catalog-model";
import { ValidationError } from "./errors";
// Option identity lives in its own module because this one opens a database
// connection on import, and that logic has to be testable on its own.
import {
  mergeGroupFields,
  mergeOptions,
  type LibraryGroupFieldInput,
  type LibraryOptionInput,
} from "./library-options";

// ---------------------------------------------------------------------------
// THE LIBRARY SERVICE — authoring attribute definitions.
//
// Everything here protects two properties the whole model rests on:
//
//   1. An attribute's IDENTITY never changes. The uuid is the only thing
//      anything points at, so a rename is free and can never orphan a value.
//   2. An attribute nothing references may be deleted; one that IS referenced
//      may not. A cascade would silently delete a safety rule because somebody
//      tidied the library, and the first anyone would know is a cart that stopped
//      being checked.
//
// It also refuses to write category links. Assignments have exactly one writer
// (the assignment service) — two screens writing the same table is how their
// switches end up overwriting each other.
// ---------------------------------------------------------------------------

export type LibraryAttributeInput = {
  groupUuid: string | null;
  label: string;
  internalName: string | null;
  description: string | null;
  type: SpecificationType;
  unit: string | null;
  ordered: boolean;
  // Only meaningful on `number`. Whether a product answers with a span.
  allowRange: boolean;
  audience: AssignmentAudience;
  options: LibraryOptionInput[];
  // Only meaningful on `group`. The sub-fields one repeatable row carries.
  groupFields: LibraryGroupFieldInput[];
};

export type LibraryAttribute = {
  uuid: string;
  groupUuid: string | null;
  label: string;
  internalName: string | null;
  description: string | null;
  key: string;
  type: SpecificationType;
  unit: SelectSpecifications["unit"];
  ordered: boolean;
  allowRange: SelectSpecifications["allowRange"];
  audience: AssignmentAudience;
  options: SpecOption[];
  // Only populated on `group`. Empty for every other type.
  groupFields: SpecGroupField[];
  order: number;
  // The categories that carry it directly. Drives the picker on the library
  // form; the assignments screen still owns every switch on those rows.
  categoryUuids: string[];
  // How many relationships reference it — the "you cannot delete this yet" badge,
  // shown before the author tries.
  relationshipCount: number;
  categoryCount: number;
};

export type LibraryGroup = {
  uuid: string;
  name: string;
  domain: string | null;
  order: number;
  attributes: LibraryAttribute[];
};

/** A slug for exports and the AI layer. Not identity — free to change. */
const uniqueKey = (label: string, taken: Set<string>): string => {
  const base = slugify(label) || "attribute";
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

const assertValidInput = (input: LibraryAttributeInput): void => {
  if (input.label.trim() === "") {
    throw new ValidationError("An attribute needs a name.");
  }
  if (isOptionBacked(input.type) && input.options.length === 0) {
    throw new ValidationError(
      `"${input.label}" is a ${input.type.replace("_", "-")} attribute, so it needs at least one option.`,
    );
  }
  if (input.type === "number" && !input.unit) {
    throw new ValidationError(
      `"${input.label}" is a number, so it needs a unit — otherwise no rule can safely compare it against anything.`,
    );
  }
  if (input.ordered && !isOptionBacked(input.type)) {
    throw new ValidationError(
      "Only single-select and multi-select attributes can be marked as an ordered scale.",
    );
  }
  if (input.type === "group") {
    // THE guarantee that lets AttributeMeta.groupFields stay optional: a group
    // with no schema is a value nothing can decode, and the readers would report
    // it as empty rather than as broken — a switch with no readable ports passing
    // a port check looks exactly like a switch that passed.
    const named = input.groupFields.filter(
      (field) => field.label.trim() !== "",
    );
    if (named.length === 0) {
      throw new ValidationError(
        `"${input.label}" holds repeatable rows, so it needs at least one sub-field — otherwise a row has nothing in it to read.`,
      );
    }
    const bare = named.find(
      (field) => field.kind === "select" && field.options.length === 0,
    );
    if (bare) {
      throw new ValidationError(
        `The "${bare.label}" sub-field is a pick, so it needs at least one option.`,
      );
    }
  }
};

/** Groups in order, each with its attributes and reference counts. */
export const getLibrary = async (): Promise<LibraryGroup[]> => {
  const [groups, specs, rules, links] = await Promise.all([
    db
      .select()
      .from(SpecificationGroups)
      .orderBy(asc(SpecificationGroups.order)),
    db.select().from(Specifications).orderBy(asc(Specifications.order)),
    db.select().from(Relationships),
    db
      .select({
        specificationUuid: SpecificationCategories.specificationUuid,
        categoryUuid: SpecificationCategories.categoryUuid,
      })
      .from(SpecificationCategories),
  ]);

  const relationshipCount = new Map<string, number>();
  for (const rule of rules) {
    for (const uuid of referencedAttributeUuids(rule)) {
      relationshipCount.set(uuid, (relationshipCount.get(uuid) ?? 0) + 1);
    }
  }

  const categoriesBySpec = new Map<string, string[]>();
  for (const link of links) {
    const list = categoriesBySpec.get(link.specificationUuid) ?? [];
    list.push(link.categoryUuid);
    categoriesBySpec.set(link.specificationUuid, list);
  }

  const toAttribute = (spec: SelectSpecifications): LibraryAttribute => ({
    uuid: spec.uuid,
    groupUuid: spec.groupUuid,
    label: spec.label,
    internalName: spec.internalName,
    description: spec.description,
    key: spec.key,
    type: spec.type,
    unit: spec.unit,
    ordered: spec.ordered,
    allowRange: spec.allowRange,
    audience: spec.audience,
    options: spec.options ?? [],
    groupFields: spec.groupFields ?? [],
    order: spec.order,
    categoryUuids: categoriesBySpec.get(spec.uuid) ?? [],
    relationshipCount: relationshipCount.get(spec.uuid) ?? 0,
    categoryCount: (categoriesBySpec.get(spec.uuid) ?? []).length,
  });

  const byGroup = new Map<string, LibraryAttribute[]>();
  const ungrouped: LibraryAttribute[] = [];
  for (const spec of specs) {
    const attribute = toAttribute(spec);
    if (!spec.groupUuid) {
      ungrouped.push(attribute);
      continue;
    }
    const list = byGroup.get(spec.groupUuid) ?? [];
    list.push(attribute);
    byGroup.set(spec.groupUuid, list);
  }

  const result: LibraryGroup[] = groups.map((group) => ({
    uuid: group.uuid,
    name: group.name,
    domain: group.domain,
    order: group.order,
    attributes: byGroup.get(group.uuid) ?? [],
  }));

  if (ungrouped.length > 0) {
    result.push({
      uuid: "",
      name: "Ungrouped",
      domain: null,
      order: Number.MAX_SAFE_INTEGER,
      attributes: ungrouped,
    });
  }
  return result;
};

/**
 * Every attribute uuid a relationship references, across all of its parts —
 * both operands, both side filters, the lookup table's rows and columns, and the
 * presence trigger and alternatives.
 *
 * This is what makes the deletion guard trustworthy: miss one place and the
 * guard passes while a live rule quietly breaks.
 */
export const referencedAttributeUuids = (
  rule: typeof Relationships.$inferSelect,
): string[] => {
  const found = new Set<string>();
  const add = (uuid: string | null): void => {
    if (uuid) {
      found.add(uuid);
    }
  };

  add(operandSpecUuid(rule.consumer ?? null));
  add(operandSpecUuid(rule.provider ?? null));
  predicateAttributes(rule.consumerWhen ?? null).forEach(add);
  predicateAttributes(rule.providerWhen ?? null).forEach(add);

  if (rule.lookup) {
    rule.lookup.inputs.forEach(add);
    for (const row of rule.lookup.rows) {
      predicateAttributes(row.when).forEach(add);
    }
  }
  if (rule.presence) {
    predicateAttributes(rule.presence.trigger).forEach(add);
    for (const requirement of rule.presence.requires) {
      for (const alternative of requirement.satisfiedBy) {
        if (alternative.type === "item_exists") {
          predicateAttributes(alternative.predicate).forEach(add);
        }
      }
    }
  }
  return [...found];
};

/**
 * The categories that carry an attribute directly — its own rows, not the
 * descendants that inherit them.
 *
 * Read-only here. Writing a category link is the assignment service's job, and
 * keeping the write in one place is what stops two screens disagreeing about what
 * a link means.
 */
export const getAttributeCategories = async (
  specificationUuid: string,
): Promise<string[]> => {
  const rows = await db
    .select({ categoryUuid: SpecificationCategories.categoryUuid })
    .from(SpecificationCategories)
    .where(eq(SpecificationCategories.specificationUuid, specificationUuid));
  return rows.map((row) => row.categoryUuid);
};

export const createLibraryAttribute = async (
  input: LibraryAttributeInput,
  actor?: { uuid: string; name: string },
): Promise<string> => {
  assertValidInput(input);
  const uuid = generateUuid();

  const [existing, [total]] = await Promise.all([
    db.select({ key: Specifications.key }).from(Specifications),
    db.select({ value: count() }).from(Specifications),
  ]);

  await db.insert(Specifications).values({
    uuid,
    groupUuid: input.groupUuid,
    label: input.label.trim(),
    internalName: input.internalName?.trim() || null,
    description: input.description?.trim() || null,
    key: uniqueKey(input.label, new Set(existing.map((row) => row.key))),
    type: input.type,
    unit: input.type === "number" ? input.unit?.trim() || null : null,
    ordered: isOptionBacked(input.type) ? input.ordered : false,
    // Normalised to its own type, exactly as `ordered` is: a select that claimed
    // allowRange would leave the product form with no honest control to render.
    allowRange: input.type === "number" ? input.allowRange : false,
    audience: input.audience,
    options: isOptionBacked(input.type)
      ? mergeOptions([], input.options, input.ordered)
      : [],
    groupFields:
      input.type === "group" ? mergeGroupFields([], input.groupFields) : [],
    order: Number(total?.value ?? 0),
  });

  await recordAudit({
    target: "specification",
    action: "create",
    targetUuid: uuid,
    targetLabel: input.label,
    actor,
  });
  invalidateCatalogModel();
  return uuid;
};

/**
 * Update a definition. The uuid and the key are BOTH preserved: nothing points
 * at the key, but changing it would churn every export and read model for no
 * benefit.
 *
 * Changing an attribute's TYPE is refused once it holds a master option list or
 * is referenced by a rule — a select silently becoming a number turns every
 * stored value into an unreadable one.
 */
export const updateLibraryAttribute = async (
  uuid: string,
  input: LibraryAttributeInput,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  assertValidInput(input);

  const [current] = await db
    .select()
    .from(Specifications)
    .where(eq(Specifications.uuid, uuid));
  if (!current) {
    throw new ValidationError("That attribute no longer exists.");
  }

  if (current.type !== input.type) {
    const references = await countReferences(uuid);
    if (references.relationships > 0) {
      throw new ValidationError(
        `"${current.label}" is used by ${references.relationships} rule(s), so its type cannot change. Create a new attribute instead.`,
      );
    }
  }

  const nextOrdered = isOptionBacked(input.type) ? input.ordered : false;
  await db
    .update(Specifications)
    .set({
      groupUuid: input.groupUuid,
      label: input.label.trim(),
      internalName: input.internalName?.trim() || null,
      description: input.description?.trim() || null,
      type: input.type,
      unit: input.type === "number" ? input.unit?.trim() || null : null,
      ordered: nextOrdered,
      allowRange: input.type === "number" ? input.allowRange : false,
      audience: input.audience,
      options: isOptionBacked(input.type)
        ? mergeOptions(current.options ?? [], input.options, nextOrdered)
        : [],
      groupFields:
        input.type === "group"
          ? mergeGroupFields(current.groupFields ?? [], input.groupFields)
          : [],
    })
    .where(eq(Specifications.uuid, uuid));

  await recordAudit({
    target: "specification",
    action: "update",
    targetUuid: uuid,
    targetLabel: input.label,
    actor,
    changes: diffAttribute(current, input),
  });
  invalidateCatalogModel();
};

const diffAttribute = (
  before: SelectSpecifications,
  after: LibraryAttributeInput,
): { field: string; from: unknown; to: unknown }[] => {
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  const compare = (field: string, from: unknown, to: unknown): void => {
    if (from !== to) {
      changes.push({ field, from, to });
    }
  };
  compare("label", before.label, after.label.trim());
  compare("type", before.type, after.type);
  compare("unit", before.unit, after.unit);
  compare("ordered", before.ordered, after.ordered);
  compare("audience", before.audience, after.audience);
  compare("groupUuid", before.groupUuid, after.groupUuid);
  // Sub-field COUNT, not the whole schema. Adding a sub-field is the edit that
  // makes every stored row incomplete — and the readers drop incomplete rows — so
  // it is the one change worth a record here. A deep diff of the schema or of the
  // option list belongs in a dedicated history, not in a scalar change log, which
  // is why `options` is not audited either.
  compare(
    "groupFieldCount",
    (before.groupFields ?? []).length,
    after.groupFields.filter((field) => field.label.trim() !== "").length,
  );
  return changes;
};

export type ReferenceCount = {
  relationships: number;
  categories: number;
  relationshipNames: string[];
};

/** What currently points at an attribute — the guard, and the message. */
export const countReferences = async (
  uuid: string,
): Promise<ReferenceCount> => {
  const [rules, links] = await Promise.all([
    db.select().from(Relationships),
    db
      .select({ categoryUuid: SpecificationCategories.categoryUuid })
      .from(SpecificationCategories)
      .where(eq(SpecificationCategories.specificationUuid, uuid)),
  ]);

  const using = rules.filter((rule) =>
    referencedAttributeUuids(rule).includes(uuid),
  );
  return {
    relationships: using.length,
    categories: links.length,
    relationshipNames: using.map((rule) => rule.name),
  };
};

/**
 * Delete an attribute — REFUSED while anything references it.
 *
 * The alternative (cascading) means someone tidying the library silently deletes
 * a rule that was gating unsafe designs, and nobody finds out until a bad order
 * ships. So the guard refuses and says exactly what is in the way.
 */
export const deleteLibraryAttribute = async (
  uuid: string,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  const [current] = await db
    .select({ label: Specifications.label })
    .from(Specifications)
    .where(eq(Specifications.uuid, uuid));
  if (!current) {
    return;
  }

  const references = await countReferences(uuid);
  if (references.relationships > 0) {
    throw new ValidationError(
      `"${current.label}" cannot be deleted: ${references.relationships} rule(s) depend on it — ${references.relationshipNames.slice(0, 3).join(", ")}. Remove or repoint those rules first.`,
    );
  }
  if (references.categories > 0) {
    throw new ValidationError(
      `"${current.label}" cannot be deleted: ${references.categories} category assignment(s) still use it. Remove those assignments first.`,
    );
  }

  await db.delete(Specifications).where(eq(Specifications.uuid, uuid));
  await recordAudit({
    target: "specification",
    action: "delete",
    targetUuid: uuid,
    targetLabel: current.label,
    actor,
  });
  invalidateCatalogModel();
};

/**
 * Move an attribute to another group. Filing only — the uuid does not change, so
 * every rule and every stored value stays linked.
 */
export const moveLibraryAttribute = async (
  uuid: string,
  groupUuid: string | null,
): Promise<void> => {
  await db
    .update(Specifications)
    .set({ groupUuid })
    .where(eq(Specifications.uuid, uuid));
  invalidateCatalogModel();
};

export const reorderLibraryAttributes = async (
  order: { uuid: string; order: number }[],
): Promise<void> => {
  if (order.length === 0) {
    return;
  }
  // One statement: a CASE maps each attribute to its position, rather than an
  // UPDATE per attribute fanned out across the four-connection pool.
  await db
    .update(Specifications)
    .set({
      order: sql`case ${Specifications.uuid} ${sql.join(
        order.map((entry) => sql`when ${entry.uuid} then ${entry.order}`),
        sql` `,
      )} end`,
    })
    .where(
      inArray(
        Specifications.uuid,
        order.map((entry) => entry.uuid),
      ),
    );
  invalidateCatalogModel();
};

// ---------------------------------------------------------------------------
// Project variables
// ---------------------------------------------------------------------------

export type ProjectVariableInput = {
  label: string;
  description: string | null;
  type: "number" | "boolean";
  unit: string | null;
  defaultValue: number | null;
};

export const getProjectVariables = async () =>
  db.select().from(ProjectVariables).orderBy(asc(ProjectVariables.order));

export const createProjectVariable = async (
  input: ProjectVariableInput,
  actor?: { uuid: string; name: string },
): Promise<string> => {
  if (input.label.trim() === "") {
    throw new ValidationError("A project input needs a question.");
  }
  const uuid = generateUuid();
  const [total] = await db.select({ value: count() }).from(ProjectVariables);

  await db.insert(ProjectVariables).values({
    uuid,
    label: input.label.trim(),
    key: slugify(input.label) || "input",
    description: input.description?.trim() || null,
    type: input.type,
    unit: input.type === "number" ? input.unit?.trim() || null : null,
    defaultValue:
      input.defaultValue === null ? null : String(input.defaultValue),
    order: Number(total?.value ?? 0),
  });

  await recordAudit({
    target: "project_variable",
    action: "create",
    targetUuid: uuid,
    targetLabel: input.label,
    actor,
  });
  invalidateCatalogModel();
  return uuid;
};

export const updateProjectVariable = async (
  uuid: string,
  input: ProjectVariableInput,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  await db
    .update(ProjectVariables)
    .set({
      label: input.label.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      unit: input.type === "number" ? input.unit?.trim() || null : null,
      defaultValue:
        input.defaultValue === null ? null : String(input.defaultValue),
    })
    .where(eq(ProjectVariables.uuid, uuid));

  await recordAudit({
    target: "project_variable",
    action: "update",
    targetUuid: uuid,
    targetLabel: input.label,
    actor,
  });
  invalidateCatalogModel();
};

/** Refused while a relationship uses the variable as an operand or an escape hatch. */
export const deleteProjectVariable = async (
  uuid: string,
  actor?: { uuid: string; name: string },
): Promise<void> => {
  const [current] = await db
    .select({ label: ProjectVariables.label })
    .from(ProjectVariables)
    .where(eq(ProjectVariables.uuid, uuid));
  if (!current) {
    return;
  }

  const rules = await db.select().from(Relationships);
  const using = rules.filter((rule) => {
    if (
      rule.consumer?.source === "variable" &&
      rule.consumer.variableUuid === uuid
    ) {
      return true;
    }
    if (
      rule.provider?.source === "variable" &&
      rule.provider.variableUuid === uuid
    ) {
      return true;
    }
    return (rule.presence?.requires ?? []).some((requirement) =>
      requirement.satisfiedBy.some(
        (alternative) =>
          alternative.type === "variable_true" &&
          alternative.variableUuid === uuid,
      ),
    );
  });

  if (using.length > 0) {
    throw new ValidationError(
      `"${current.label}" cannot be deleted: ${using.length} rule(s) use it — ${using
        .slice(0, 3)
        .map((rule) => rule.name)
        .join(", ")}.`,
    );
  }

  await db.delete(ProjectVariables).where(eq(ProjectVariables.uuid, uuid));
  await recordAudit({
    target: "project_variable",
    action: "delete",
    targetUuid: uuid,
    targetLabel: current.label,
    actor,
  });
  invalidateCatalogModel();
};
