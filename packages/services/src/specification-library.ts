import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { generateUuid, slugify } from "utils";
import { db } from "../../../db";
import type { AssignmentAudience, SpecificationType } from "../../../db/enum";
import { isOptionBacked } from "../../../db/enum";
import { ProjectVariables } from "../../../db/schema/project-variables";
import { Relationships } from "../../../db/schema/relationships";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import { SpecificationOptionSets } from "../../../db/schema/specification-option-sets";
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
  aliasConflicts,
  deriveLibraryKey,
  labelAliasConflicts,
  mergeGroupFields,
  mergeOptions,
  normalizeAliases,
  normalizeLibraryKey,
  normalizeSetValues,
  resolveGroupFields,
  resolveVocabulary,
  usedOptionValues,
  valuesOutsideVocabulary,
  type AliasConflict,
  type LibraryGroupFieldInput,
  type LibraryOptionInput,
  type NameableAttribute,
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
  // Other labels the SOURCES use for this attribute. Not display text — see
  // Specifications.labelAliases.
  labelAliases: string[] | null;
  // The stable external name — `pwr.power_draw_w`. Null lets it be derived from
  // the label, which is what the admin form does when an author does not care.
  // An importer working from a mapping file always supplies it.
  key: string | null;
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
  // Which of the borrowed set's words this attribute uses. Empty = all of them.
  // Ignored without `optionSetUuid` — there is nothing to narrow.
  setValues: string[] | null;
  // Only meaningful on `group`. The sub-fields one repeatable row carries.
  groupFields: LibraryGroupFieldInput[];
};

export type LibraryAttribute = {
  uuid: string;
  groupUuid: string | null;
  label: string;
  internalName: string | null;
  description: string | null;
  labelAliases: SelectSpecifications["labelAliases"];
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
  // The narrowing, so the form reopens showing what the author chose. `options`
  // above is already narrowed by it — this is for the control, not the readers.
  setValues: SelectSpecifications["setValues"];
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
  // What every external name filed under this group starts with.
  keyPrefix: string | null;
  order: number;
  attributes: LibraryAttribute[];
};

/**
 * Derived from the group's prefix and the label when nobody supplies one.
 *
 * Which is now the ordinary case: the admin no longer asks. An external name is
 * the one identifier everything OUTSIDE this system keys on, and asking each
 * author to invent one produced a field most people left blank and a scattering
 * of unrelated shapes for facts of the same kind. The group decides the prefix
 * once; the label supplies the rest.
 *
 * The `-2` suffix on a collision keeps its old form deliberately. It is a
 * convenience nobody wrote down, and a numbered key is a visible sign that two
 * attributes in one group share a name — which is worth seeing.
 */
