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
  isSpecGroupRows,
  operandSpecUuid,
  predicateAttributes,
  type SpecGroupField,
  type SpecOption,
} from "../../../db/types";
import { recordAudit } from "./catalog-audit";
import { invalidateCatalogModel, loadOptionSetIndex } from "./catalog-model";
import { ValidationError } from "./errors";
// Option identity lives in its own module because this one opens a database
// connection on import, and that logic has to be testable on its own.
import {
  mergeGroupFields,
  mergeOptions,
  resolveGroupFields,
  resolveVocabulary,
  usedOptionValues,
  valuesOutsideVocabulary,
  type LibraryGroupFieldInput,
  type LibraryOptionInput,
  type OptionSetIndex,
} from "./library-options";
import { readHeldValues, type HeldValues } from "./option-sets";

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
  // Only meaningful on a select. When set, the attribute borrows a SHARED
  // vocabulary and `options`/`ordered` above are ignored — which is what lets two
  // attributes hold comparable values without either naming the other.
  optionSetUuid: string | null;
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
  // RESOLVED — the attribute's own list, or the shared one it points at.
  options: SpecOption[];
  // Which of those two it was. The form needs it to reopen on the right source.
  optionSetUuid: SelectSpecifications["optionSetUuid"];
  // Only populated on `group`. Empty for every other type. Each select sub-field's
  // options are resolved the same way.
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
  // A select needs a vocabulary from SOMEWHERE — its own list or a shared one.
  // Neither is the case an author hits by accident and then cannot explain: the
  // attribute saves, the product form offers an empty dropdown, and nothing says
  // why.
  if (
    isOptionBacked(input.type) &&
    !input.optionSetUuid &&
    input.options.length === 0
  ) {
    throw new ValidationError(
      `"${input.label}" is a ${input.type.replace("_", "-")} attribute, so it needs at least one option — or a shared list to take its options from.`,
    );
  }
  if (input.optionSetUuid && !isOptionBacked(input.type)) {
    throw new ValidationError(
      "Only single-select and multi-select attributes can take their options from a shared list. A group's sub-fields point at one individually.",
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
      (field) =>
        field.kind === "select" &&
        !field.optionSetUuid &&
        field.options.length === 0,
    );
    if (bare) {
      throw new ValidationError(
        `The "${bare.label}" sub-field is a pick, so it needs at least one option — or a shared list to take its options from.`,
      );
    }
  }
};

