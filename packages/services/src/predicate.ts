import type { MatchMode } from "../../../db/enum";
import {
  isAttributePredicate,
  predicateAttributes,
  type Predicate,
  type PredicateScalar,
  type ProductValues,
} from "../../../db/types";
import {
  asNumber,
  asOptionList,
  asRange,
  hasValue,
  readValue,
  type AttributeIndex,
} from "./spec-values";

// ---------------------------------------------------------------------------
// THE predicate evaluator. One condition language, one evaluator.
//
// The same function answers all four questions the system asks about a value:
//   - should this attribute be revealed on this product form?   (assignment)
//   - does this item count as a consumer / a provider?          (relationship)
//   - is this presence rule active?                             (relationship)
//   - does this shopper's filter selection reveal that facet?   (storefront)
//
// Four shapes with four evaluators is how "if PoE = Yes" ends up implemented
// four different ways and answering differently in each. Pure — no I/O.
// ---------------------------------------------------------------------------

export type PredicateResult = {
  matched: boolean;
  // Attributes the predicate needed but the item had no value for. A predicate
  // is never "true because the data was missing" — the caller decides what to do
  // with an unknown, and for a rule that decision is to report the item as
  // skipped rather than silently pass it.
  missing: string[];
};

const scalarEquals = (values: string[], target: PredicateScalar): boolean => {
  const wanted = String(target);
  // On a multi-select, "equals" means the ticked set is exactly this one value —
  // not "contains it". Containment is `in` with mode "any".
  return values.length === 1 && values[0] === wanted;
};

const setMatches = (
  values: string[],
  wanted: PredicateScalar[],
  mode: MatchMode,
): boolean => {
  const targets = new Set(wanted.map(String));
  if (values.length === 0) {
    return false;
  }
  if (mode === "all") {
    // "Only these values, nothing else" — the item's set is a subset.
    return values.every((value) => targets.has(value));
  }
  return values.some((value) => targets.has(value));
};

/**
 * Evaluate a predicate against one item's values.
 *
 * `missing` collects every attribute the tree needed and the item did not have,
 * even when the result is already decided — the caller wants the full picture to
 * explain itself, not the first thing that failed.
 */
export const evaluatePredicate = (
  predicate: Predicate | null,
  values: ProductValues,
  attributes: AttributeIndex,
): PredicateResult => {
  if (!predicate) {
    return { matched: true, missing: [] };
  }
  const missing = new Set<string>();

  const walk = (node: Predicate): boolean => {
    if (node.op === "all") {
      // Evaluate every child so `missing` is complete, then AND the results.
      return node.children.map(walk).every(Boolean);
    }
    if (node.op === "any") {
      return node.children.map(walk).some(Boolean);
    }
    if (node.op === "not") {
      return !walk(node.child);
    }

    const meta = attributes.get(node.attr);
    // A predicate naming an attribute that no longer exists cannot be evaluated.
    // It reports as unmatched AND as missing, so the admin sees a broken rule
    // rather than a rule that quietly stopped applying.
    if (!meta) {
      missing.add(node.attr);
      return false;
    }

    const raw = readValue(values, node.attr);
    if (!hasValue(raw)) {
      missing.add(node.attr);
      return node.op === "not_equals" || node.op === "not_in"
        ? // "is not X" on a blank value is not a confident yes. Treated as false
          // so a missing value can never satisfy a requirement by accident.
          false
        : false;
    }

    const list = asOptionList(raw);

    switch (node.op) {
      case "equals":
        return scalarEquals(list, node.value);
      case "not_equals":
        return !scalarEquals(list, node.value);
      case "in":
        return setMatches(list, node.values, node.mode);
      case "not_in":
        return !setMatches(list, node.values, "any");
      case "exists":
        return true;
      case "gt":
      case "gte":
      case "lt":
      case "lte":
      case "between": {
        // On a SPAN, a comparison holds only if the WHOLE span satisfies it, so
        // each operator reads the end that could break it: "at least 10" is
        // judged on the low end, "at most 10" on the high end. A −20 to 60 °C
        // part is not "at most 40" just because one end of it is.
        const range = asRange(raw);
        const low = range ? range.min : asNumber(raw, meta);
        const high = range ? range.max : low;
        // An unordered dropdown has no magnitude, so a numeric comparison on it
        // is not false — it is unanswerable. Reported as missing.
        if (low === null || high === null) {
          missing.add(node.attr);
          return false;
        }
        if (node.op === "gt") {
          return low > node.value;
        }
        if (node.op === "gte") {
          return low >= node.value;
        }
        if (node.op === "lt") {
          return high < node.value;
        }
        if (node.op === "lte") {
          return high <= node.value;
        }
        return low >= node.min && high <= node.max;
      }
      default:
        return false;
    }
  };

  return { matched: walk(predicate), missing: [...missing] };
};

