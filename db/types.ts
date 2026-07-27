// ---------------------------------------------------------------------------
// Shared JSON-column shapes for the specification model.
//
// THE BOUNDARY RULE that shapes everything in this file:
//   - a library entry (Specifications) may never name another attribute;
//   - an assignment (SpecificationCategories) may never name another product.
//
// So a condition lives on an assignment, and a comparison between two items
// lives on a relationship. Neither can migrate into the library, which is why
// `Specifications` carries no condition type at all.
//
// Every `attr` in this file is a Specifications.uuid — never a label, never a
// slug. Labels are renameable and slugs are derived from labels, so pointing at
// either means a rename silently orphans stored values and breaks every rule
// that referenced it.
// ---------------------------------------------------------------------------

import { MatchMode, PredicateOperator, RelationshipFamily } from "./enum";

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

// One option in an attribute's MASTER list. Authored once in the library;
// categories narrow which of these they offer but never edit the list itself.
//
// `value` is the stable identity — products store it, rules compare it, and it
// never changes once created. `label` is display text and is free to change.
//
// `rank` positions the option on a scale, and is required when the attribute is
// `ordered`. Deriving order from array position looks equivalent but is not: a
// list typed in the wrong order makes every `lte` comparison silently wrong and
// nothing errors. An explicit rank cannot be silently wrong, and it doubles as
// the real magnitude (1G → 1000) when we want to sort or explain.
//
// `retired` is how an option is removed. Deleting one would leave products
// holding a value that no longer exists in the list, so retirement hides it from
// new picks while keeping existing values valid and comparable.
export type SpecOption = {
  value: string;
  label: string;
  rank: number | null;
  retired: boolean;
};

// ---------------------------------------------------------------------------
// The predicate language — ONE condition shape for the whole system
// ---------------------------------------------------------------------------

// Conditions are needed in four places: the conditional reveal on an
// assignment, the consumer-side filter on a relationship, the provider-side
// filter on a relationship, and a presence trigger. They all use THIS type.
//
// One shape means one evaluator, one admin editor, and one set of bugs. Four
// shapes is how the same "if" logic ends up written four ways, which is exactly
// what this model exists to prevent.
export type PredicateScalar = string | number | boolean;

export type Predicate =
  // Scalar comparison. On a multi-select attribute, `equals` holds when the
  // ticked set is exactly [value].
  | { op: "equals"; attr: string; value: PredicateScalar }
  | { op: "not_equals"; attr: string; value: PredicateScalar }
  // Set membership. `mode` decides what "matches" means when the attribute
  // being tested is multi-select and holds several values at once:
  //   any → the item's values overlap `values` (the common case)
  //   all → the item's values are a subset of `values` ("only PoE, nothing
  //         else"), which `any` cannot express.
  | { op: "in"; attr: string; values: PredicateScalar[]; mode: MatchMode }
  | { op: "not_in"; attr: string; values: PredicateScalar[] }
  // Numeric comparison. On an ORDERED select these compare the option's `rank`,
  // so "PoE input at most 802.3at" works on a dropdown, not just on a number.
  | { op: "gt"; attr: string; value: number }
  | { op: "gte"; attr: string; value: number }
  | { op: "lt"; attr: string; value: number }
  | { op: "lte"; attr: string; value: number }
  | { op: "between"; attr: string; min: number; max: number }
  // Has any value at all — the "is this filled in" test.
  | { op: "exists"; attr: string }
  // Composition. `all` = AND, `any` = OR.
  | { op: "all"; children: Predicate[] }
  | { op: "any"; children: Predicate[] }
  | { op: "not"; child: Predicate };

// Narrowing helper for the operators that name a single attribute — used by the
// evaluator, the cycle checker, and the "what does this reference" scan.
export type AttributePredicate = Extract<Predicate, { attr: string }>;

export const isAttributePredicate = (
  predicate: Predicate,
): predicate is AttributePredicate => "attr" in predicate;

/** Every attribute uuid a predicate tree references, deduplicated. */
export const predicateAttributes = (
  predicate: Predicate | null,
): string[] => {
  if (!predicate) {
    return [];
  }
  const found = new Set<string>();
  const walk = (node: Predicate): void => {
    if (isAttributePredicate(node)) {
      found.add(node.attr);
      return;
    }
    if (node.op === "not") {
      walk(node.child);
      return;
    }
    node.children.forEach(walk);
  };
  walk(predicate);
  return [...found];
};

/** The operator set, for the admin editor and validation. */
export type PredicateOp = PredicateOperator;

// ---------------------------------------------------------------------------
// Product values
// ---------------------------------------------------------------------------

// What a product stores for one attribute, keyed by Specifications.uuid.
//
// TYPED, not stringly. A number is a number so the engine can sum it without a
// parse that can silently produce NaN; a multi-select is an array so an option
// containing a comma cannot corrupt the row the way a comma-joined string does.
export type ProductValue = number | boolean | string | string[];

