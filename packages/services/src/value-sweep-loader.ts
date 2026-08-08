import { db } from "../../../db";
import { Products } from "../../../db/schema/products";
import { getCatalogModel } from "./catalog-model";
import {
  sweepProblems,
  sweepValues,
  type AttributeSweep,
} from "./value-sweep";

// The read half of the value sweep. Kept apart from the logic so the cases that
// matter — a value off the vocabulary, two spellings of one thing — are tested
// without arranging them in a live catalogue first.

/**
 * Flatten one product's stored values into (attribute, value) pairs.
 *
 * A multi-select contributes one pair per ticked value, which is what makes
 * "how many products say 802.3af" answerable. Numbers, booleans, ranges and
 * group rows are skipped: they have no vocabulary to be off, and stringifying
 * them would invent values nobody ever picked.
 */
const flattenValues = (
  stored: Record<string, unknown> | null,
): { specUuid: string; value: string }[] => {
  if (!stored) {
    return [];
  }
  const pairs: { specUuid: string; value: string }[] = [];
  for (const [specUuid, value] of Object.entries(stored)) {
    if (typeof value === "string") {
      pairs.push({ specUuid, value });
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          pairs.push({ specUuid, value: entry });
        }
      }
    }
  }
  return pairs;
};

/**
 * Every attribute whose stored values and offered options have drifted apart.
 *
 * Two queries: the model (cached) and one pass over products. The whole spec
 * column is read here rather than JSON_KEYS, because this check is about the
 * VALUES and not which attributes are answered — the one place in this codebase
 * where pulling the column is the point rather than a mistake.
 */
export const getValueSweep = async (): Promise<AttributeSweep[]> => {
  const [model, products] = await Promise.all([
    getCatalogModel(),
    db.select({ specValues: Products.specValues }).from(Products),
  ]);

  return sweepProblems(
    sweepValues({
      attributes: model.definitions.map((definition) => ({
        specUuid: definition.uuid,
        label: definition.label,
        options: definition.options,
      })),
      values: products.flatMap((product) =>
        flattenValues(product.specValues as Record<string, unknown> | null),
      ),
    }),
  );
};
