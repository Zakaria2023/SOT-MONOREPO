import { randomUUID } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import { resolveSpecInputType, slugify } from "utils";
import { db } from "../../../db";
import type { SpecInputType } from "../../../db/enum";
import { CompatibilityRules } from "../../../db/schema/compatibility-rules";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import { SpecificationTemplates } from "../../../db/schema/specification-templates";
import {
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";
import type { SpecOption } from "../../../db/types";

// ---------------------------------------------------------------------------
// The library builder: groups → attributes with the richer inputType, the
// count of relationships that reference each attribute (the link badge), and
// the move/reorder operations that keep those relationships intact (rules
// reference attributes by uuid, so a move never breaks a link).
// ---------------------------------------------------------------------------

export type LibraryAttribute = {
  uuid: string;
  groupUuid: string | null;
  key: string;
  label: string;
  inputType: SpecInputType;
  unit: string | null;
  // "number" modifier: the product enters a from–to range instead of a single
  // value.
  allowRange: boolean;
  // Whether `options` is an ordered scale rather than an unordered set. Drives
  // the ≤/≥ comparators in rules and the ceiling reading of a category slice.
  ordered: boolean;
  options: string[];
  // Per-option reveal links: option value → library attribute keys auto-added
  // to a product when that option is chosen. Empty for options with no links.
  optionReveals: Record<string, string[]>;
  // Categories this attribute applies to (plus their descendants, resolved at
  // read time). Empty = universal, applies to every category.
  categoryUuids: string[];
  order: number;
  // How many compatibility relationships reference this attribute.
  relationshipCount: number;
};

export type LibraryBuilderGroup = {
  uuid: string;
  name: string;
  // Navigation domain the group is bucketed under (Power, Networking, ...).
  domain: string | null;
  order: number;
  attributes: LibraryAttribute[];
};

export type AttributeInput = {
  groupUuid: string | null;
  label: string;
  inputType: SpecInputType;
  unit: string | null;
  // "number" only: the product enters a from–to range. Ignored for other types.
  allowRange: boolean;
  // Marks the option list as a low-to-high scale. Only meaningful for the
  // option-based types; forced off for number/text.
  ordered: boolean;
  // Raw option strings (for select/multi_select). Ignored for other types.
  options: string[];
  // Per-option reveal links: option value → library attribute keys to auto-add
  // when chosen. Keys for values not in `options` (or Yes/No for boolean) are
  // ignored. Absent = no links.
  reveals?: Record<string, string[]>;
  // Categories the attribute applies to. Empty = universal.
  categoryUuids: string[];
};

// Derive the UX inputType for a legacy row that predates the column. Shared
// with the client-side attribute picker via packages/utils.
const resolveInputType = (spec: SelectSpecifications): SpecInputType =>
  resolveSpecInputType(spec) as SpecInputType;

const toSpecOptions = (
  values: string[],
  reveals?: Record<string, string[]>,
): SpecOption[] =>
  values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => {
      const links = (reveals?.[value] ?? []).filter(
        (key) => key.trim().length > 0,
      );
      return links.length > 0
        ? { value, children: [], reveals: links }
        : { value, children: [] };
    });

// Map the builder's inputType down to the engine-facing columns.
const engineFieldsFor = (input: AttributeInput) => {
  switch (input.inputType) {
    case "number":
      return {
        valueType: "number" as const,
        allowMultiple: false,
        allowRange: input.allowRange,
        // Numbers already compare numerically — there is no option list to order.
        ordered: false,
        unit: input.unit?.trim() || null,
        options: [] as SpecOption[],
      };
    case "multi_select":
      return {
        valueType: "select" as const,
        allowMultiple: true,
        allowRange: false,
        ordered: input.ordered,
        unit: null,
        options: toSpecOptions(input.options, input.reveals),
      };
    case "boolean":
      return {
        valueType: "select" as const,
        allowMultiple: false,
        allowRange: false,
        // Yes/No is a set, not a scale.
        ordered: false,
        unit: null,
        options: toSpecOptions(["Yes", "No"], input.reveals),
      };
    case "text":
      return {
        valueType: "select" as const,
        allowMultiple: false,
        allowRange: false,
        // Free text has no option list to order.
        ordered: false,
        unit: null,
        options: [] as SpecOption[],
      };
    case "single_select":
    default:
      return {
        valueType: "select" as const,
        allowMultiple: false,
        allowRange: false,
        ordered: input.ordered,
        unit: null,
        options: toSpecOptions(input.options, input.reveals),
      };
  }
};

