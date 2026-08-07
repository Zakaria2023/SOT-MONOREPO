import type { RelationshipFamily } from "../../../db/enum";
import type { AssignmentRow } from "./assignment-resolver";
import {
  isAttributePredicate,
  type Predicate,
  type PredicateScalar,
} from "../../../db/types";

// ---------------------------------------------------------------------------
// CAN THIS RULE EVER FIRE?
//
// A published rule that never engages looks exactly like a published rule that
// passed. Both are silent. That is the failure this file exists to end: a gate
// everybody believes is protecting them, protecting nothing.
//
// The distinction that matters is not dead-or-alive, it is WHOSE PROBLEM. Four
// answers, and only one of them is a mistake:
//
//   unassigned     — the attribute is assigned to no category at all. Nothing
//                    will ever carry a value for it. This one is an authoring
//                    error and it is permanent.
//   no_products    — the attribute is live somewhere, but no category holding it
//                    has any products. Waiting on stock, not broken.
//   no_values      — products are there and none of them answers the attribute.
//                    Waiting on data entry, not broken.
//   value_disabled — the rule tests a value that no category's enabled slice
//                    offers. Dead by configuration, and invisible from either
//                    side: the rule reads fine, the assignment reads fine, and
//                    only the two together are wrong.
//
// Everything here is pure. It takes facts and returns a verdict, so the whole
// thing is testable without a database — which matters, because the interesting
// cases (an attribute assigned only to empty categories, a value narrowed out of
// existence) are ones the live catalogue may not happen to contain today.
// ---------------------------------------------------------------------------

export type AttributeReachStatus =
  | "ok"
  | "unassigned"
  | "no_products"
  | "no_values";

export type RuleReachStatus =
  | "reachable"
  | "unassigned"
  | "no_products"
  | "no_values"
  | "value_disabled";

export type AttributeReach = {
  specUuid: string;
  label: string;
  // Categories where the attribute resolves live — assigned there or inherited
  // from an ancestor, and not suppressed on the way down.
  liveCategories: number;
  categoriesWithProducts: number;
  // Products under those categories that actually hold a value for it. Scoped
  // deliberately: a stale value on a product whose category no longer carries
  // the attribute must not make the attribute look answered.
  productsAnswering: number;
  status: AttributeReachStatus;
};

export type DisabledValue = {
  specUuid: string;
  label: string;
  // Values the rule tests that no live category offers.
  values: PredicateScalar[];
};

export type RuleReach = {
  uuid: string;
  name: string;
  family: RelationshipFamily;
  status: RuleReachStatus;
  // One sentence, aimed at whoever has to act on it.
  reason: string;
  attributes: AttributeReach[];
  disabled: DisabledValue[];
  // Reported, never judged. A scope names market regions and there is no
  // registry of them to check against, so calling one empty would be a guess.
  regions: string[] | null;
};

export type RuleFacts = {
  uuid: string;
  name: string;
  family: RelationshipFamily;
  // Every attribute the rule touches, from `referencedAttributeUuids`.
  attributeUuids: string[];
  // Predicate trees the rule tests values through. Walked here rather than
  // pre-flattened so the `field` case can be excluded where it matters.
  predicates: (Predicate | null)[];
  regions: string[] | null;
};

export type ProductFacts = {
  categoryUuid: string;
  // Top-level keys of the product's stored values — attribute uuids.
  attributeUuids: string[];
};

export type ReachabilityFacts = {
  rules: RuleFacts[];
  attributeLabels: Map<string, string>;
  assignments: AssignmentRow[];
  // Nearest-first ancestor chain per category, as the catalog model builds it.
  chains: Map<string, string[]>;
  products: ProductFacts[];
};

/**
 * The values a predicate tree tests, per attribute.
 *
 * Sub-field conditions are skipped on purpose. `field` names a column inside a
 * `group` attribute's rows, and a category's enabled slice governs the library
 * attribute's own options — not the vocabulary of a sub-field. Treating the two
 * as the same would report a value disabled that was never governed.
 */