/** Groups in order, each with its attributes and reference counts. */
export const getLibrary = async (): Promise<LibraryGroup[]> => {
  const [groups, specs, rules, links, sets] = await Promise.all([
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
    loadOptionSetIndex(),
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

  const toAttribute = (spec: SelectSpecifications): LibraryAttribute => {
    // Resolved for DISPLAY, so the library list shows the options an attribute
    // actually offers whether it owns them or borrows them. `optionSetUuid` is
    // carried alongside, because the form has to reopen on the source the author
    // chose — reopening on a resolved copy would silently detach the set.
    const vocabulary = resolveVocabulary(spec, sets);
    return {
      uuid: spec.uuid,
      groupUuid: spec.groupUuid,
      label: spec.label,
      internalName: spec.internalName,
      description: spec.description,
      key: spec.key,
      type: spec.type,
      unit: spec.unit,
      ordered: vocabulary.ordered,
      allowRange: spec.allowRange,
      audience: spec.audience,
      options: vocabulary.options,
      optionSetUuid: spec.optionSetUuid,
      groupFields: resolveGroupFields(spec.groupFields ?? [], sets),
      order: spec.order,
      categoryUuids: categoriesBySpec.get(spec.uuid) ?? [],
      relationshipCount: relationshipCount.get(spec.uuid) ?? 0,
      categoryCount: (categoriesBySpec.get(spec.uuid) ?? []).length,
    };
  };

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
    // False when a set is named: the set owns whether its own words form a scale,
    // so two attributes sharing it can never disagree.
    ordered:
      isOptionBacked(input.type) && !input.optionSetUuid
        ? input.ordered
        : false,
    // Normalised to its own type, exactly as `ordered` is: a select that claimed
    // allowRange would leave the product form with no honest control to render.
    allowRange: input.type === "number" ? input.allowRange : false,
    audience: input.audience,
    // A pointer and an inline list are never both stored. Two lists for one
    // attribute is two answers to "what may a product hold", and the loser drifts
    // out of date in silence.
    options:
      isOptionBacked(input.type) && !input.optionSetUuid
        ? mergeOptions([], input.options, input.ordered)
        : [],
    optionSetUuid: isOptionBacked(input.type)
      ? input.optionSetUuid || null
      : null,
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

// One option source that is about to change. `subFieldKey` is absent for the
// attribute's own list and set for one column of a group's rows.
type Repoint = {
  what: string;
  subFieldKey?: string;
  // The vocabulary the values would be read against AFTER the save. Computed from
  // what the save is actually going to write, never from the input, so the guard
  // and the write can never disagree about what the destination is.
  destination: SpecOption[];
};

/**
 * Every option source this save would change — inline becoming shared, shared
 * becoming inline, or one set swapped for another.
 *
 * Sub-fields are matched by key, because that is what a stored row is filed
 * under. A sub-field the author just added has no stored values to reinterpret,
 * so it is not a re-point and is deliberately not listed.
 */
const plannedRepoints = (
  current: SelectSpecifications,
  nextSet: string | null,
  nextOptions: SpecOption[],
  nextGroupFields: SpecGroupField[],
  sets: OptionSetIndex,
): Repoint[] => {
  const vocabularyOf = (
    setUuid: string | null | undefined,
    inline: SpecOption[],
  ): SpecOption[] => (setUuid ? (sets.get(setUuid)?.options ?? []) : inline);

  const repoints: Repoint[] = [];

  if ((current.optionSetUuid ?? null) !== nextSet) {
    repoints.push({
      what: `"${current.label}"`,
      destination: vocabularyOf(nextSet, nextOptions),
    });
  }

  const storedByKey = new Map(
    (current.groupFields ?? []).map((field) => [field.key, field]),
  );
  for (const field of nextGroupFields) {
    const stored = storedByKey.get(field.key);
    if (!stored) {
      continue;
    }
    if ((stored.optionSetUuid ?? null) === (field.optionSetUuid ?? null)) {
      continue;
    }
    repoints.push({
      what: `the "${stored.label}" sub-field of "${current.label}"`,
      subFieldKey: field.key,
      destination: vocabularyOf(field.optionSetUuid, field.options),
    });
  }
  return repoints;
};

/**
 * The consequences of this save that an author has to be told about but that must
 * not block them.
 *
 * ADDING A SUB-FIELD to a group is the case this exists for, and it is the most
 * quietly destructive edit in the model. Every row already entered answers the old
 * schema, so every one of them becomes incomplete — and the readers DROP
 * incomplete rows, which means a switch with four port groups silently starts
 * reading as having no ports at all. That looks exactly like a switch that passed
 * its port check.
 *
 * Not refused, though. Refusing would leave a group unable to grow once a single
 * product used it, and the precedent in this codebase is already settled the other
 * way — `outOfSliceValues` allows, records and surfaces rather than blocking,
 * because blocking makes the catalog unable to describe what it sells. So the edit
 * goes through and the author is told which products now owe a value.
 */
const addedSubFieldWarning = (
  current: SelectSpecifications,
  nextGroupFields: SpecGroupField[],
  held: HeldValues,
): string | null => {
  const before = new Set((current.groupFields ?? []).map((field) => field.key));
  const added = nextGroupFields.filter((field) => !before.has(field.key));
  // No prior schema means the group is being defined for the first time, so there
  // is nothing to invalidate.
  if (added.length === 0 || before.size === 0) {
    return null;
  }
  const withRows = held.values.filter(isSpecGroupRows).length;
  if (withRows === 0) {
    return null;
  }
  return `${withRows} product(s) already have rows for "${current.label}". Adding ${added
    .map((field) => `"${field.label}"`)
    .join(
      ", ",
    )} leaves those rows incomplete, and an incomplete row is ignored by every rule until it is filled in — so ${held.productNames.slice(0, 3).join(", ")}${held.productNames.length > 3 ? " and others" : ""} will read as having none.`;
};

/**
 * Refuse a re-point that would strand a value some product is already holding,
 * and collect the warnings for edits that are allowed but consequential.
 *
 * Nothing is read from the database unless something actually changed that needs
 * it: this is a JSON lookup across products, and it has no business running on
 * every rename.
 */
const checkValueImpact = async (
  uuid: string,
  current: SelectSpecifications,
  nextSet: string | null,
  nextOptions: SpecOption[],
  nextGroupFields: SpecGroupField[],
): Promise<string[]> => {
  const sets = await loadOptionSetIndex();
  const repoints = plannedRepoints(
    current,
    nextSet,
    nextOptions,
    nextGroupFields,
    sets,
  );
  const beforeKeys = new Set(
    (current.groupFields ?? []).map((field) => field.key),
  );
  const addsSubField =
    beforeKeys.size > 0 &&
    nextGroupFields.some((field) => !beforeKeys.has(field.key));

  if (repoints.length === 0 && !addsSubField) {
    return [];
  }

  const held = await readHeldValues(uuid);
  if (held.values.length === 0) {
    // Nothing to reinterpret and nothing to invalidate. This is the path an author
    // takes while still building the library, and it must stay frictionless.
    return [];
  }

  for (const repoint of repoints) {
    const used = usedOptionValues(held.values, repoint.subFieldKey);
    const stranded = valuesOutsideVocabulary(used, repoint.destination);
    if (stranded.length === 0) {
      continue;
    }
    // The stored value is what gets named, not a label: the label is what the OLD
    // list called it, and it is the value that would no longer resolve.
    throw new ValidationError(
      `${held.values.length} product(s) hold a value for ${repoint.what} that the new list does not have — ${stranded.slice(0, 5).join(", ")}. Add those to the shared list first (spelled exactly this way), or clear them from ${held.productNames.slice(0, 3).join(", ")} before switching.`,
    );
  }

  const warning = addedSubFieldWarning(current, nextGroupFields, held);
  return warning ? [warning] : [];
};

/**
 * Update a definition. The uuid and the key are BOTH preserved: nothing points
 * at the key, but changing it would churn every export and read model for no
 * benefit.
 *
 * Changing an attribute's TYPE is refused once it is referenced by a rule — a
 * select silently becoming a number turns every stored value into an unreadable
 * one.
 *
 * Changing where its OPTIONS come from is checked more precisely than that, because
 * a flat refusal would be wrong. Re-pointing rewrites nothing and can still break
 * everything: a product holding "poe" keeps holding "poe", but that string now
 * means whatever the new vocabulary says it means, or nothing at all — with no
 * error and no way to spot it afterwards.
 *
 * So the question asked is the narrow one: does the destination spell every value
 * products are ALREADY holding? An author who builds a shared list out of an
 * attribute's own options gets the same values back, and then the re-point changes
 * no meaning at all and is simply allowed. When a value would be stranded, the
 * refusal names it, which is what somebody needs in order to fix it.
 */
export const updateLibraryAttribute = async (
  uuid: string,
  input: LibraryAttributeInput,
  actor?: { uuid: string; name: string },
  // Consequences the author must be told about but that do not block the save.
): Promise<{ warnings: string[] }> => {
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

  // Everything the save will write is computed FIRST, so the guard below checks
  // the real destination rather than a second guess at it.
  const nextSet = isOptionBacked(input.type)
    ? input.optionSetUuid || null
    : null;
  const nextOrdered =
    isOptionBacked(input.type) && !nextSet ? input.ordered : false;
  const nextOptions =
    isOptionBacked(input.type) && !nextSet
      ? mergeOptions(current.options ?? [], input.options, nextOrdered)
      : [];
  const nextGroupFields =
    input.type === "group"
      ? mergeGroupFields(current.groupFields ?? [], input.groupFields)
      : [];

  const warnings = await checkValueImpact(
    uuid,
    current,
    nextSet,
    nextOptions,
    nextGroupFields,
  );

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
      // The inline list is CLEARED when a set takes over, rather than left behind
      // as a dormant copy. A copy nothing reads is a copy somebody will later
      // mistake for the truth.
      options: nextOptions,
      optionSetUuid: nextSet,
      groupFields: nextGroupFields,
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
  return { warnings };
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
  // Where the options come from. Worth a record even though the update guard
  // refuses it while products hold values: the guard passes freely on an
  // attribute nobody has filled in yet, and that is exactly the edit whose effect
  // is invisible later.
  compare("optionSetUuid", before.optionSetUuid, after.optionSetUuid || null);
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
