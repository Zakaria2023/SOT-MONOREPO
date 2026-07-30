import type { MatchMode } from "../../../db/enum";
import {
  isAttributePredicate,
  predicateAttributes,
  type AttributePredicate,
  type Predicate,
  type PredicateScalar,
  type ProductValue,
  type ProductValues,
} from "../../../db/types";
import {
  asNumber,
  asOptionList,
  asRange,
  completeGroupRows,
  groupFieldRank,
  groupPicks,
  groupSubField,
  groupTotal,
  hasValue,
  readValue,
  type AttributeIndex,
  type AttributeMeta,
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
 * Evaluate one operator against a single column of a group's rows.
 *
 * Split out because the reduction is the whole difficulty: rows have to become one
 * comparable thing first, and each operator reduces them differently. The
 * reductions are documented on `PredicateField`; every one mirrors a rule the
 * model already applies elsewhere, so nothing new is being invented about what a
 * comparison means.
 *
 * Anything unreadable adds to `missing` rather than returning false. A rule that
 * quietly fails to match is indistinguishable from a rule nothing violated, which
 * is the failure this whole layer exists to avoid.
 */
const walkGroupField = (
  node: AttributePredicate,
  fieldKey: string,
  raw: ProductValue,
  meta: AttributeMeta,
  missing: Set<string>,
): boolean => {
  const field = groupSubField(meta, fieldKey);
  // The column was renamed away or removed from the schema. The condition cannot
  // be answered at all — not "no".
  if (!field) {
    missing.add(node.attr);
    return false;
  }

  // Only rows complete against the CURRENT schema, so a group that outgrew its
  // rows answers "unreadable" rather than "none".
  const readable = completeGroupRows(raw, meta);
  if (readable.length === 0) {
    missing.add(node.attr);
    return false;
  }

  if (node.op === "exists") {
    return true;
  }

  if (field.kind === "select") {
    const picks = groupPicks(raw, meta, fieldKey);
    switch (node.op) {
      // Existential: does ANY row hold this pick. `all` keeps its usual meaning —
      // every pick the product has is within the named set.
      case "equals":
        return picks.length === 1 && picks[0] === String(node.value);
      case "not_equals":
        return !(picks.length === 1 && picks[0] === String(node.value));
      case "in":
        return setMatches(picks, node.values, node.mode);
      case "not_in":
        return !setMatches(picks, node.values, "any");
      default:
        break;
    }
    // A numeric comparison on picks: the HIGHEST rank across rows, so "at least
    // 10G" asks whether the fastest cage clears it.
    const ranks = picks
      .map((pick) => groupFieldRank(field, pick))
      .filter((rank): rank is number => rank !== null);
    if (ranks.length === 0) {
      // An unordered list has no magnitude, so this is unanswerable rather than
      // false — the same call `asNumber` makes for an unordered select.
      missing.add(node.attr);
      return false;
    }
    return compareNumber(node, Math.max(...ranks));
  }

  // A COUNT column. Totalled across rows, the same figure an operand reads.
  const total = groupTotal(raw, meta, fieldKey);
  if (total === null) {
    missing.add(node.attr);
    return false;
  }
  if (node.op === "equals" || node.op === "not_equals") {
    const same = total === Number(node.value);
    return node.op === "equals" ? same : !same;
  }
  if (node.op === "in" || node.op === "not_in") {
    const listed = node.values.some((value) => Number(value) === total);
    return node.op === "in" ? listed : !listed;
  }
  return compareNumber(node, total);
};

/**
 * The numeric operators against one already-reduced figure.
 *
 * A group reduces to a single number, so there is no span to read two ends of —
 * which is why this is simpler than the attribute path and must stay separate from
 * it rather than being folded in.
 */
const compareNumber = (node: AttributePredicate, value: number): boolean => {
  if (node.op === "gt") {
    return value > node.value;
  }
  if (node.op === "gte") {
    return value >= node.value;
  }
  if (node.op === "lt") {
    return value < node.value;
  }
  if (node.op === "lte") {
    return value <= node.value;
  }
  if (node.op === "between") {
    return value >= node.min && value <= node.max;
  }
  return false;
};

// What the item IS, as opposed to what it measures. Optional because most
// callers evaluate a predicate against values alone — a product form applying a
// reveal has no cart and no category chain to offer.
export type PredicateSubject = {
  // The item's own category, then each ancestor up to the root. A product-group
  // condition matches if the named category is anywhere in here, which is what
  // makes a rule about Networking cover a switch filed under SOHO.
  categoryChain?: string[];
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
  subject: PredicateSubject = {},
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
    if (node.op === "in_category") {
      // A caller that supplied no chain cannot answer this. NOT a match, and
      // not silently true either — the rule simply does not fire, the same way
      // an unreadable value does.
      return (subject.categoryChain ?? []).includes(node.categoryUuid);
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

    // A condition about one COLUMN of a group's rows — "has any SFP cage". The
    // whole branch is separate from the scalar path below because a group's value
    // is a list of rows and every operator has to reduce it before comparing; see
    // PredicateField for what each reduction means and why.
    // `hasValue` above already established there is one; this narrows the type
    // without a non-null assertion.
    if (node.field && meta.type === "group" && raw !== undefined) {
      return walkGroupField(node, node.field, raw, meta, missing);
    }

    const list = asOptionList(raw);

    // A value the definition does not know is UNREADABLE, not simply unequal.
    //
    // Left alone this was the quietest failure in the system: a product holding
    // "40g" on a list that has no such option matched nothing, reported nothing,
    // and dropped out of every rule reading that attribute — which looks
    // identical to a product the rule examined and approved. The save path now
    // refuses such a value (see `normalizeProductValues`), so this covers what is
    // already stored, and an import or a hand-edited row.
    //
    // Only for option-backed types: a number, a boolean and a span have no list to
    // be absent from, and a group's picks are validated per row instead.
    //
    // Scanned rather than hashed, deliberately. This is the hottest function in
    // the system — it runs per item, per rule, per side, and again for every
    // conditional reveal — and building a Set here allocated one per call for a
    // list that is almost always three to ten entries. A nested scan of 3 × 8 with
    // no allocation beats one Set construction comfortably at these sizes.
    if (
      (meta.type === "single_select" || meta.type === "multi_select") &&
      meta.options.length > 0 &&
      list.some(
        (value) => !meta.options.some((option) => option.value === value),
      )
    ) {
      missing.add(node.attr);
      return false;
    }

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
  subject: PredicateSubject = {},
): boolean => evaluatePredicate(predicate, values, attributes, subject).matched;

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
    | "too_deep"
    // The condition names a column of a group that is not there, or names a
    // column on an attribute that has no rows at all. Both read as nothing at
    // runtime.
    | "unknown_sub_field"
    // A group was named without saying WHICH column. There is no sensible
    // default: a port count and a port speed are different questions.
    | "missing_sub_field";
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
    if (node.op === "in_category") {
      if (node.categoryUuid.trim() === "") {
        problems.push({
          code: "empty_values",
          message: "A product-group condition has no group picked.",
        });
      }
      // Whether the category still EXISTS is not checked here: this validator
      // is given the attribute index, not the tree. The resolver already refuses
      // to save a rule pointing at a deleted category.
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

    // Sub-field conditions, checked before the scalar rules below — every one of
    // these reads as nothing at runtime, which is the failure that looks like a
    // rule nobody violated.
    const numeric =
      node.op === "gt" ||
      node.op === "gte" ||
      node.op === "lt" ||
      node.op === "lte" ||
      node.op === "between";

    if (meta.type === "group") {
      if (!node.field) {
        problems.push({
          code: "missing_sub_field",
          message: `"${meta.label}" holds rows, so a condition has to say which part of a row it is about — the count, or one of the picks.`,
          attr: node.attr,
        });
        return;
      }
      const field = groupSubField(meta, node.field);
      if (!field) {
        problems.push({
          code: "unknown_sub_field",
          message: `"${meta.label}" no longer has the sub-field this condition names, so it can never match.`,
          attr: node.attr,
        });
        return;
      }
      if (numeric && field.kind === "select" && !field.ordered) {
        problems.push({
          code: "not_ordered",
          message: `"${field.label}" is an unordered list, so "more than" and "at most" have no meaning on it. Mark it as an ordered scale in the library, or use "is one of".`,
          attr: node.attr,
        });
      }
      if (!numeric && field.kind === "number" && node.op !== "exists") {
        // Comparing a count by equality is legal but almost never what was meant,
        // and it is silent when it is wrong.
        problems.push({
          code: "not_ordered",
          message: `"${field.label}" is a count, so "is one of" compares exact totals. Use "at least" or "at most" unless an exact number is really what you want.`,
          attr: node.attr,
        });
      }
      return;
    }

    if (node.field) {
      problems.push({
        code: "unknown_sub_field",
        message: `"${meta.label}" does not hold rows, so it has no sub-fields for a condition to name.`,
        attr: node.attr,
      });
      return;
    }

    if (numeric && meta.type !== "number" && !meta.ordered) {
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
