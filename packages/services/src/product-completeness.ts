import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { Categories } from "../../../db/schema/categories";
import { Products } from "../../../db/schema/products";
import { SpecificationGroups } from "../../../db/schema/specification-groups";
import type { ProductValues } from "../../../db/types";
import {
  clearHiddenValues,
  completenessProblems,
  visibleAssignments,
  type CompletenessProblem,
  type ResolvedAssignment,
} from "./assignment-resolver";
import { getCatalogModel, resolveFromModel } from "./catalog-model";

// ---------------------------------------------------------------------------
// CATALOG COMPLETENESS.
//
// This exists because of the single most dangerous property of the whole model:
// a rule only fires on items that CARRY its attribute. A camera with a blank
// operating power therefore passes every PoE budget check — and incomplete data
// does not look like an error to anyone. It looks like approval.
//
// So a product may not be sold until every attribute the engine reads on its
// category has a value, and the products that fall short are visible as a list
// somebody owns rather than a surprise at checkout.
// ---------------------------------------------------------------------------

export type ProductCompleteness = {
  productUuid: string;
  name: string;
  categoryUuid: string;
  categoryName: string | null;
  problems: CompletenessProblem[];
  complete: boolean;
};

/**
 * Normalise a product's values before they are stored.
 *
 * Two jobs, both of which have to happen on the SERVER and not merely in the
 * form: drop the values of fields the reveal conditions now hide (a leftover PoE
 * budget on a product whose PoE is "No" would let the engine size a switch off a
 * number that no longer applies), and coerce each value to the type its
 * attribute declares, so nothing downstream has to parse.
 */
export const normalizeProductValues = async (
  categoryUuid: string,
  raw: ProductValues,
): Promise<ProductValues> => {
  const model = await getCatalogModel();
  const resolved = resolveFromModel(model, categoryUuid);

  const typed: ProductValues = {};
  for (const assignment of resolved) {
    const { definition } = assignment;
    const value = raw[definition.uuid];
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (definition.type === "number") {
      const parsed = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(parsed)) {
        typed[definition.uuid] = parsed;
      }
      continue;
    }
    if (definition.type === "boolean") {
      typed[definition.uuid] =
        value === true || value === "true" || value === "Yes";
      continue;
    }
    if (definition.type === "multi_select") {
      const list = Array.isArray(value) ? value.map(String) : [String(value)];
      const cleaned = list.filter((entry) => entry.trim() !== "");
      if (cleaned.length > 0) {
        typed[definition.uuid] = cleaned;
      }
      continue;
    }
    typed[definition.uuid] = String(Array.isArray(value) ? value[0] : value);
  }

  return clearHiddenValues(resolved, typed);
};

/** What a product is missing before it may be published. */
export const getProductCompleteness = async (
  productUuid: string,
): Promise<ProductCompleteness | null> => {
  const [product] = await db
    .select({
      uuid: Products.uuid,
      name: Products.name,
      categoryUuid: Products.categoryUuid,
      categoryName: Categories.name,
      specValues: Products.specValues,
    })
    .from(Products)
    .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
    .where(eq(Products.uuid, productUuid));
  if (!product) {
    return null;
  }

  const model = await getCatalogModel();
  const resolved = resolveFromModel(model, product.categoryUuid);
  const problems = completenessProblems(
    resolved,
    (product.specValues ?? {}) as ProductValues,
  );

  return {
    productUuid: product.uuid,
    name: product.name,
    categoryUuid: product.categoryUuid,
    categoryName: product.categoryName,
    problems,
    complete: problems.length === 0,
  };
};

/**
 * The completeness of many products at once — the admin dashboard.
 *
 * TWO queries regardless of how many products are checked, because the model is
 * already cached and the resolution is pure. A per-product query here would be
 * exactly the fan-out the connection ceiling cannot absorb.
 */
export const getCatalogCompleteness = async (
  productUuids?: string[],
): Promise<ProductCompleteness[]> => {
  const model = await getCatalogModel();

  const rows = await (productUuids && productUuids.length > 0
    ? db
        .select({
          uuid: Products.uuid,
          name: Products.name,
          categoryUuid: Products.categoryUuid,
          categoryName: Categories.name,
          specValues: Products.specValues,
        })
        .from(Products)
        .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid))
        .where(inArray(Products.uuid, productUuids))
    : db
        .select({
          uuid: Products.uuid,
          name: Products.name,
          categoryUuid: Products.categoryUuid,
          categoryName: Categories.name,
          specValues: Products.specValues,
        })
        .from(Products)
        .leftJoin(Categories, eq(Products.categoryUuid, Categories.uuid)));

  // Resolution is per CATEGORY, not per product — dozens of switches in one
  // category resolve their assignment chain exactly once.
  const byCategory = new Map<string, ResolvedAssignment[]>();
  const resolveOnce = (categoryUuid: string): ResolvedAssignment[] => {
    const cachedResolution = byCategory.get(categoryUuid);
    if (cachedResolution) {
      return cachedResolution;
    }
    const resolved = resolveFromModel(model, categoryUuid);
    byCategory.set(categoryUuid, resolved);
    return resolved;
  };

  return rows.map((row) => {
    const resolved = resolveOnce(row.categoryUuid);
    const problems = completenessProblems(
      resolved,
      (row.specValues ?? {}) as ProductValues,
    );
    return {
      productUuid: row.uuid,
      name: row.name,
      categoryUuid: row.categoryUuid,
      categoryName: row.categoryName,
      problems,
      complete: problems.length === 0,
    };
  });
};