export type ProductValues = Record<string, ProductValue>;

// ---------------------------------------------------------------------------
// Relationship operands
// ---------------------------------------------------------------------------

// What a relationship measures on each side.
//
// Not every rule compares two product attributes. "Expected concurrent calls ≤
// PBX capacity" measures a number the BUYER supplied against a product spec,
// and "cameras ≤ recorder channels" counts ITEMS on the consumer side rather
// than reading any attribute. Modelling all of these as one operand type keeps
// a single evaluator instead of a special case per family.
export type Operand =
  // A product attribute. `perUnit` values are multiplied by the line quantity.
  | { source: "spec"; specUuid: string }
  // A project input the buyer supplied (see ProjectVariables).
  | { source: "variable"; variableUuid: string }
  // The number of physical units in the selection that matched the side's
  // filter — Σ(quantity), not Σ(value). This is what makes Count a mode of the
  // same evaluator rather than its own code path.
  | { source: "item_count" }
  // A fixed number authored on the rule.
  | { source: "constant"; value: number };

export const operandSpecUuid = (operand: Operand | null): string | null =>
  operand && operand.source === "spec" ? operand.specUuid : null;

export const operandVariableUuid = (operand: Operand | null): string | null =>
  operand && operand.source === "variable" ? operand.variableUuid : null;

// ---------------------------------------------------------------------------
// Conditional family — the lookup table
// ---------------------------------------------------------------------------

// One row: when `when` holds for an item, that item's limit is `limit`.
//
// The canonical case is maximum cable run — Cat6 at 10G allows 55 m while Cat6a
// at 10G allows 100 m — so the same measured length passes or fails depending
// on other values of the very same item. There is no provider product on the
// other side; the table IS the capacity.
export type LookupRow = {
  when: Predicate;
  limit: number;
};

// `inputs` names the attribute uuids the table is keyed by, in column order, so
// the admin can render it as a grid and the evaluator can say which row matched.
// Rows are tried in author order, so a specific row may sit above a catch-all.
export type LookupTable = {
  inputs: string[];
  rows: LookupRow[];
};

// ---------------------------------------------------------------------------
// Presence family — requires-companion
// ---------------------------------------------------------------------------

// Structurally different from every other family: the others compare items that
// ARE in the selection, while Presence detects a companion that SHOULD be there
// and ISN'T. So it loops over rules and scans for existence, rather than pairing
// items up.
//
// It identifies "a camera" the same way every other family identifies anything —
// by attribute values, through the `device_role` library attribute. Matching on
// category NAMES would break the first time a category is renamed or translated.
export type PresenceAlternative =
  // Some item in the selection satisfies this predicate.
  | { type: "item_exists"; predicate: Predicate }
  // The buyer answered a project question that makes the companion unnecessary
  // (e.g. recording is in the cloud, so no on-site recorder is required).
  | { type: "variable_true"; variableUuid: string };

export type PresenceRequirement = {
  description: string;
  // ANY one alternative satisfies the requirement.
  satisfiedBy: PresenceAlternative[];
  // Quantity pairing: the companion's total quantity must be at least the
  // trigger's total quantity times this factor. 0 = presence only, no counting.
  // This is what lets "every door needs a reader" be checked without modelling
  // per-door grouping — N triggers demand N companions, in total.
  perTriggerQuantity: number;
};

export type PresenceSpec = {
  // Any item matching this makes the rule active.
  trigger: Predicate;
  // ALL requirements must pass.
  requires: PresenceRequirement[];
  suggestedFix: string | null;
};

// ---------------------------------------------------------------------------
// Relationship scope
// ---------------------------------------------------------------------------

// Rules bind globally by default: any product carrying the consumer attribute
// participates, so a new SKU joins existing rules with no configuration. That is
// the property that makes the catalog scale, and it is worth protecting.
//
// The one restriction that genuinely is NOT a product attribute is the market a
// rule applies to (a certification mandated in one country only). An ecosystem
// lock is NOT scope — "this radio only pairs with its own hub" is an attribute
// both sides carry, and modelling it that way keeps rules brand-agnostic.
export type RelationshipScope = {
  regions: string[];
};

// ---------------------------------------------------------------------------
// Findings — what the engine hands the buyer
// ---------------------------------------------------------------------------

// The three shapes every correction takes. Any fix we can offer is one of
// these, so the UI can render an icon and an action per shape.
export type CorrectionShape = "add_supply" | "reduce_demand" | "swap";

export type FindingCorrection = {
  shape: CorrectionShape;
  message: string;
  // Catalog products that would satisfy the failure on their own, smallest
  // sufficient capacity first. Only meaningful for capacity comparisons.
  products: { productUuid: string; name: string; capacity: number }[];
};

// A relationship as the read model / AI layer sees it. Keyed by id, never prose.
export type RelationshipExport = {
  id: string;
  name: string;
  family: RelationshipFamily;
  gate: "block" | "warn";
  attributes: string[];
  variables: string[];
};
