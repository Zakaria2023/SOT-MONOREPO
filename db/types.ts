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
};

// Optional consumer-side filter on a compatibility rule: only selection items
// whose chosen value for `specKey` is one of `values` participate as
// consumers. e.g. only devices with PoE = "Yes" count toward a PoE budget.
export type RuleCondition = {
  specKey: string;
  values: string[];
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