const derivedKey = (
  label: string,
  groupPrefix: string | null,
  taken: Set<string>,
): string => {
  const base = deriveLibraryKey(label, groupPrefix);
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

/**
 * The external name this save should store, refusing the two ways it goes wrong.
 *
 * A key that does not parse is refused rather than coerced — see
 * `normalizeLibraryKey`. A key another attribute already holds is refused
 * outright rather than being given a `-2` suffix the way a derived one is:
 * a derived key is a convenience nobody wrote down, so quietly numbering it costs
 * nothing, but a key an author TYPED is one they are about to write into a
 * mapping file. Handing them `pwr.power_draw_w-2` and saying nothing produces a
 * mapping that resolves to nothing on the first run.
 */
const resolveKey = (
  input: LibraryAttributeInput,
  taken: Set<string>,
  groupPrefix: string | null,
): string => {
  const supplied = input.key?.trim();
  if (!supplied) {
    return derivedKey(input.label, groupPrefix, taken);
  }
  const parsed = normalizeLibraryKey(supplied);
  if (!parsed.ok) {
    throw new ValidationError(
      `"${supplied}" cannot be an attribute's external name because ${parsed.reason}.`,
    );
  }
  if (taken.has(parsed.key)) {
    throw new ValidationError(
      `Another attribute is already named "${parsed.key}". An external name has to point at one attribute, or every import and export keyed on it lands somewhere nobody chose.`,
    );
  }
  return parsed.key;
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

/**
 * Every alias this save would introduce, checked for ambiguity — and refused.
 *
 * REFUSED rather than surfaced, which is the opposite of what near-duplicate
 * detection does, and the difference is who is going to read the result. A
 * near-duplicate is a judgement call for a human looking at two labels. An
 * ambiguous alias is a question a machine will ask thousands of times with no
 * human present, and the only honest answers are "this option" or "I don't know".
 * Storing an alias two options answer to guarantees the second answer forever,
 * on a field whose entire purpose is to give the first.
 *
 * Group sub-fields are checked too. Their picks are option lists like any other
 * and an importer resolves a port's speed column exactly the way it resolves a
 * top-level select — an unchecked alias there fails the same way, one level down
 * where nobody is looking.
 */
/**
 * An attribute's label aliases as the column stores them.
 *
 * Empty becomes NULL rather than `[]`, so "no aliases" has one representation
 * instead of two that every reader has to remember are the same.
 */
const storedLabelAliases = (input: LibraryAttributeInput): string[] | null => {
  const aliases = normalizeAliases(input.labelAliases, {
    value: "",
    label: input.label.trim(),
  });
  return aliases.length > 0 ? aliases : null;
};

const assertAliasesResolve = (
  input: LibraryAttributeInput,
  nextOptions: SpecOption[],
  nextGroupFields: SpecGroupField[],
  library: NameableAttribute[],
  uuid: string,
): void => {
  const describe = (conflict: AliasConflict, where: string): string =>
    `"${conflict.alias}" is already how ${conflict.claimedBy
      .filter((name) => name !== "")
      .join(" and ")} ${where}. An alias has to point at exactly one thing, or nothing that reads it can tell which you meant.`;

  const ownConflicts = aliasConflicts(nextOptions);
  if (ownConflicts[0]) {
    throw new ValidationError(describe(ownConflicts[0], "are both written"));
  }
  for (const field of nextGroupFields) {
    const fieldConflicts = aliasConflicts(field.options);
    if (fieldConflicts[0]) {
      throw new ValidationError(
        describe(
          fieldConflicts[0],
          `are both written in the "${field.label}" sub-field`,
        ),
      );
    }
  }

  const labelConflicts = labelAliasConflicts(
    {
      uuid,
      // The key is not being checked against here — only labels and their
      // aliases — so a placeholder is honest rather than a guess at what the key
      // will be. `labelAliasConflicts` compares the CANDIDATE's aliases against
      // every other attribute's key, label and aliases, never its own.
      key: "",
      label: input.label.trim(),
      labelAliases: storedLabelAliases(input),
    },
    library,
  );
  if (labelConflicts[0]) {
    throw new ValidationError(
      describe(labelConflicts[0], "are both known as"),
    );
  }
};

/**
 * The prefix every external name filed under a group starts with.
 *
 * Read at save time rather than carried on the input: the group is chosen on the
 * same form, and a prefix passed from the client would be one the client could
 * be wrong about.
 */
const groupKeyPrefix = async (
  groupUuid: string | null,
): Promise<string | null> => {
  if (!groupUuid) {
    return null;
  }
  const [group] = await db
    .select({ keyPrefix: SpecificationGroups.keyPrefix })
    .from(SpecificationGroups)
    .where(eq(SpecificationGroups.uuid, groupUuid));
  return group?.keyPrefix ?? null;
};

/** Every attribute in the library, in the shape the alias checks want. */
const readNameableLibrary = async (): Promise<NameableAttribute[]> =>
  db
    .select({
      uuid: Specifications.uuid,
      key: Specifications.key,
      label: Specifications.label,
      labelAliases: Specifications.labelAliases,
    })
    .from(Specifications);

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
      labelAliases: spec.labelAliases,
      key: spec.key,
      type: spec.type,
      unit: spec.unit,
      ordered: vocabulary.ordered,
      allowRange: spec.allowRange,
      audience: spec.audience,
      options: vocabulary.options,
      optionSetUuid: spec.optionSetUuid,
      setValues: spec.setValues,
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
    keyPrefix: group.keyPrefix,
    order: group.order,
    attributes: byGroup.get(group.uuid) ?? [],
  }));

  if (ungrouped.length > 0) {
    result.push({
      uuid: "",
      name: "Ungrouped",
      domain: null,
      keyPrefix: null,
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

  const [existing, [total], keyPrefix] = await Promise.all([
    readNameableLibrary(),
    db.select({ value: count() }).from(Specifications),
    groupKeyPrefix(input.groupUuid),
  ]);

  const options =
    isOptionBacked(input.type) && !input.optionSetUuid
      ? mergeOptions([], input.options, input.ordered)
      : [];
  const groupFields =
    input.type === "group" ? mergeGroupFields([], input.groupFields) : [];
  // Against what will actually be WRITTEN, never against the raw input —
  // `mergeOptions` is what decides an option's final value and its normalised
  // aliases, and checking the input would check a list that never existed.
  assertAliasesResolve(input, options, groupFields, existing, uuid);

  await db.insert(Specifications).values({
    uuid,
    groupUuid: input.groupUuid,
    label: input.label.trim(),
    internalName: input.internalName?.trim() || null,
    description: input.description?.trim() || null,
    labelAliases: normalizeAliases(input.labelAliases, {
      value: "",
      label: input.label.trim(),
    }),
    key: resolveKey(input, new Set(existing.map((row) => row.key)), keyPrefix),
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
    options,
    optionSetUuid: isOptionBacked(input.type)
      ? input.optionSetUuid || null
      : null,
    // Only stored alongside a set. A narrowing with nothing to narrow would sit
    // there looking meaningful the day somebody pointed the attribute at a list.
    setValues:
      isOptionBacked(input.type) && input.optionSetUuid
        ? normalizeSetValues(input.setValues)
        : null,
    groupFields,
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

// Stands in when no source moved, so `plannedRepoints` is never handed a real
// index it had no reason to load.
const emptyOptionSets: OptionSetIndex = new Map();

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
  const beforeKeys = new Set(
    (current.groupFields ?? []).map((field) => field.key),
  );
  const addsSubField =
    beforeKeys.size > 0 &&
    nextGroupFields.some((field) => !beforeKeys.has(field.key));

  // WHETHER a source moved is answerable from the two schemas alone. Only the
  // question of what the destination now spells needs the shared lists loaded — so
  // the common save, which moves nothing, reads nothing at all. This used to fetch
  // the index on every rename.
  const storedFieldSets = new Map(
    (current.groupFields ?? []).map((field) => [
      field.key,
      field.optionSetUuid ?? null,
    ]),
  );
  const movesSource =
    (current.optionSetUuid ?? null) !== nextSet ||
    nextGroupFields.some(
      (field) =>
        storedFieldSets.has(field.key) &&
        storedFieldSets.get(field.key) !== (field.optionSetUuid ?? null),
    );

  if (!movesSource && !addsSubField) {
    return [];
  }

  // Independent reads, so they go together rather than one after the other — this
  // sits directly in the path of an author pressing Save.
  const [sets, held] = await Promise.all([
    movesSource ? loadOptionSetIndex() : Promise.resolve(emptyOptionSets),
    readHeldValues(uuid),
  ]);
  const repoints = movesSource
    ? plannedRepoints(current, nextSet, nextOptions, nextGroupFields, sets)
    : [];

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
  // Dropped when the attribute stops borrowing. A narrowing of a set it no longer
  // points at would come back to life the day somebody re-pointed it, silently
  // hiding words the author never chose to hide.
  const nextSetValues = nextSet ? normalizeSetValues(input.setValues) : null;
  const nextOptions =
    isOptionBacked(input.type) && !nextSet
      ? mergeOptions(current.options ?? [], input.options, nextOrdered)
      : [];
  const nextGroupFields =
    input.type === "group"
      ? mergeGroupFields(current.groupFields ?? [], input.groupFields)
      : [];

  const library = await readNameableLibrary();
  assertAliasesResolve(input, nextOptions, nextGroupFields, library, uuid);

  // The external name changes only when an author TYPES a different one, never
  // because the label moved. That distinction is the whole point of the field: a
  // key re-derived on a rename breaks every mapping keyed on it a month later,
  // with nothing to look at. A deliberate edit is a different act, and it is
  // allowed — with a warning, because the consequence lands outside this system
  // where we cannot see it.
  const supplied = input.key?.trim();
  const nextKey =
    supplied && supplied.toLowerCase() !== current.key
      ? resolveKey(
          input,
          new Set(
            library
              .filter((row) => row.uuid !== uuid)
              .map((row) => row.key),
          ),
          await groupKeyPrefix(input.groupUuid),
        )
      : current.key;

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
      labelAliases: storedLabelAliases(input),
      key: nextKey,
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
      setValues: nextSetValues,
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
  return {
    warnings:
      nextKey === current.key
        ? warnings
        : [
            ...warnings,
            `This attribute's external name changed from "${current.key}" to "${nextKey}". Anything outside this system that referenced the old one — an import mapping, an export, a spreadsheet — now resolves to nothing and needs updating too.`,
          ],
  };
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

/**
 * Add ONE value to an attribute's master list — controlled-add, from anywhere.
 *
 * The import review queue needs this. A reviewer meeting an unknown value has
 * two honest answers: map it onto a value that already exists, or admit it is a
 * new one. The second has to be possible without leaving the queue, or a batch
 * carrying sixty new values becomes sixty round trips and the reviewer starts
 * mapping things onto near-misses to avoid the walk.
 *
 * It goes through `mergeOptions` and the same alias-conflict guard as a full
 * save rather than pushing onto the array, because those guards are the whole
 * value of the list: append-only, one spelling pointing at one thing, and a
 * derived value the resolver can find again.
 *
 * When the attribute BORROWS a shared vocabulary the option is added to the set,
 * not to the attribute — the attribute has no list of its own to add to, and
 * giving it one would fork the very vocabulary the set exists to keep single.
 * The attribute's narrowing is widened to include it, otherwise the value would
 * be added and still not offered.
 *
 * Returns the canonical value as stored, which is not always what was typed.
 */
export const addOptionToAttribute = async (
  specificationUuid: string,
  input: { label: string; aliases?: string[] },
): Promise<string> => {
  const label = input.label.trim();
  if (!label) {
    throw new ValidationError("A new option needs a name.");
  }

  const [attribute] = await db
    .select()
    .from(Specifications)
    .where(eq(Specifications.uuid, specificationUuid));
  if (!attribute) {
    throw new ValidationError("That attribute no longer exists.");
  }
  if (!isOptionBacked(attribute.type)) {
    throw new ValidationError(
      `"${attribute.label}" is a ${attribute.type} attribute — it has no master list to add to.`,
    );
  }

  const asInput = (options: SpecOption[]): LibraryOptionInput[] =>
    options.map((option) => ({
      value: option.value,
      label: option.label,
      rank: option.rank,
      aliases: option.aliases,
    }));

  const added: LibraryOptionInput = { label, rank: null, aliases: input.aliases };

  // Borrowed vocabulary: the words belong to the set.
  if (attribute.optionSetUuid) {
    const [set] = await db
      .select()
      .from(SpecificationOptionSets)
      .where(eq(SpecificationOptionSets.uuid, attribute.optionSetUuid));
    if (!set) {
      throw new ValidationError("That shared list no longer exists.");
    }

    const existing = set.options ?? [];
    const merged = mergeOptions(existing, [...asInput(existing), added], set.ordered);
    const conflict = aliasConflicts(merged)[0];
    if (conflict) {
      throw new ValidationError(
        `"${conflict.alias}" is already how ${conflict.claimedBy.join(" and ")} are written in "${set.name}". An alias has to point at exactly one thing.`,
      );
    }
    const stored = merged.find((option) => option.label === label);
    if (!stored) {
      throw new ValidationError("That option could not be added.");
    }

    await db
      .update(SpecificationOptionSets)
      .set({ options: merged })
      .where(eq(SpecificationOptionSets.uuid, set.uuid));

    // A narrowed attribute would otherwise have the word and still not offer it.
    const narrowed = attribute.setValues ?? [];
    if (narrowed.length > 0 && !narrowed.includes(stored.value)) {
      await db
        .update(Specifications)
        .set({ setValues: [...narrowed, stored.value] })
        .where(eq(Specifications.uuid, specificationUuid));
    }
    invalidateCatalogModel();
    return stored.value;
  }

  const existing = attribute.options ?? [];
  const merged = mergeOptions(
    existing,
    [...asInput(existing), added],
    attribute.ordered,
  );
  const conflict = aliasConflicts(merged)[0];
  if (conflict) {
    throw new ValidationError(
      `"${conflict.alias}" is already how ${conflict.claimedBy.join(" and ")} are written on "${attribute.label}". An alias has to point at exactly one thing.`,
    );
  }
  const stored = merged.find((option) => option.label === label);
  if (!stored) {
    throw new ValidationError("That option could not be added.");
  }

  await db
    .update(Specifications)
    .set({ options: merged })
    .where(eq(Specifications.uuid, specificationUuid));
  invalidateCatalogModel();
  return stored.value;
};

// ---------------------------------------------------------------------------
// Project variables
// ---------------------------------------------------------------------------

export type ProjectVariableInput = {
  // The question, in the buyer's words. There is no help text and no default:
  // a second prose box asks what the question already says, and a default is a
  // number nobody supplied being fed to a rule as though someone had.
  label: string;
  type: "number" | "boolean";
  unit: string | null;
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
    type: input.type,
    unit: input.type === "number" ? input.unit?.trim() || null : null,
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
      type: input.type,
      unit: input.type === "number" ? input.unit?.trim() || null : null,
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