export type CategoryCompletenessSummary = {
  categoryUuid: string;
  categoryName: string | null;
  total: number;
  incomplete: number;
};

/** Incomplete counts per category — the "who owns this backlog" view. */
export const getCompletenessByCategory = async (): Promise<
  CategoryCompletenessSummary[]
> => {
  const all = await getCatalogCompleteness();
  const summary = new Map<string, CategoryCompletenessSummary>();

  for (const entry of all) {
    const current = summary.get(entry.categoryUuid) ?? {
      categoryUuid: entry.categoryUuid,
      categoryName: entry.categoryName,
      total: 0,
      incomplete: 0,
    };
    current.total += 1;
    if (!entry.complete) {
      current.incomplete += 1;
    }
    summary.set(entry.categoryUuid, current);
  }

  return [...summary.values()].sort((a, b) => b.incomplete - a.incomplete);
};

/**
 * The fields a product form should render, in order, for the values it currently
 * holds — the reveal already applied.
 */
export const getProductFormFields = async (
  categoryUuid: string,
  values: ProductValues,
): Promise<ResolvedAssignment[]> => {
  const model = await getCatalogModel();
  const resolved = resolveFromModel(model, categoryUuid);
  return visibleAssignments(resolved, values);
};

// ---------------------------------------------------------------------------
// The product form's field list
// ---------------------------------------------------------------------------

// A deliberately NARROW mirror of a reveal condition, for the browser.
//
// The form runs the reveal client-side so it feels immediate, but it must not
// carry a second implementation of the predicate language — that is exactly the
// duplication this model exists to prevent. So only the simple shapes cross the
// wire; anything with AND/OR/NOT serialises as `null`, the field simply shows,
// and the SERVER decides on save. The authority is one evaluator, always.
export type FormRevealCondition = {
  attr: string;
  op: "equals" | "in" | "exists" | "gte" | "lte" | "gt" | "lt";
  values: (string | number | boolean)[];
};

export type ProductFormField = {
  specificationUuid: string;
  label: string;
  description: string | null;
  type: ResolvedAssignment["definition"]["type"];
  unit: string | null;
  ordered: boolean;
  options: ResolvedAssignment["offeredOptions"];
  isRule: boolean;
  isFilter: boolean;
  inherited: boolean;
  showIf: FormRevealCondition | null;
  // The library group this attribute is filed under, so the form can section a
  // long list the way the library is organised. Filing only — it never affects
  // which fields appear or what the engine reads.
  groupName: string | null;
  // Position of that group in the library, so sections come out in the order an
  // author arranged them rather than the order the attributes happen to resolve.
  groupOrder: number;
};

const toFormReveal = (
  predicate: ResolvedAssignment["showIf"],
): FormRevealCondition | null => {
  if (!predicate) {
    return null;
  }
  if (predicate.op === "equals") {
    return { attr: predicate.attr, op: "equals", values: [predicate.value] };
  }
  if (predicate.op === "in") {
    return { attr: predicate.attr, op: "in", values: predicate.values };
  }
  if (predicate.op === "exists") {
    return { attr: predicate.attr, op: "exists", values: [] };
  }
  if (
    predicate.op === "gte" ||
    predicate.op === "lte" ||
    predicate.op === "gt" ||
    predicate.op === "lt"
  ) {
    return { attr: predicate.attr, op: predicate.op, values: [predicate.value] };
  }
  // Composite, negated, or a range — the form shows the field and the server
  // applies the real condition when the product is saved.
  return null;
};

const toFormField = (
  assignment: ResolvedAssignment,
  groups: Map<string, { name: string; order: number }>,
): ProductFormField => ({
  specificationUuid: assignment.definition.uuid,
  label: assignment.definition.label,
  description: assignment.definition.description,
  type: assignment.definition.type,
  unit: assignment.definition.unit,
  ordered: assignment.definition.ordered,
  // The slice this category offers, never the whole master list.
  options: assignment.offeredOptions,
  isRule: assignment.isRule,
  isFilter: assignment.isFilter,
  inherited: assignment.inherited,
  showIf: toFormReveal(assignment.showIf),
  groupName: assignment.definition.groupUuid
    ? (groups.get(assignment.definition.groupUuid)?.name ?? null)
    : null,
  // Ungrouped attributes trail behind every real group.
  groupOrder: assignment.definition.groupUuid
    ? (groups.get(assignment.definition.groupUuid)?.order ??
      Number.MAX_SAFE_INTEGER)
    : Number.MAX_SAFE_INTEGER,
});

/**
 * Form fields for EVERY category, keyed by category uuid.
 *
 * The product form lets an author change the category, and the fields have to
 * change with it — so it is handed the whole map rather than re-fetching on each
 * change. Costs nothing beyond the already-cached model.
 */
export const getProductFormFieldsByCategory = async (): Promise<
  Record<string, ProductFormField[]>
> => {
  const [model, groupRows] = await Promise.all([
    getCatalogModel(),
    db
      .select()
      .from(SpecificationGroups)
      .orderBy(asc(SpecificationGroups.order)),
  ]);
  const groups = new Map(
    groupRows.map((group) => [
      group.uuid,
      { name: group.name, order: group.order },
    ]),
  );

  const byCategory: Record<string, ProductFormField[]> = {};
  for (const categoryUuid of model.chains.keys()) {
    const resolved = resolveFromModel(model, categoryUuid);
    if (resolved.length === 0) {
      continue;
    }
    // Audience gates shopper surfaces, never authoring — everything a category
    // carries appears on the admin form.
    byCategory[categoryUuid] = resolved.map((assignment) =>
      toFormField(assignment, groups),
    );
  }
  return byCategory;
};
