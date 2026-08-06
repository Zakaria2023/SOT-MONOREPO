// ---------------------------------------------------------------------------
// WHAT A PRODUCT NEEDS IN ORDER TO WORK.
//
// Pure — no database, so the reduction below is testable on its own and the
// loading stays where every other load lives.
//
// It answers `sys.accessory_completeness` from §2.9 without storing it: "requires
// separately-sold parts to function as described" is not a boolean somebody
// ticks, it is what the composition rows already say. Stored as well, it would be
// one fact in two places, and the day they disagree the badge on the product page
// and the warning in the basket say opposite things.
// ---------------------------------------------------------------------------

// One row of a product's composition, as the engine reads it.
export type CompositionPart = {
  parentUuid: string;
  childUuid: string;
  // The child's name, resolved at load, so a finding can say "the Holder" rather
  // than a uuid. A finding a buyer cannot read is a finding they cannot act on.
  childName: string;
  quantity: number;
  included: boolean;
  note: string | null;
};

export type CompositionIndex = {
  // Parent uuid → its parts.
  byParent: Map<string, CompositionPart[]>;
  // Parents that have at least one part sold SEPARATELY. The check below runs
  // only for these, and it is a small set — most products need nothing.
  needsSeparateParts: Set<string>;
};

export const indexComposition = (
  parts: CompositionPart[],
): CompositionIndex => {
  const byParent = new Map<string, CompositionPart[]>();
  const needsSeparateParts = new Set<string>();
  for (const part of parts) {
    const list = byParent.get(part.parentUuid) ?? [];
    list.push(part);
    byParent.set(part.parentUuid, list);
    if (!part.included) {
      needsSeparateParts.add(part.parentUuid);
    }
  }
  return { byParent, needsSeparateParts };
};

/**
 * Whether this product needs something that does not come in its box.
 *
 * `sys.accessory_completeness`, derived. False for a product with no rows at all
 * and for a bundle whose every part is included — both are complete, and they
 * are complete for different reasons that the buyer does not need to know apart.
 */
export const requiresSeparateParts = (
  index: CompositionIndex,
  productUuid: string,
): boolean => index.needsSeparateParts.has(productUuid);

/** Everything in the box, for a product page's "what you get" list. */
export const includedParts = (
  index: CompositionIndex,
  productUuid: string,
): CompositionPart[] =>
  (index.byParent.get(productUuid) ?? []).filter((part) => part.included);

// A part a basket is short of.
export type MissingPart = {
  // The product that needs it.
  parentUuid: string;
  childUuid: string;
  childName: string;
  // How many the basket is short by, after counting what is already in it.
  shortBy: number;
  note: string | null;
};

/**
 * Parts a selection is missing, given what it already holds.
 *
 * QUANTITY-AWARE, not presence-only. Two DoubleButtons need two Holders, and a
 * check that stopped at "is there a Holder in the basket" would wave the second
 * one through — which is the same failure as a presence rule with no
 * `perTriggerQuantity`, and it looks like a passing check.
 *
 * Only `included: false` rows are considered. A bundle's contents are already in
 * the box; demanding the buyer also add them to the basket would ask them to pay
 * twice and then block them for not having.
 *
 * A part that IS in the basket, in enough quantity, produces nothing. Silence is
 * the common answer here and it has to stay cheap.
 */
export const missingParts = (
  index: CompositionIndex,
  selection: { productUuid: string; quantity: number }[],
): MissingPart[] => {
  const held = new Map<string, number>();
  for (const line of selection) {
    held.set(
      line.productUuid,
      (held.get(line.productUuid) ?? 0) + line.quantity,
    );
  }

  const findings: MissingPart[] = [];
  // Over the DISTINCT products, using the totals above — not over the lines. A
  // basket holding the same product on two lines is holding one product twice,
  // and walking the lines would both report it twice and check each line against
  // the full stock as though the other line did not exist.
  for (const [parentUuid, parentQuantity] of held) {
    if (!index.needsSeparateParts.has(parentUuid)) {
      continue;
    }
    for (const part of index.byParent.get(parentUuid) ?? []) {
      if (part.included) {
        continue;
      }
      // N of the parent demand N × qty of the part, in total. The same
      // arithmetic a presence requirement does, and for the same reason: a rule
      // that counts sets rather than units passes a design that is short.
      const needed = part.quantity * parentQuantity;
      const have = held.get(part.childUuid) ?? 0;
      if (have >= needed) {
        continue;
      }
      findings.push({
        parentUuid,
        childUuid: part.childUuid,
        childName: part.childName,
        shortBy: needed - have,
        note: part.note,
      });
    }
  }
  return findings;
};
