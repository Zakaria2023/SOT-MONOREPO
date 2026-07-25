import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import type { AssignmentAudience } from "../../../db/enum";
import { Categories, SelectCategories } from "../../../db/schema/categories";
import { Products, SelectProducts } from "../../../db/schema/products";
import {
  SelectSpecificationCategories,
  SpecificationCategories,
} from "../../../db/schema/specification-categories";
import {
  SelectSpecificationGroups,
  SpecificationGroups,
} from "../../../db/schema/specification-groups";
import {
  SelectSpecifications,
  Specifications,
} from "../../../db/schema/specifications";
import {
  type AssignmentDefinition,
  type AssignmentRow,
  type AssignmentSwitches,
  type ResolvedAssignment,
  facetAssignments,
  resolveAssignments,
} from "./assignment-resolver";

export type { ResolvedAssignment, AssignmentSwitches };

// A facet as the storefront renders it: the library definition flattened to
// what a filter panel needs, with the options already narrowed to the
// category's enabled slice.
export type CategoryFacet = {
  key: SelectSpecifications["key"];
  label: SelectSpecifications["label"];
  unit: SelectSpecifications["unit"];
  ordered: SelectSpecifications["ordered"];
  allowMultiple: SelectSpecifications["allowMultiple"];
  valueType: SelectSpecifications["valueType"];
  options: string[];
};

// One assignment as the admin builder edits it — the switches plus enough of
// the definition to render the row, and where it came from.
export type CategoryAssignment = AssignmentSwitches & {
  specificationUuid: SelectSpecifications["uuid"];
  key: SelectSpecifications["key"];
  label: SelectSpecifications["label"];
  unit: SelectSpecifications["unit"];
  ordered: SelectSpecifications["ordered"];
  valueType: SelectSpecifications["valueType"];
  inputType: SelectSpecifications["inputType"];
  allowMultiple: SelectSpecifications["allowMultiple"];
  // The full master list, so the builder can show which options the slice
  // leaves out — it must never let a category edit this list.
  masterOptions: string[];
  // The master list narrowed to this category's slice.
  offeredOptions: string[];
  sourceCategoryUuid: string;
  sourceCategoryName: string | null;
  inherited: boolean;
};

// The switches an admin may write for one category → attribute pointer.
export type AssignmentInput = AssignmentSwitches & {
  specificationUuid: string;
};

const DEFINITION_COLUMNS = {
  uuid: Specifications.uuid,
  key: Specifications.key,
  label: Specifications.label,
  valueType: Specifications.valueType,
  inputType: Specifications.inputType,
  unit: Specifications.unit,
  allowMultiple: Specifications.allowMultiple,
  allowRange: Specifications.allowRange,
  ordered: Specifications.ordered,
  options: Specifications.options,
  order: Specifications.order,
};

/**
 * The category itself plus every ancestor, nearest first. An assignment on any
 * of these applies to the category; the nearest one wins when several assign
 * the same attribute.
 */
export const getCategoryAndAncestors = async (
  categoryUuid: string,
): Promise<string[]> => {
  const all = await db
    .select({ uuid: Categories.uuid, parentUuid: Categories.parentUuid })
    .from(Categories);
  const parentOf = new Map(all.map((row) => [row.uuid, row.parentUuid]));

  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = categoryUuid;
  // `seen` also guards against a cycle introduced by bad parent data.
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = parentOf.get(current) ?? null;
  }
  return chain;
};

