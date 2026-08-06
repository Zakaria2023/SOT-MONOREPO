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
// A shared OPTION SET is the one thing a library entry may point at, and it does
// not bend the rule: a set holds words, not behaviour. Two attributes naming the
// same set agree on how to spell "1G" and on nothing else — no type, no unit, no
// condition, no rule crosses between them. That is what makes their stored values
// comparable without either one knowing the other exists.
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

  // OTHER SPELLINGS OF THIS SAME OPTION, as the sources write them.
  //
  // Not display text and not a second label — an alias is never shown. It exists
  // so an importer reading a vendor sheet can land on the option that already
  // exists instead of creating a second one beside it. `||` is how one vendor
  // renders the roman numeral II; `Workbench` is what another calls a desktop
  // mount. Both are the SAME value, and without somewhere to record that, the
  // next import forks the list again and half the catalogue quietly stops
  // matching every rule keyed on the other half.
  //
  // It belongs HERE rather than in the importer for the reason the boundary rule
  // is worth having at all: a set is a dictionary, and alternative spellings are
  // exactly what a dictionary holds. Kept only in an importer, this is
  // documentation somebody has to remember to read; kept here it is a contract
  // the resolver enforces on every route into the catalogue.
  //
  // NOT behaviour, so it does not bend the boundary rule: an alias has no type,
  // no unit, no rank, and names no other attribute. It resolves to the option it
  // sits on and nothing else.
  //
  // A RETIRED option keeps its aliases. It still owns its value and products
  // still hold it, so letting a live option claim a retired one's spelling would
  // silently re-point every one of those products.
  //
  // Optional so every option stored before this existed still parses — absent and
  // `[]` both mean "this option answers only to its own name".
  aliases?: string[];
};

// ---------------------------------------------------------------------------
// Group schema — the sub-fields of a repeatable row
// ---------------------------------------------------------------------------

// One column of a `group` attribute. Authored in the library beside the
// attribute, because the shape of a port group is a property of "Network Ports"
// itself and not of any category that asks for it.
//
// Two kinds, and no more. Every repeatable fact in the catalogue is counts and
// picks — {count, family, max speed} for ports, {count, outlet type} for
// outlets, {name, mode, used, total, expandable for} for slot systems. Adding
// nested groups or ranges here would make the row a document, and a document is
// something no comparator can read.
//
// A sub-field's picks come from ONE of two places, never both:
//
//   - `options` inline, when the list means something only inside this group;
//   - `optionSetUuid`, a SHARED vocabulary (see SpecificationOptionSets).
//
// The shared case is what makes "does this cage take that module" answerable. An
// inline speed list inside this group and an inline speed list on a standalone
// transceiver attribute are separate vocabularies: both spell "1G", and their
// stored values are unrelated, so no comparator can line them up. Pointing both
// at one set makes the two spellings the same fact.
//
// A set is still not another attribute, so the boundary rule at the top of this
// file holds exactly as written — the sub-field names a dictionary, and nothing
// about the transceiver attribute reaches this group.
export type SpecGroupField = {
  // Stable identity. A row keys on this, so it is fixed at creation and a label
  // rename never touches it — the same reason SpecOption carries `value`.
  key: string;
  label: string;
  // `number` for a quantity, `select` for a pick from `options`.
  kind: "number" | "select";
  // `number` only. Same dimension discipline as Specifications.unit.
  unit: string | null;
  // `select` only. Whether the picks are a scale, so a comparator can read rank —
  // 1G < 10G < 25G is what makes "does this cage take that module" answerable.
  //
  // IGNORED when `optionSetUuid` is set, for the same reason it is on the
  // attribute: the set owns that fact about its own words.
  ordered: boolean;
  // `select` only, and EMPTY when `optionSetUuid` is set. The resolved list is
  // written back into this field on the way out (see resolveGroupFields), so
  // every reader below the library sees one shape and never has to know where the
  // options came from.
  options: SpecOption[];
  // `select` only. When set, the picks are the named set's, not `options`.
  //
  // Optional so every row stored before sets existed still parses — an absent
  // pointer and a null one both mean "this list is my own".
  optionSetUuid?: string | null;
  // Which of the borrowed set's words this column uses. Absent/empty = all of
  // them. Same narrowing the attribute itself can do, and for the same reason:
  // a port group's Speed column has no business offering 100G on a switch whose
  // fastest cage is 10G. See Specifications.setValues.
  setValues?: string[] | null;
};

// One authored row of a `group` attribute: sub-field key → value.
//
// Numbers stay numbers and picks stay option `value`s, for the same reason
// ProductValue is typed rather than stringly — a parse that can silently produce
// NaN has no place between an author and a budget check.
export type SpecGroupRow = Record<string, number | string>;

