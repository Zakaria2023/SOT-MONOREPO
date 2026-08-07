import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { Categories } from "../../../db/schema/categories";
import { ProductCompatibility } from "../../../db/schema/product-compatibility";
import { ProductComposition } from "../../../db/schema/product-composition";
import { Products } from "../../../db/schema/products";
import { ProjectVariables } from "../../../db/schema/project-variables";
import { Relationships } from "../../../db/schema/relationships";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import { SpecificationOptionSets } from "../../../db/schema/specification-option-sets";
import { Specifications } from "../../../db/schema/specifications";
import type { ProductValues } from "../../../db/types";
import {
  expectedAttributes,
  resolveAssignments,
  type AssignmentDefinition,
  type AssignmentRow,
  type ResolvedAssignment,
} from "./assignment-resolver";
import {
  indexOptionSets,
  resolveGroupFields,
  resolveVocabulary,
  type OptionSetIndex,
} from "./library-options";
import {
  indexCompatibility,
  type CompatibilityIndex,
} from "./product-compatibility";
import {
  indexComposition,
  type CompositionIndex,
} from "./product-composition";
import type {
  EngineItem,
  EngineRelationship,
  EngineVariable,
} from "./relationship-engine";
import { buildChains } from "./category-tree";
import { indexAttributes, type AttributeIndex } from "./spec-values";

// ---------------------------------------------------------------------------
// Loading the catalog model.
//
// The design check runs on every cart change, for every shopper, and the shared
// database has a hard connection ceiling. So the rule here is absolute: a FIXED
// number of queries, regardless of how many lines are in the cart, how many
// rules exist, or how big the catalog is. Never one query per line, per rule, or
// per candidate product.
//
// The model itself — definitions, assignments, relationships, project variables
// — is small and changes rarely, so it is loaded once and cached in process,
// invalidated on write. The per-request work is then pure computation.
// ---------------------------------------------------------------------------

export type CatalogModel = {
  definitions: AssignmentDefinition[];
  attributes: AttributeIndex;
  assignments: AssignmentRow[];
  relationships: EngineRelationship[];
  variables: EngineVariable[];
  // Nearest-first ancestor chain for every category, precomputed once. Walking
  // the parent chain per category would otherwise be a query per row.
  chains: Map<string, string[]>;
  // Brand-authored pairs the derived rules cannot reach. Part of the model
  // rather than a per-check query for the same reason everything else here is:
  // it is small, it changes rarely, and the cart check runs on every render.
  compatibility: CompatibilityIndex;
  // What each product contains, and what it needs that is sold separately.
  composition: CompositionIndex;
};

let cached: CatalogModel | null = null;

/**
 * Drop the cached model. Called by every write in the catalog services — an
 * author who publishes a rule expects the very next cart to be judged by it.
 */
export const invalidateCatalogModel = (): void => {
  cached = null;
};

/**
 * The shared-vocabulary index, in ONE query.
 *
 * Lives here with the other loaders rather than beside the option-set service,
 * which imports `invalidateCatalogModel` from this module — putting a loader
 * there and importing it back would be a cycle. Deliberately the cheapest
 * possible shape: no counts, no joins, no ordering, because every read path that
 * turns a `Specifications` row into an option list needs it.
 */
export const loadOptionSetIndex = async (): Promise<OptionSetIndex> => {
  const rows = await db
    .select({
      uuid: SpecificationOptionSets.uuid,
      ordered: SpecificationOptionSets.ordered,
      options: SpecificationOptionSets.options,
    })
    .from(SpecificationOptionSets);
  return indexOptionSets(rows);
};

// Shared vocabularies are resolved HERE, on the way in, so `definition.options`
// means the same thing whether the list is the attribute's own or one it borrows.
// Every consumer below — the resolver's enabled slice, the facets, the
// comparators, the product form — stays unaware that sets exist at all.
const toDefinition = (
  row: typeof Specifications.$inferSelect,
  sets: OptionSetIndex,
): AssignmentDefinition => {
  const vocabulary = resolveVocabulary(row, sets);
  return {
    uuid: row.uuid,
    label: row.label,
    type: row.type,
    unit: row.unit,
    ordered: vocabulary.ordered,
    options: vocabulary.options,
    groupFields: resolveGroupFields(row.groupFields ?? [], sets),
    key: row.key,
    labelAliases: row.labelAliases,
    internalName: row.internalName,
    description: row.description,
    audience: row.audience,
    allowRange: row.allowRange,
    order: row.order,
    groupUuid: row.groupUuid,
  };
};