// Load the rows + definitions for a chain and resolve them. Shared by every
// public reader below so inheritance is applied in exactly one place.
const resolveForChain = async (
  chain: string[],
): Promise<ResolvedAssignment[]> => {
  if (chain.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      specificationUuid: SpecificationCategories.specificationUuid,
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
    .where(inArray(SpecificationCategories.categoryUuid, chain));

  if (rows.length === 0) {
    return [];
  }

  const definitions: AssignmentDefinition[] = await db
    .select(DEFINITION_COLUMNS)
    .from(Specifications)
    .where(
      inArray(
        Specifications.uuid,
        rows.map((row) => row.specificationUuid),
      ),
    )
    .orderBy(asc(Specifications.order));

  return resolveAssignments({
    chain,
    rows: rows satisfies AssignmentRow[],
    definitions,
  });
};

/** Every attribute a category carries — its own plus inherited, nearest wins. */
export const getCategoryAssignments = async (
  categoryUuid: string,
): Promise<ResolvedAssignment[]> =>
  resolveForChain(await getCategoryAndAncestors(categoryUuid));

/**
 * The facets a category page offers a given viewer: assignments with "show as
 * filter" on, audience-permitted, and either authored on this category or
 * inherited as branch-wide.
 */
export const getCategoryFacets = async (
  categoryUuid: string,
  viewer: AssignmentAudience = "all",
): Promise<CategoryFacet[]> => {
  try {
    const resolved = await getCategoryAssignments(categoryUuid);
    return facetAssignments(resolved, viewer).map((assignment) => ({
      key: assignment.definition.key,
      label: assignment.definition.label,
      unit: assignment.definition.unit,
      ordered: assignment.definition.ordered,
      allowMultiple: assignment.definition.allowMultiple,
      valueType: assignment.definition.valueType,
      options: assignment.offeredOptions.map((option) => option.value),
    }));
  } catch (error) {
    console.error("getCategoryFacets failed:", error);
    throw new Error("Failed to fetch category facets", { cause: error });
  }
};

/**
 * Every attribute a category carries, shaped for the admin assignment builder:
 * inherited rows included and flagged, so an admin can see what came from above
 * before overriding it.
 */
export const getCategoryAssignmentRows = async (
  categoryUuid: string,
): Promise<CategoryAssignment[]> => {
  try {
    const resolved = await getCategoryAssignments(categoryUuid);
    if (resolved.length === 0) {
      return [];
    }

    const sourceUuids = [
      ...new Set(resolved.map((assignment) => assignment.sourceCategoryUuid)),
    ];
    const sources = await db
      .select({ uuid: Categories.uuid, name: Categories.name })
      .from(Categories)
      .where(inArray(Categories.uuid, sourceUuids));
    const nameByUuid = new Map(sources.map((row) => [row.uuid, row.name]));

    return resolved.map((assignment) => ({
      isFilter: assignment.isFilter,
      isRule: assignment.isRule,
      scope: assignment.scope,
      showIf: assignment.showIf,
      audience: assignment.audience,
      enabledValues: assignment.enabledValues,
      order: assignment.order,
      specificationUuid: assignment.definition.uuid,
      key: assignment.definition.key,
      label: assignment.definition.label,
      unit: assignment.definition.unit,
      ordered: assignment.definition.ordered,
      valueType: assignment.definition.valueType,
      inputType: assignment.definition.inputType,
      allowMultiple: assignment.definition.allowMultiple,
      masterOptions: (assignment.definition.options ?? []).map(
        (option) => option.value,
      ),
      offeredOptions: assignment.offeredOptions.map((option) => option.value),
      sourceCategoryUuid: assignment.sourceCategoryUuid,
      sourceCategoryName:
        nameByUuid.get(assignment.sourceCategoryUuid) ?? null,
      inherited: assignment.inherited,
    }));
  } catch (error) {
    console.error("getCategoryAssignmentRows failed:", error);
    throw new Error("Failed to fetch category assignments", { cause: error });
  }
};

/**
 * Replace the assignments authored ON this category. Inherited ones are
 * untouched — they belong to the ancestor that authored them, and removing an
 * attribute here simply drops the override so the parent's row applies again.
 */
export const setCategoryAssignments = async (
  categoryUuid: string,
  assignments: AssignmentInput[],
): Promise<void> => {
  // Dedupe on the attribute — a category points at each one at most once.
  const bySpec = new Map(
    assignments.map((assignment) => [assignment.specificationUuid, assignment]),
  );

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(SpecificationCategories)
        .where(eq(SpecificationCategories.categoryUuid, categoryUuid));

      if (bySpec.size === 0) {
        return;
      }
      await tx.insert(SpecificationCategories).values(
        [...bySpec.values()].map((assignment, index) => ({
          uuid: randomUUID(),
          categoryUuid,
          specificationUuid: assignment.specificationUuid,
          isFilter: assignment.isFilter,
          isRule: assignment.isRule,
          scope: assignment.scope,
          showIf: assignment.showIf,
          audience: assignment.audience,
          enabledValues: assignment.enabledValues,
          order: assignment.order || index,
        })),
      );
    });
  } catch (error) {
    console.error("setCategoryAssignments failed:", error);
    throw new Error("Failed to save category assignments", { cause: error });
  }
};