/**
 * Whether a value is a well-formed list of group rows.
 *
 * Needed because `string[]` (a multi-select) and `SpecGroupRow[]` (a group) are
 * both arrays, and the readers have to tell them apart before coercing. The two
 * are disjoint by element type, so the check is total rather than a heuristic.
 *
 * An EMPTY list is not a value — a group with no rows is an unanswered
 * attribute, and reading it as answered would let a switch with no ports
 * declared pass a port check.
 */
export const isSpecGroupRows = (value: unknown): value is SpecGroupRow[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (row) =>
      typeof row === "object" &&
      row !== null &&
      !Array.isArray(row) &&
      Object.values(row).every(
        (entry) =>
          typeof entry === "string" ||
          (typeof entry === "number" && Number.isFinite(entry)),
      ),
  );

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

// One column of a `group` attribute, when a condition is about the rows rather
// than the attribute as a whole — "has any SFP cage" is a question about the
// family column of Network Ports, not about Network Ports.
//
// Optional on every attribute operator, so nothing authored before this existed
// changes meaning. Absent means the attribute itself, exactly as before.
//
// WHAT IT MEANS, because each reading has a wrong twin that would fail silently.
// None of these is invented here; each matches a rule the model already follows:
//
//   Set operators (equals / in / not_in) read the DISTINCT PICKS across rows, so
//   they are existential: "any row's family is SFP". This is the same reading a
//   multi-select already gets, where the ticked set is compared as a whole.
//
//   Numeric operators on a PICK column read the HIGHEST rank across rows — the
//   fastest cage, not the slowest. Identical to what `asNumber` already does for
//   a multi-select ("a device that accepts af/at/bt supplies bt").
//
//   Numeric operators on a COUNT column read the TOTAL across rows, the same
//   figure an operand totals. "at least 24 ports" means 24 in total, not 24 in
//   some single row.
//
//   `exists` means at least one row is READABLE — complete against the current
//   schema. A group whose rows all became unreadable must not answer yes.
//
// `where` narrows WHICH ROWS the reduction above runs over, and it is what lets a
// condition ask "how many 10G ports" rather than only "how many ports" or "is any
// port 10G". Its `attr`s name this group's own SUB-FIELD KEYS — never library
// attribute uuids — because a row is a world of its own with no access to the
// product around it. That is also why `predicateAttributes` must not descend into
// it: a sub-field key is not an attribute the reveal graph can chase.
//
// Ticking two columns without it is not the same question. "family is SFP" and
// "speed is 10G" as two conditions ask whether SOME row is SFP and SOME row is
// 10G, which a switch with an SFP 1G cage and an RJ45 10G port answers yes to.
// `where` is what makes it one row that is both.
export type PredicateField = { field?: string; where?: Predicate };

