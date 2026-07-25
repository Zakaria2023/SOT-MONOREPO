import { asc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { Categories } from "../../../db/schema/categories";
import { CompatibilityRules } from "../../../db/schema/compatibility-rules";
import { Products } from "../../../db/schema/products";
import { SpecificationCategories } from "../../../db/schema/specification-categories";
import { Specifications } from "../../../db/schema/specifications";
import {
  resolveAssignments,
  type AssignmentDefinition,
  type AssignmentRow,
} from "./assignment-resolver";
import { evaluateRules } from "./rule-engine";
import type {
  CompatibilityReport,
  EngineCatalogProduct,
  EngineItem,
  EngineRule,
  EngineSpec,
  SelectionInput,
} from "./rule-engine";

/**
 * Load the enabled rules, the selected products, and the catalog (for
 * suggestions) from the database and run the pure evaluator over them.
 *
 * A product only brings an attribute to a rule when its category ASSIGNS that
 * attribute with "Use in rules" on. That switch is the whole point of the
 * assignment model: a value can live on a product for the engine, or show to a
 * shopper as a filter, or both, or neither — and this is where "use in rules"
 * stops being a label and starts deciding what the engine can see.
 *
 * Every query here is fixed-count. The connection ceiling is shared across all
 * apps, so nothing may fan out per product or per category.
 */
export const checkCompatibility = async (
  selection: SelectionInput[],
): Promise<CompatibilityReport> => {
  const items = selection.filter((item) => item.quantity > 0);
  if (items.length === 0) {
    return {
      results: [],
      passed: 0,
      warnings: 0,
      failures: 0,
      notApplicable: 0,
    };
  }

  const [ruleRows, specRows, categoryRows, assignmentRows, productRows] =
    await Promise.all([
      db
        .select()
        .from(CompatibilityRules)
        .where(eq(CompatibilityRules.enabled, true)),
      db
        .select({
          uuid: Specifications.uuid,
          key: Specifications.key,
          label: Specifications.label,
          unit: Specifications.unit,
          ordered: Specifications.ordered,
          options: Specifications.options,
          // The resolver needs the rest of the definition to slice options.
          valueType: Specifications.valueType,
          inputType: Specifications.inputType,
          allowMultiple: Specifications.allowMultiple,
          allowRange: Specifications.allowRange,
          order: Specifications.order,
        })
        .from(Specifications)
        .orderBy(asc(Specifications.order)),
      db
        .select({
          uuid: Categories.uuid,
          parentUuid: Categories.parentUuid,
        })
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
      // Every product with attributes can satisfy a rule or be suggested; the
      // selected products are always included so the report covers all of them.
      db
        .select({
          uuid: Products.uuid,
          name: Products.name,
          categoryUuid: Products.categoryUuid,
          technicalAttributes: Products.technicalAttributes,
        })
        .from(Products),
    ]);

  const specByUuid = new Map(specRows.map((spec) => [spec.uuid, spec]));

  // The master option list flattened to values in scale order — what the
  // ordered lte/gte comparators rank against.
  const toEngineSpec = (spec: (typeof specRows)[number]): EngineSpec => ({
    key: spec.key,
    label: spec.label,
    unit: spec.unit,
    ordered: spec.ordered,
    scale: (spec.options ?? []).map((option) => option.value),
  });

  // A conditional rule has no provider product at all — its capacity is the
  // lookup table — so it gets a stand-in carrying just a label for the report.
  const operandFor = (specUuid: string | null): EngineSpec | null => {
    if (!specUuid) {
      return null;
    }
    const spec = specByUuid.get(specUuid);
    return spec ? toEngineSpec(spec) : null;
  };

  const LOOKUP_CAPACITY: EngineSpec = {
    key: "",
    label: "the limit for its configuration",
    unit: null,
  };

  const rules: EngineRule[] = ruleRows.flatMap((rule) => {
    const consumer = operandFor(rule.consumerSpecUuid);
    const provider =
      rule.kind === "conditional"
        ? LOOKUP_CAPACITY
        : operandFor(rule.providerSpecUuid);
    // A rule pointing at a deleted spec can't be evaluated.
    if (!consumer || !provider) {
      return [];
    }
    return [
      {
        uuid: rule.uuid,
        name: rule.name,
        description: rule.description,
        kind: rule.kind,
        comparator: rule.comparator,
        headroomPercent: rule.headroomPercent,
        ratioLimit: rule.ratioLimit,
        allocation: rule.allocation,
        condition: rule.condition,
        severity: rule.severity,
        consumerSpec: consumer,
        providerSpec: provider,
        lookup: rule.lookup,
      },
    ];
  });

  // --- Which attributes each category lets the engine read -----------------

  const parentOf = new Map(
    categoryRows.map((category) => [category.uuid, category.parentUuid]),
  );
  const definitions: AssignmentDefinition[] = specRows.map((spec) => ({
    uuid: spec.uuid,
    key: spec.key,
    label: spec.label,
    valueType: spec.valueType,
    inputType: spec.inputType,
    unit: spec.unit,
    allowMultiple: spec.allowMultiple,
    allowRange: spec.allowRange,
    ordered: spec.ordered,
    options: spec.options,
    order: spec.order,
  }));

  // Resolved once per category that actually has products in play, in memory.
  const ruleKeysByCategory = new Map<string, Set<string>>();
  const ruleKeysFor = (categoryUuid: string | null): Set<string> | null => {
    if (!categoryUuid) {
      return null;
    }
    const cached = ruleKeysByCategory.get(categoryUuid);
    if (cached) {
      return cached;
    }
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | null = categoryUuid;
    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(current);
      current = parentOf.get(current) ?? null;
    }
    const keys = new Set(
      resolveAssignments({
        chain,
        rows: assignmentRows satisfies AssignmentRow[],
        definitions,
      })
        .filter((assignment) => assignment.isRule)
        .map((assignment) => assignment.definition.key),
    );
    ruleKeysByCategory.set(categoryUuid, keys);
    return keys;
  };

  /**
   * A product's attributes as the engine is allowed to see them. Anything its
   * category doesn't assign with "Use in rules" is withheld, so turning that
   * switch off genuinely removes the value from every rule.
   *
   * A product whose category assigns nothing at all keeps its raw attributes:
   * that is a catalog not yet described by assignments, and silently making
   * every rule inapplicable would look like the engine had stopped working.
   */
  const engineAttributes = (
    product: (typeof productRows)[number],
  ): Record<string, string> => {
    const attributes = product.technicalAttributes ?? {};
    const allowed = ruleKeysFor(product.categoryUuid);
    if (!allowed || allowed.size === 0) {
      return attributes;
    }
    return Object.fromEntries(
      Object.entries(attributes).filter(([key]) => allowed.has(key)),
    );
  };

  const productByUuid = new Map(
    productRows.map((product) => [product.uuid, product]),
  );

  const engineSelection: EngineItem[] = items.flatMap((item) => {
    const product = productByUuid.get(item.productUuid);
    if (!product) {
      return [];
    }
    return [
      {
        productUuid: product.uuid,
        name: product.name,
        quantity: item.quantity,
        attributes: engineAttributes(product),
      },
    ];
  });

  const catalog: EngineCatalogProduct[] = productRows.map((product) => ({
    productUuid: product.uuid,
    name: product.name,
    attributes: engineAttributes(product),
  }));

  return evaluateRules(rules, engineSelection, catalog);
};