// ---------------------------------------------------------------------------
// The product form's view of assignments.
// ---------------------------------------------------------------------------

// One attribute a product in a given category fills in. Options are already
// the category's enabled slice, so the form can never offer a value the
// category has disabled.
export type ProductFormAttribute = {
  key: SelectSpecifications["key"];
  label: SelectSpecifications["label"];
  unit: SelectSpecifications["unit"];
  valueType: SelectSpecifications["valueType"];
  allowMultiple: SelectSpecifications["allowMultiple"];
  allowRange: SelectSpecifications["allowRange"];
  ordered: SelectSpecifications["ordered"];
  options: string[];
  isFilter: SelectSpecificationCategories["isFilter"];
  isRule: SelectSpecificationCategories["isRule"];
  showIf: SelectSpecificationCategories["showIf"];
  audience: SelectSpecificationCategories["audience"];
  groupName: string | null;
};

/**
 * Every category's resolved attributes, keyed by category uuid — what a
 * product in that category is asked to fill in.
 *
 * Returned for ALL categories in one go because the product form lets an admin
 * change a product's category without leaving the page; resolving on each
 * change would mean a round trip per keystroke of indecision. Three queries,
 * resolved in memory.
 */
export const getProductFormAttributes = async (): Promise<
  Record<string, ProductFormAttribute[]>
> => {
  try {
    const [categoryRows, assignmentRows, specRows] = await Promise.all([
      db
        .select({ uuid: Categories.uuid, parentUuid: Categories.parentUuid })
        .from(Categories),
      db
        .select({
          specificationUuid: SpecificationCategories.specificationUuid,
          categoryUuid: SpecificationCategories.categoryUuid,
          isFilter: SpecificationCategories.isFilter,
          isRule: SpecificationCategories.isRule,
          scope: SpecificationCategories.scope,
          showIf: SpecificationCategories.showIf,
          audience: SpecificationCategories.audience,
          enabledValues: SpecificationCategories.enabledValues,
          order: SpecificationCategories.order,
        })
        .from(SpecificationCategories),
      db
        .select({
          ...DEFINITION_COLUMNS,
          groupName: SpecificationGroups.name,
        })
        .from(Specifications)
        .leftJoin(
          SpecificationGroups,
          eq(Specifications.groupUuid, SpecificationGroups.uuid),
        )
        .orderBy(asc(Specifications.order)),
    ]);

    const parentOf = new Map(
      categoryRows.map((category) => [category.uuid, category.parentUuid]),
    );
    const groupByUuid = new Map(
      specRows.map((spec) => [spec.uuid, spec.groupName]),
    );
    const definitions: AssignmentDefinition[] = specRows.map(
      ({ groupName: _groupName, ...definition }) => definition,
    );

    const byCategory: Record<string, ProductFormAttribute[]> = {};
    for (const category of categoryRows) {
      const chain: string[] = [];
      const seen = new Set<string>();
      let current: string | null = category.uuid;
      while (current && !seen.has(current)) {
        seen.add(current);
        chain.push(current);
        current = parentOf.get(current) ?? null;
      }

      byCategory[category.uuid] = resolveAssignments({
        chain,
        rows: assignmentRows satisfies AssignmentRow[],
        definitions,
      }).map((assignment) => ({
        key: assignment.definition.key,
        label: assignment.definition.label,
        unit: assignment.definition.unit,
        valueType: assignment.definition.valueType,
        allowMultiple: assignment.definition.allowMultiple,
        allowRange: assignment.definition.allowRange,
        ordered: assignment.definition.ordered,
        options: assignment.offeredOptions.map((option) => option.value),
        isFilter: assignment.isFilter,
        isRule: assignment.isRule,
        showIf: assignment.showIf,
        audience: assignment.audience,
        groupName: groupByUuid.get(assignment.definition.uuid) ?? null,
      }));
    }
    return byCategory;
  } catch (error) {
    console.error("getProductFormAttributes failed:", error);
    throw new Error("Failed to fetch product form attributes", {
      cause: error,
    });
  }
};
