import { eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "../../../db";
import { CompatibilityRules } from "../../../db/schema/compatibility-rules";
import { Products } from "../../../db/schema/products";
import { ProjectVariables } from "../../../db/schema/project-variables";
import { Specifications } from "../../../db/schema/specifications";
import { evaluateRules } from "./rule-engine";
import type {
  CompatibilityReport,
  EngineCatalogProduct,
  EngineItem,
  EngineRule,
  EngineSpec,
  SelectionInput,
  VariableContext,
} from "./rule-engine";

/**
 * Load the enabled rules, the selected products, and the catalog (for
 * suggestions) from the database and run the pure evaluator over them.
 */
export const checkCompatibility = async (
  selection: SelectionInput[],
  // The design's answers to the project variables, keyed by variable key.
  // Absent keys fall back to each variable's default, so a rule reading one
  // still has a number rather than quietly not applying.
  variableValues: Record<string, string> = {},
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

  const [ruleRows, specRows, variableRows, productRows] = await Promise.all([
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
      })
      .from(Specifications),
    db.select().from(ProjectVariables),
    // Only products with attributes can satisfy a rule or be suggested; the
    // selected products are always included so the report covers all of them.
    db
      .select({
        uuid: Products.uuid,
        name: Products.name,
        technicalAttributes: Products.technicalAttributes,
      })
      .from(Products)
      .where(
        or(
          isNotNull(Products.technicalAttributes),
          inArray(
            Products.uuid,
            items.map((item) => item.productUuid),
          ),
        ),
      ),
  ]);

  const specByUuid = new Map(specRows.map((spec) => [spec.uuid, spec]));
  const variableByUuid = new Map(
    variableRows.map((variable) => [variable.uuid, variable]),
  );

  // The master option list flattened to values in scale order — what the
  // ordered lte/gte comparators rank against.
  const toEngineSpec = (spec: (typeof specRows)[number]): EngineSpec => ({
    key: spec.key,
    label: spec.label,
    unit: spec.unit,
    ordered: spec.ordered,
    scale: (spec.options ?? []).map((option) => option.value),
  });

  // A variable operand looks the same to the evaluator — key, label, unit —
  // it just resolves from the design's answers instead of an item's specs.
  const toEngineVariable = (
    variable: (typeof variableRows)[number],
  ): EngineSpec => ({
    key: variable.key,
    label: variable.label,
    unit: variable.unit,
    isVariable: true,
  });

  // One side of a rule: whichever operand it was authored with. A conditional
  // rule has no provider at all — its capacity is the lookup table — so it
  // gets a stand-in carrying just a label for the report.
  const operandFor = (
    specUuid: string | null,
    variableUuid: string | null,
  ): EngineSpec | null => {
    if (specUuid) {
      const spec = specByUuid.get(specUuid);
      return spec ? toEngineSpec(spec) : null;
    }
    if (variableUuid) {
      const variable = variableByUuid.get(variableUuid);
      return variable ? toEngineVariable(variable) : null;
    }
    return null;
  };

  const LOOKUP_CAPACITY: EngineSpec = {
    key: "",
    label: "the limit for its configuration",
    unit: null,
  };

  const rules: EngineRule[] = ruleRows.flatMap((rule) => {
    const consumer = operandFor(
      rule.consumerSpecUuid,
      rule.consumerVariableUuid,
    );
    const provider =
      rule.kind === "conditional"
        ? LOOKUP_CAPACITY
        : operandFor(rule.providerSpecUuid, rule.providerVariableUuid);
    // A rule pointing at a deleted spec or variable can't be evaluated.
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
        attributes: product.technicalAttributes ?? {},
      },
    ];
  });

  const catalog: EngineCatalogProduct[] = productRows.map((product) => ({
    productUuid: product.uuid,
    name: product.name,
    attributes: product.technicalAttributes ?? {},
  }));

  // The design's answer wins; the variable's default fills the gap. A variable
  // with neither is simply absent, and rules reading it report not_applicable
  // rather than treating "unanswered" as zero — which would silently pass.
  const variables: VariableContext = {};
  for (const variable of variableRows) {
    const answered = Number(variableValues[variable.key]);
    if (Number.isFinite(answered)) {
      variables[variable.key] = answered;
      continue;
    }
    const fallback = Number(variable.defaultValue);
    if (variable.defaultValue !== null && Number.isFinite(fallback)) {
      variables[variable.key] = fallback;
    }
  }

  return evaluateRules(rules, engineSelection, catalog, variables);
};