const toRelationship = (
  row: typeof Relationships.$inferSelect,
): EngineRelationship => ({
  uuid: row.uuid,
  name: row.name,
  description: row.description,
  family: row.family,
  gate: row.gate,
  comparator: row.comparator,
  matchMode: row.matchMode,
  headroomPercent: row.headroomPercent,
  ratioLimit: row.ratioLimit === null ? null : Number(row.ratioLimit),
  allocation: row.allocation,
  perItem: row.perItem,
  consumer: row.consumer ?? null,
  provider: row.provider ?? null,
  consumerWhen: row.consumerWhen ?? null,
  providerWhen: row.providerWhen ?? null,
  lookup: row.lookup ?? null,
  presence: row.presence ?? null,
  scope: row.scope ?? null,
});

/**
 * The whole catalog model in SIX queries, cached.
 *
 * Only PUBLISHED relationships are loaded: a draft rule must never gate a
 * buyer, which is the entire point of having a draft state.
 */
export const getCatalogModel = async (): Promise<CatalogModel> => {
  if (cached) {
    return cached;
  }

  const [specs, assignments, rules, variables, categories, sets, pairs, parts] =
    await Promise.all([
      db.select().from(Specifications).orderBy(asc(Specifications.order)),
      db.select().from(SpecificationCategories),
      db
        .select()
        .from(Relationships)
        .where(eq(Relationships.status, "published")),
      db.select().from(ProjectVariables).orderBy(asc(ProjectVariables.order)),
      db
        .select({ uuid: Categories.uuid, parentUuid: Categories.parentUuid })
        .from(Categories),
      // Alongside the others rather than after them: the model is one round trip
      // wide by design, and a sequential read here would add its full latency to
      // every cold cart check.
      loadOptionSetIndex(),
      db
        .select({
          productUuidA: ProductCompatibility.productUuidA,
          productUuidB: ProductCompatibility.productUuidB,
          verdict: ProductCompatibility.verdict,
          note: ProductCompatibility.note,
          source: ProductCompatibility.source,
        })
        .from(ProductCompatibility),
      // The child's NAME comes back with the row. A finding that names a uuid is
      // one a buyer cannot act on, and resolving it later would be a second query
      // per missing part — the fan-out this whole module exists to avoid.
      db
        .select({
          parentUuid: ProductComposition.parentUuid,
          childUuid: ProductComposition.childUuid,
          childName: Products.name,
          quantity: ProductComposition.quantity,
          included: ProductComposition.included,
          note: ProductComposition.note,
        })
        .from(ProductComposition)
        .innerJoin(Products, eq(ProductComposition.childUuid, Products.uuid)),
    ]);

  const definitions = specs.map((spec) => toDefinition(spec, sets));
  const model: CatalogModel = {
    definitions,
    attributes: indexAttributes(definitions),
    assignments: assignments.map((row) => ({
      specificationUuid: row.specificationUuid,
      categoryUuid: row.categoryUuid,
      isFilter: row.isFilter,
      isRule: row.isRule,
      optional: row.optional,
      scope: row.scope,
      showIf: row.showIf ?? null,
      audience: row.audience,
      enabledValues: row.enabledValues ?? null,
      suppressed: row.suppressed,
      order: row.order,
    })),
    relationships: rules.map(toRelationship),
    variables: variables.map((row) => ({
      uuid: row.uuid,
      label: row.label,
      unit: row.unit,
      type: row.type,
      // Unanswered until a cart supplies it. The default stands in only when the
      // author gave one; otherwise a rule needing it simply does not run.
      //
      // A boolean's default has to come back as a BOOLEAN. It is stored in the
      // same decimal column as a number, and coercing it with `Number` handed the
      // engine a 1 — where `variable_true` tests `value === true`, so a presence
      // requirement the author defaulted to "yes" was never satisfied and the
      // buyer was blocked over an answer already on file.
      value:
        row.defaultValue === null
          ? null
          : row.type === "boolean"
            ? Number(row.defaultValue) !== 0
            : Number(row.defaultValue),
    })),
    chains: buildChains(categories),
    compatibility: indexCompatibility(pairs),
    composition: indexComposition(parts),
  };

  cached = model;
  return model;
};

/** Every relationship including drafts — for the admin builder and preview. */
export const getAllRelationships = async (): Promise<EngineRelationship[]> => {
  const rows = await db
    .select()
    .from(Relationships)
    .orderBy(asc(Relationships.createdAt));
  return rows.map(toRelationship);
};