const toLibraryAttribute = (
  spec: SelectSpecifications,
  relationshipCount: number,
  categoryUuids: string[],
): LibraryAttribute => {
  const optionReveals: Record<string, string[]> = {};
  for (const option of spec.options ?? []) {
    if (option.reveals && option.reveals.length > 0) {
      optionReveals[option.value] = option.reveals;
    }
  }
  return {
    uuid: spec.uuid,
    groupUuid: spec.groupUuid,
    key: spec.key,
    label: spec.label,
    inputType: resolveInputType(spec),
    unit: spec.unit,
    allowRange: spec.allowRange,
    ordered: spec.ordered,
    options: (spec.options ?? []).map((option) => option.value),
    optionReveals,
    categoryUuids,
    order: spec.order,
    relationshipCount,
  };
};

// A unique key derived from the label, so products store values under a stable
// slug that survives renames elsewhere.
const uniqueKey = (label: string, taken: Set<string>): string => {
  const base = slugify(label) || "attribute";
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
};

/** Groups (in order) each with their attributes and link counts. */
export const getLibraryBuilder = async (): Promise<LibraryBuilderGroup[]> => {
  const [groups, specs, rules, categoryLinks] = await Promise.all([
    db.select().from(SpecificationGroups).orderBy(asc(SpecificationGroups.order)),
    db.select().from(Specifications).orderBy(asc(Specifications.order)),
    db
      .select({
        consumer: CompatibilityRules.consumerSpecUuid,
        provider: CompatibilityRules.providerSpecUuid,
      })
      .from(CompatibilityRules),
    db
      .select({
        specificationUuid: SpecificationCategories.specificationUuid,
        categoryUuid: SpecificationCategories.categoryUuid,
      })
      .from(SpecificationCategories),
  ]);

  const categoriesBySpec = new Map<string, string[]>();
  for (const link of categoryLinks) {
    const list = categoriesBySpec.get(link.specificationUuid) ?? [];
    list.push(link.categoryUuid);
    categoriesBySpec.set(link.specificationUuid, list);
  }

  const linkCount = new Map<string, number>();
  for (const rule of rules) {
    for (const uuid of [rule.consumer, rule.provider]) {
      if (uuid) {
        linkCount.set(uuid, (linkCount.get(uuid) ?? 0) + 1);
      }
    }
  }

  const byGroup = new Map<string, LibraryAttribute[]>();
  const ungrouped: LibraryAttribute[] = [];
  for (const spec of specs) {
    const attribute = toLibraryAttribute(
      spec,
      linkCount.get(spec.uuid) ?? 0,
      categoriesBySpec.get(spec.uuid) ?? [],
    );
    if (!spec.groupUuid) {
      ungrouped.push(attribute);
      continue;
    }
    const list = byGroup.get(spec.groupUuid) ?? [];
    list.push(attribute);
    byGroup.set(spec.groupUuid, list);
  }

  const result: LibraryBuilderGroup[] = groups.map((group) => ({
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

// The transaction handle drizzle passes to a db.transaction callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Replace an attribute's category links with the given set (deduped, blanks
// dropped). Runs on the caller's transaction so the spec row and its links are
// written atomically.
const replaceCategoryLinks = async (
  tx: Tx,
  specificationUuid: string,
  categoryUuids: string[],
): Promise<void> => {
  // Each link is an assignment carrying that category's filter/rule/scope/
  // show-if switches, so read them before the delete and carry them over.
  // Otherwise renaming an attribute in the library would quietly reset how
  // every category uses it.
  const existing = await tx
    .select({
      categoryUuid: SpecificationCategories.categoryUuid,
      isFilter: SpecificationCategories.isFilter,
      isRule: SpecificationCategories.isRule,
      scope: SpecificationCategories.scope,
      showIf: SpecificationCategories.showIf,
      audience: SpecificationCategories.audience,
      enabledValues: SpecificationCategories.enabledValues,
      order: SpecificationCategories.order,
    })
    .from(SpecificationCategories)
    .where(eq(SpecificationCategories.specificationUuid, specificationUuid));
  const preserved = new Map(
    existing.map(({ categoryUuid, ...switches }) => [categoryUuid, switches]),
  );

  await tx
    .delete(SpecificationCategories)
    .where(eq(SpecificationCategories.specificationUuid, specificationUuid));
  const unique = [...new Set(categoryUuids.filter((uuid) => uuid.length > 0))];
  if (unique.length > 0) {
    await tx.insert(SpecificationCategories).values(
      unique.map((categoryUuid) => ({
        uuid: randomUUID(),
        specificationUuid,
        categoryUuid,
        ...preserved.get(categoryUuid),
      })),
    );
  }
};

export const createLibraryAttribute = async (
  input: AttributeInput,
): Promise<string> => {
  const uuid = randomUUID();
  const engine = engineFieldsFor(input);
  const [existing, [{ total }]] = await Promise.all([
    db.select({ key: Specifications.key }).from(Specifications),
    db.select({ total: count() }).from(Specifications),
  ]);
  const key = uniqueKey(
    input.label,
    new Set(existing.map((row) => row.key)),
  );

  await db.transaction(async (tx) => {
    await tx.insert(Specifications).values({
      uuid,
      groupUuid: input.groupUuid,
      label: input.label,
      key,
      inputType: input.inputType,
      valueType: engine.valueType,
      allowMultiple: engine.allowMultiple,
      allowRange: engine.allowRange,
      ordered: engine.ordered,
      unit: engine.unit,
      options: engine.options,
      order: total,
    });
    await replaceCategoryLinks(tx, uuid, input.categoryUuids);
  });
  return uuid;
};

// Update rewrites name/type/options/unit but keeps the uuid AND the key, so
// products and relationships that reference this attribute stay intact.
export const updateLibraryAttribute = async (
  uuid: string,
  input: AttributeInput,
): Promise<void> => {
  const engine = engineFieldsFor(input);
  await db.transaction(async (tx) => {
    await tx
      .update(Specifications)
      .set({
        label: input.label,
        inputType: input.inputType,
        valueType: engine.valueType,
        allowMultiple: engine.allowMultiple,
        allowRange: engine.allowRange,
        ordered: engine.ordered,
        unit: engine.unit,
        options: engine.options,
      })
      .where(eq(Specifications.uuid, uuid));
    await replaceCategoryLinks(tx, uuid, input.categoryUuids);
  });
};

export const deleteLibraryAttribute = async (uuid: string): Promise<void> => {
  await db.delete(Specifications).where(eq(Specifications.uuid, uuid));
};

/** Move an attribute to another group (or null). Its uuid/key don't change,
 * so every relationship and product that references it stays linked. */
export const moveLibraryAttribute = async (
  uuid: string,
  groupUuid: string | null,
): Promise<void> => {
  await db
    .update(Specifications)
    .set({ groupUuid })
    .where(eq(Specifications.uuid, uuid));
};

export type { SelectSpecificationGroups };

// ---------------------------------------------------------------------------
// The Database read-model — the clean, structured JSON the RAG AI loads to
// draft BOQs: every group, attribute (id/type/unit/options), relationship
// (by attribute id), and template. No prose to parse.
// ---------------------------------------------------------------------------

export type LibraryReadModel = {
  library: string;
  groups: { id: string; name: string }[];
  attributes: {
    id: string;
    group: string | null;
    name: string;
    type: SpecInputType;
    unit?: string | null;
    options?: string[];
  }[];
  relationships: {
    id: string;
    name: string;
    family: string;
    gate: "hard" | "soft";
    attributes: string[];
  }[];
  templates: { id: string; name: string; attributes: string[] }[];
};

const FAMILY_LABEL: Record<string, string> = {
  sum_budget: "Budget",
  count_limit: "Count",
  per_item_threshold: "Match",
  spec_match: "Match",
  ratio: "Ratio",
};

export const getLibraryReadModel = async (): Promise<LibraryReadModel> => {
  const [groups, specs, rules, templates] = await Promise.all([
    db.select().from(SpecificationGroups).orderBy(asc(SpecificationGroups.order)),
    db.select().from(Specifications).orderBy(asc(Specifications.order)),
    db.select().from(CompatibilityRules),
    db.select().from(SpecificationTemplates).orderBy(asc(SpecificationTemplates.order)),
  ]);

  const keyByUuid = new Map(specs.map((spec) => [spec.uuid, spec.key]));

  return {
    library: "SOT specification library",
    groups: groups.map((group) => ({ id: group.uuid, name: group.name })),
    attributes: specs.map((spec) => {
      const inputType = resolveInputType(spec);
      const options = (spec.options ?? []).map((option) => option.value);
      return {
        id: spec.key,
        group: spec.groupUuid,
        name: spec.label,
        type: inputType,
        ...(spec.unit ? { unit: spec.unit } : {}),
        ...(options.length > 0 ? { options } : {}),
      };
    }),
    relationships: rules.map((rule) => ({
      id: rule.uuid,
      name: rule.name,
      family: FAMILY_LABEL[rule.kind] ?? rule.kind,
      gate: rule.severity === "block" ? "hard" : "soft",
      attributes: [
        keyByUuid.get(rule.consumerSpecUuid),
        keyByUuid.get(rule.providerSpecUuid),
      ].filter((key): key is string => Boolean(key)),
    })),
    templates: templates.map((template) => ({
      id: template.uuid,
      name: template.name,
      attributes: template.attributeKeys,
    })),
  };
};