export type Predicate =
  // Scalar comparison. On a multi-select attribute, `equals` holds when the
  // ticked set is exactly [value].
  | ({ op: "equals"; attr: string; value: PredicateScalar } & PredicateField)
  | ({
      op: "not_equals";
      attr: string;
      value: PredicateScalar;
    } & PredicateField)
  // Set membership. `mode` decides what "matches" means when the attribute
  // being tested is multi-select and holds several values at once:
  //   any → the item's values overlap `values` (the common case)
  //   all → the item's values are a subset of `values` ("only PoE, nothing
  //         else"), which `any` cannot express.
  | ({
      op: "in";
      attr: string;
      values: PredicateScalar[];
      mode: MatchMode;
    } & PredicateField)
  | ({ op: "not_in"; attr: string; values: PredicateScalar[] } & PredicateField)
  // Numeric comparison. On an ORDERED select these compare the option's `rank`,
  // so "PoE input at most 802.3at" works on a dropdown, not just on a number.
  | ({ op: "gt"; attr: string; value: number } & PredicateField)
  | ({ op: "gte"; attr: string; value: number } & PredicateField)
  | ({ op: "lt"; attr: string; value: number } & PredicateField)
  | ({ op: "lte"; attr: string; value: number } & PredicateField)
  | ({ op: "between"; attr: string; min: number; max: number } & PredicateField)
  // Has any value at all — the "is this filled in" test.
  | ({ op: "exists"; attr: string } & PredicateField)
  // A PRODUCT GROUP: is this item in that category, or anywhere beneath it?
  //
  // The one operator that does not name an attribute. It exists because some
  // rules are about what a thing IS rather than what it measures — "the basket
  // contains a camera" — and forcing that through an attribute means every
  // category must first be given a Device Role and every product filled in
  // before a single rule can be written.
  //
  // Matched by UUID and never by name, so renaming or translating a category
  // cannot silently change which products a rule covers. Matching the SUBTREE
  // and not just the exact category is the same inheritance the rest of the
  // model runs on: a rule about Networking covers a switch filed under SOHO.
  | { op: "in_category"; categoryUuid: string }
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
export const predicateAttributes = (predicate: Predicate | null): string[] => {
  if (!predicate) {
    return [];
  }
  const found = new Set<string>();
  const walk = (node: Predicate): void => {
    if (isAttributePredicate(node)) {
      found.add(node.attr);
      return;
    }
    // A product group names no attribute, so there is nothing to collect — and
    // nothing for the reveal-cycle checker to chase either.
    if (node.op === "in_category") {
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

/**
 * Every category uuid a predicate tree names, deduplicated.
 *
 * The mirror of `predicateAttributes`. A rule pointing at a deleted category
 * matches nothing and silently stops applying, which looks exactly like a rule
 * that was never violated — so whoever holds the tree has to be able to ask.
 */
export const predicateCategories = (predicate: Predicate | null): string[] => {
  if (!predicate) {
    return [];
  }
  const found = new Set<string>();
  const walk = (node: Predicate): void => {
    if (node.op === "in_category") {
      found.add(node.categoryUuid);
      return;
    }
    if (isAttributePredicate(node)) {
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

// A number attribute answered as a SPAN rather than a point: an operating
// temperature of −20 to 60 °C, a PoE draw that varies 4–12 W with the heater on.
//
// Stored as two numbers, not as the string "4 - 12", because the engine has to
// do arithmetic on both ends. Which end it reads is the whole point of the
// shape: a range CONSUMES at its max (the worst case has to fit) and SUPPLIES at
// its min (only the guaranteed capacity may be promised). Flattening a range to
// one number anywhere would quietly pick a side.
export type SpecRange = { min: number; max: number };

export const isSpecRange = (value: unknown): value is SpecRange =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as SpecRange).min === "number" &&
  typeof (value as SpecRange).max === "number" &&
  Number.isFinite((value as SpecRange).min) &&
  Number.isFinite((value as SpecRange).max);

// What a product stores for one attribute, keyed by Specifications.uuid.
//
// TYPED, not stringly. A number is a number so the engine can sum it without a
// parse that can silently produce NaN; a multi-select is an array so an option
// containing a comma cannot corrupt the row the way a comma-joined string does.
//
// `SpecGroupRow[]` overlaps `string[]` in shape only — the element types are
// disjoint, and `isSpecGroupRows` is how every reader tells them apart before
// coercing. No reader may branch on `Array.isArray` alone.
export type ProductValue =
  number | boolean | string | string[] | SpecRange | SpecGroupRow[];

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
  //
  // `groupField` names one numeric sub-field of a `group` attribute, and the
  // operand then reads the SUM of that column across the rows — "how many ports
  // does this switch have" is Σ(count) over its port groups, not the number of
  // groups. Without it a group has no single magnitude and the operand reads
  // nothing at all, which is why every rule about ports needs it.
  //
  // An optional field on the existing `spec` source rather than a source of its
  // own, deliberately: `operandSpecUuid` keeps working, so the deletion guard
  // still sees the reference, and every `source === "spec"` branch in the engine
  // and the authoring layer stays correct without being touched.
  //
  // `where` narrows which ROWS are totalled, so "how many 10G uplinks" is finally
  // expressible: Σ(count) over the rows whose speed column says 10G. Its `attr`s
  // name this group's sub-field keys, never library attributes.
  //
  // The distinction that makes it safe: a product with NO readable rows still
  // measures nothing (null, and the rule skips it, as before), but a product with
  // readable rows and none matching measures ZERO. Those must not collapse — a
  // switch whose ports are all 1G has to FAIL a "needs two 10G uplinks" rule, and
  // returning null there would make it skip the check instead, which is the exact
  // silent pass this model exists to prevent.
  | {
      source: "spec";
      specUuid: string;
      groupField?: string;
      where?: Predicate;
    }
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

// What the buyer answered, keyed by ProjectVariables.uuid. Keyed by uuid rather
// than by the variable's `key` for the same reason product values are: a label or
// a slug can be renamed, and a stored answer must not stop matching its question.
//
// Stored on a BOQ so the answers survive the handover. Without that the buyer
// answers "recording is in the cloud" in the cart, the pre-seller re-runs the
// check an hour later, and the requirement the answer excused comes back as a
// blocker on a design that was fine.
export type ProjectAnswers = Record<string, number | boolean>;

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