/**
 * The attributes a category carries, resolved through the inheritance chain.
 *
 * Reads the cached model, so calling this per category page costs no queries at
 * all after the first load.
 */
export const resolveCategoryAssignments = async (
  categoryUuid: string,
): Promise<ResolvedAssignment[]> => {
  const model = await getCatalogModel();
  const chain = model.chains.get(categoryUuid) ?? [categoryUuid];
  return resolveAssignments({
    chain,
    rows: model.assignments,
    definitions: model.definitions,
  });
};

/** The same, from an already-loaded model — for loops that must not re-fetch. */
export const resolveFromModel = (
  model: CatalogModel,
  categoryUuid: string,
): ResolvedAssignment[] =>
  resolveAssignments({
    chain: model.chains.get(categoryUuid) ?? [categoryUuid],
    rows: model.assignments,
    definitions: model.definitions,
  });

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

export type SelectionLine = {
  productUuid: string;
  quantity: number;
};

/**
 * Turn product uuids + quantities into engine items. ONE query for the whole
 * selection, whatever its size.
 *
 * A line whose product no longer exists is dropped rather than throwing: a stale
 * cart must not take checkout down, and the missing line is visible to the buyer
 * as a removed item anyway.
 */
export const loadSelection = async (
  lines: SelectionLine[],
): Promise<EngineItem[]> => {
  const active = lines.filter((line) => line.quantity > 0);
  if (active.length === 0) {
    return [];
  }

  const [rows, model] = await Promise.all([
    db
      .select({
        uuid: Products.uuid,
        name: Products.name,
        categoryUuid: Products.categoryUuid,
        specValues: Products.specValues,
      })
      .from(Products)
      .where(
        inArray(
          Products.uuid,
          active.map((line) => line.productUuid),
        ),
      ),
    getCatalogModel(),
  ]);
  const byUuid = new Map(rows.map((row) => [row.uuid, row]));

  // What each CATEGORY owes the engine, resolved once per category rather than
  // once per line — a cart of thirty cameras from one category resolves once.
  const expectedByCategory = new Map<string, string[]>();
  const expectsFor = (categoryUuid: string): string[] => {
    const cached = expectedByCategory.get(categoryUuid);
    if (cached) {
      return cached;
    }
    const expects = expectedAttributes(resolveFromModel(model, categoryUuid));
    expectedByCategory.set(categoryUuid, expects);
    return expects;
  };

  return active.flatMap((line) => {
    const product = byUuid.get(line.productUuid);
    if (!product) {
      return [];
    }
    return [
      {
        productUuid: product.uuid,
        name: product.name,
        quantity: line.quantity,
        values: (product.specValues ?? {}) as ProductValues,
        expects: expectsFor(product.categoryUuid),
        // The chain is already in the model — it is what resolution walks — so
        // a product-group condition costs nothing extra to answer.
        categoryChain: model.chains.get(product.categoryUuid) ?? [
          product.categoryUuid,
        ],
      },
    ];
  });
};

// The catalog slice offered as replacement suggestions. Deliberately bounded:
// searching the whole catalog on every cart render is exactly the fan-out the
// connection ceiling cannot absorb.
const SUGGESTION_LIMIT = 400;

/**
 * Candidate products the engine may suggest as fixes.
 *
 * Restricted to available products, capped, and loaded in ONE query. The engine
 * filters these in memory against each failing rule's provider side, so the
 * query does not need to know anything about the rules.
 */
export const loadSuggestionCatalog = async (): Promise<
  {
    productUuid: string;
    name: string;
    values: ProductValues;
    categoryChain: string[];
  }[]
> => {
  const [rows, model] = await Promise.all([
    db
      .select({
        uuid: Products.uuid,
        name: Products.name,
        categoryUuid: Products.categoryUuid,
        specValues: Products.specValues,
      })
      .from(Products)
      .where(eq(Products.isAvailable, true))
      .limit(SUGGESTION_LIMIT),
    getCatalogModel(),
  ]);

  return rows.map((row) => ({
    productUuid: row.uuid,
    name: row.name,
    values: (row.specValues ?? {}) as ProductValues,
    // Suggestions are filtered against the rule's provider side, and that side
    // may be a product group — so a candidate has to know what it is, not only
    // what it measures.
    categoryChain: model.chains.get(row.categoryUuid) ?? [row.categoryUuid],
  }));
};
