import { SpecValueType } from "./enum";

// A per-category spec-template field: a stable key, a display label, and the
// editable set of allowed dropdown values. Products fill these into their
// `technicalAttributes` map, keyed by `key`.
//
// The template is a tree: each option can carry its own child fields that only
// apply when that option is chosen. e.g. a "PoE" field with options Yes/No,
// where the "Yes" option reveals a "PoE Standard" child field on the product.
//
// `valueType` "number" marks a numeric spec (typed value + unit instead of
// dropdown options) — the inputs the compatibility rule engine computes over.
// Absent on old rows = "select".
export type SpecOption = {
  value: string;
  children: SpecField[];
};

export type SpecField = {
  key: string;
  label: string;
  options: SpecOption[];
  valueType?: SpecValueType;
  unit?: string | null;
  // "select" spec that accepts several ticked options (stored comma-joined).
  allowMultiple?: boolean;
  // "number" spec whose value is a from–to range (stored as "from - to").
  allowRange?: boolean;
};

// Conditional reveal carried on an assignment: this attribute is only shown
// (on the storefront facet and the admin product form) while another attribute
// on the same category holds one of `values`. e.g. PoE Type and PoE Budget are
// show-if PoE = Yes.
//
// The non-obvious half is the clearing: when the condition stops matching, the
// hidden attribute's stored value must be dropped, not just hidden. A leftover
// PoE budget on a product whose PoE is now "No" would let the engine size a
// switch off a number that no longer applies.
export type ShowIfCondition = {
  // Key of the OTHER attribute this condition watches.
  specKey: string;
  // The condition holds when that attribute's value is one of these. For a
  // multi-select the condition holds if ANY chosen value is in this list.
  values: string[];
};

// Optional consumer-side filter on a compatibility rule: only selection items
// whose chosen value for `specKey` is one of `values` participate as
// consumers. e.g. only devices with PoE = "Yes" count toward a PoE budget.
export type RuleCondition = {
  specKey: string;
  values: string[];
};

// One row of a conditional rule's lookup table: when an item's own spec values
// all match `when`, its limit is `limit`. e.g. { when: { "cable-grade":
// "Cat6", "link-speed": "10G" }, limit: 55 } — Cat6 at 10G runs 55 m.
export type LookupRow = {
  // Spec key → the value this row applies to. Every entry must match the item.
  when: Record<string, string>;
  // The limit the measured spec is compared against, in that spec's unit.
  limit: number;
};

// The lookup a conditional rule resolves its limit from. `inputs` names the
// spec keys the table is keyed by, in column order, so the admin editor can
// render it as a grid and the evaluator can explain which row it matched.
export type LookupTable = {
  inputs: string[];
  rows: LookupRow[];
};

// A rule stored on a specification. When the clauses match the product's
// chosen spec values, this specification's value is forced to `forcedValue`
// and locked in the admin product form. e.g. on "Uplink": if Power is 40W
// AND PoE is PoE++, force Uplink = 40G.
export type SpecRuleClause = {
  // Key of the OTHER specification this clause inspects.
  specKey: string;
  // The clause matches when the chosen value is one of these.
  values: string[];
};

export type SpecRule = {
  // "all" = every clause must match (AND); "any" = at least one (OR).
  match: "all" | "any";
  clauses: SpecRuleClause[];
  // Key of the field being forced — the host specification itself or any
  // sub-field in its option tree. Absent on old rows = the host spec.
  forcedKey?: string;
  // One of the forced field's own option values. Forcing a nested sub-field
  // also forces the parent options on the path leading to it.
  forcedValue: string;
};