/** The plain boolean, for callers that don't care why. */
export const predicateMatches = (
  predicate: Predicate | null,
  values: ProductValues,
  attributes: AttributeIndex,
): boolean => evaluatePredicate(predicate, values, attributes).matched;

// ---------------------------------------------------------------------------
// Authoring-time validation
// ---------------------------------------------------------------------------

export type PredicateProblem = {
  code:
    | "unknown_attribute"
    | "empty_group"
    | "empty_values"
    | "not_ordered"
    | "bad_range"
    | "too_deep";
  message: string;
  attr?: string;
};

const MAX_PREDICATE_DEPTH = 6;

/**
 * Check a predicate an author just built, before it is saved.
 *
 * Everything here is a mistake that would otherwise be invisible at runtime: a
 * numeric comparison on an unordered dropdown silently never matches, an empty
 * `in` list silently never matches, and a predicate pointing at a deleted
 * attribute silently disables whatever it guards.
 */
export const validatePredicate = (
  predicate: Predicate | null,
  attributes: AttributeIndex,
): PredicateProblem[] => {
  if (!predicate) {
    return [];
  }
  const problems: PredicateProblem[] = [];

  const walk = (node: Predicate, depth: number): void => {
    if (depth > MAX_PREDICATE_DEPTH) {
      problems.push({
        code: "too_deep",
        message: `Condition is nested more than ${MAX_PREDICATE_DEPTH} levels deep — split it into separate rules.`,
      });
      return;
    }
    if (node.op === "all" || node.op === "any") {
      if (node.children.length === 0) {
        problems.push({
          code: "empty_group",
          message: `An "${node.op} of" group with no conditions inside it always ${node.op === "all" ? "matches" : "fails"}.`,
        });
      }
      node.children.forEach((child) => walk(child, depth + 1));
      return;
    }
    if (node.op === "not") {
      walk(node.child, depth + 1);
      return;
    }

    const meta = attributes.get(node.attr);
    if (!meta) {
      problems.push({
        code: "unknown_attribute",
        message: "This condition refers to an attribute that no longer exists.",
        attr: node.attr,
      });
      return;
    }
    if (
      (node.op === "in" || node.op === "not_in") &&
      node.values.length === 0
    ) {
      problems.push({
        code: "empty_values",
        message: `"${meta.label} is one of" has no values selected, so it can never match.`,
        attr: node.attr,
      });
    }
    if (
      (node.op === "gt" ||
        node.op === "gte" ||
        node.op === "lt" ||
        node.op === "lte" ||
        node.op === "between") &&
      meta.type !== "number" &&
      !meta.ordered
    ) {
      problems.push({
        code: "not_ordered",
        message: `"${meta.label}" is an unordered list, so "more than" and "at most" have no meaning on it. Mark it as an ordered scale in the library, or use "is one of".`,
        attr: node.attr,
      });
    }
    if (node.op === "between" && node.min > node.max) {
      problems.push({
        code: "bad_range",
        message: `"${meta.label} is between" has its lower bound above its upper bound.`,
        attr: node.attr,
      });
    }
  };

  walk(predicate, 1);
  return problems;
};

/** Re-exported so callers don't reach into db/types for the walker. */
export { predicateAttributes, isAttributePredicate };