export const predicateTestedValues = (
  predicate: Predicate | null,
): Map<string, PredicateScalar[]> => {
  const found = new Map<string, PredicateScalar[]>();
  const add = (attr: string, values: PredicateScalar[]): void => {
    const existing = found.get(attr);
    if (existing) {
      existing.push(...values);
      return;
    }
    found.set(attr, [...values]);
  };

  const walk = (node: Predicate | null): void => {
    if (!node) {
      return;
    }
    if (node.op === "all" || node.op === "any") {
      node.children.forEach(walk);
      return;
    }
    if (node.op === "not") {
      walk(node.child);
      return;
    }
    if (!isAttributePredicate(node) || node.field) {
      return;
    }
    if (node.op === "equals") {
      add(node.attr, [node.value]);
      return;
    }
    if (node.op === "in") {
      add(node.attr, node.values);
    }
  };

  walk(predicate);
  return found;
};

/**
 * Which categories each attribute is live in, and what each of those offers.
 *
 * Nearest ancestor wins, exactly as the resolver does it at query time — a child
 * row overrides its parent's, and a suppression anywhere up the chain that wins
 * the race takes the attribute off that category entirely.
 */
export const resolveLiveCategories = (
  assignments: AssignmentRow[],
  chains: Map<string, string[]>,
): Map<string, Map<string, string[] | null>> => {
  // categoryUuid -> specUuid -> row
  const byCategory = new Map<string, Map<string, AssignmentRow>>();
  for (const row of assignments) {
    const existing = byCategory.get(row.categoryUuid);
    if (existing) {
      existing.set(row.specificationUuid, row);
      continue;
    }
    byCategory.set(row.categoryUuid, new Map([[row.specificationUuid, row]]));
  }

  // specUuid -> categoryUuid -> enabled values (null = every option offered)
  const live = new Map<string, Map<string, string[] | null>>();

  for (const [categoryUuid, chain] of chains) {
    // Every attribute reachable from anywhere in this category's chain.
    const candidates = new Set<string>();
    for (const ancestor of chain) {
      for (const specUuid of byCategory.get(ancestor)?.keys() ?? []) {
        candidates.add(specUuid);
      }
    }

    for (const specUuid of candidates) {
      // Nearest first, so the first hit is the winner.
      const winner = chain
        .map((ancestor) => byCategory.get(ancestor)?.get(specUuid))
        .find((row) => row !== undefined);
      if (!winner || winner.suppressed) {
        continue;
      }
      const forSpec = live.get(specUuid);
      const offered = winner.enabledValues ?? null;
      if (forSpec) {
        forSpec.set(categoryUuid, offered);
        continue;
      }
      live.set(specUuid, new Map([[categoryUuid, offered]]));
    }
  }

  return live;
};

const REASON: Record<AttributeReachStatus, (label: string) => string> = {
  ok: (label) => `${label} is reachable.`,
  unassigned: (label) =>
    `${label} is assigned to no category, so nothing can ever carry a value for it. This one is an authoring mistake.`,
  no_products: (label) =>
    `${label} is set up correctly, but every category carrying it is empty. It starts working the moment stock arrives.`,
  no_values: (label) =>
    `Products carry ${label}, but none of them has been given a value. This is data entry, not a fault in the rule.`,
};

/**
 * Diagnose every rule.
 *
 * The worst attribute decides the rule, in the order above: an unassigned
 * attribute is reported ahead of an empty category, because fixing the empty
 * category would not help while the attribute is still assigned nowhere.
 */
