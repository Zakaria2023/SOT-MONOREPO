import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { CompatibilityRules } from "../../../db/schema/compatibility-rules";
import { Products } from "../../../db/schema/products";
import { Specifications } from "../../../db/schema/specifications";
import { evaluateRules } from "./rule-engine";
import type {
  CompatibilityReport,
  EngineCatalogProduct,
  EngineItem,
  EngineRule,
  SelectionInput,
} from "./rule-engine";

/**
 * Load the enabled rules, the selected products, and the catalog (for
 * suggestions) from the database and run the pure evaluator over them.
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

  const [ruleRows, specRows, productRows] = await Promise.all([
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
      })
      .from(Specifications),
    db
      .select({
        uuid: Products.uuid,
        name: Products.name,
        technicalAttributes: Products.technicalAttributes,
      })
      .from(Products),
  ]);

  const specByUuid = new Map(specRows.map((spec) => [spec.uuid, spec]));

  const rules: EngineRule[] = ruleRows.flatMap((rule) => {
    const consumer = specByUuid.get(rule.consumerSpecUuid);
    const provider = specByUuid.get(rule.providerSpecUuid);
    // A rule pointing at a deleted spec can't be evaluated — skip it.
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
        condition: rule.condition,
        severity: rule.severity,
        consumerSpec: {
          key: consumer.key,
          label: consumer.label,
          unit: consumer.unit,
        },
        providerSpec: {
          key: provider.key,
          label: provider.label,
          unit: provider.unit,
        },
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

  return evaluateRules(rules, engineSelection, catalog);
};