export const diagnoseRules = (facts: ReachabilityFacts): RuleReach[] => {
  const live = resolveLiveCategories(facts.assignments, facts.chains);

  const productsPerCategory = new Map<string, number>();
  for (const product of facts.products) {
    productsPerCategory.set(
      product.categoryUuid,
      (productsPerCategory.get(product.categoryUuid) ?? 0) + 1,
    );
  }

  const labelOf = (specUuid: string): string =>
    facts.attributeLabels.get(specUuid) ?? "a deleted attribute";

  const reachOf = (specUuid: string): AttributeReach => {
    const categories = live.get(specUuid);
    if (!categories || categories.size === 0) {
      return {
        specUuid,
        label: labelOf(specUuid),
        liveCategories: 0,
        categoriesWithProducts: 0,
        productsAnswering: 0,
        status: "unassigned",
      };
    }

    let categoriesWithProducts = 0;
    for (const categoryUuid of categories.keys()) {
      if ((productsPerCategory.get(categoryUuid) ?? 0) > 0) {
        categoriesWithProducts += 1;
      }
    }

    const productsAnswering = facts.products.filter(
      (product) =>
        categories.has(product.categoryUuid) &&
        product.attributeUuids.includes(specUuid),
    ).length;

    const status: AttributeReachStatus =
      categoriesWithProducts === 0
        ? "no_products"
        : productsAnswering === 0
          ? "no_values"
          : "ok";

    return {
      specUuid,
      label: labelOf(specUuid),
      liveCategories: categories.size,
      categoriesWithProducts,
      productsAnswering,
      status,
    };
  };

  // "ok" is deliberately absent: this is the list of things that STOP a rule,
  // in the order they should be reported.
  const ORDER: Exclude<AttributeReachStatus, "ok">[] = [
    "unassigned",
    "no_products",
    "no_values",
  ];

  return facts.rules.map((rule) => {
    const attributes = rule.attributeUuids.map(reachOf);

    // A value the rule tests that no live category offers. Checked only on
    // attributes that are otherwise fine — reporting a narrowed value on an
    // attribute nothing carries would bury the real problem under a detail.
    const disabled: DisabledValue[] = [];
    for (const predicate of rule.predicates) {
      for (const [attr, values] of predicateTestedValues(predicate)) {
        const categories = live.get(attr);
        if (!categories || categories.size === 0) {
          continue;
        }
        const offered = [...categories.values()];
        // One unrestricted category is enough — every option is reachable there.
        if (offered.some((slice) => slice === null)) {
          continue;
        }
        const reachable = new Set(offered.flat());
        const missing = [...new Set(values)].filter(
          (value) => !reachable.has(String(value)),
        );
        if (missing.length > 0) {
          disabled.push({
            specUuid: attr,
            label: labelOf(attr),
            values: missing,
          });
        }
      }
    }

    const worst = ORDER.find((status) =>
      attributes.some((attribute) => attribute.status === status),
    );

    if (worst) {
      const culprit = attributes.find(
        (attribute) => attribute.status === worst,
      );
      return {
        uuid: rule.uuid,
        name: rule.name,
        family: rule.family,
        status: worst,
        reason: REASON[worst](culprit ? culprit.label : "An attribute"),
        attributes,
        disabled,
        regions: rule.regions,
      };
    }

    if (disabled.length > 0) {
      const first = disabled[0];
      return {
        uuid: rule.uuid,
        name: rule.name,
        family: rule.family,
        status: "value_disabled",
        reason: `This rule tests ${first.label} for ${first.values
          .map((value) => `"${String(value)}"`)
          .join(", ")}, which no category offers any more. The rule reads fine and the assignment reads fine — only the two together are wrong.`,
        attributes,
        disabled,
        regions: rule.regions,
      };
    }

    return {
      uuid: rule.uuid,
      name: rule.name,
      family: rule.family,
      status: "reachable",
      reason:
        attributes.length === 0
          ? "This rule names no attribute, so nothing here can stop it firing."
          : "Everything this rule reads is assigned, stocked and filled in.",
      attributes,
      disabled,
      regions: rule.regions,
    };
  });
};
