// A per-category spec-template field: a stable key, a display label, and the
// editable set of allowed dropdown values. Products fill these (dropdown-only)
// into their `technicalAttributes` map, keyed by `key`.
//
// The template is a tree: each option can carry its own child fields that only
// apply when that option is chosen. e.g. a "PoE" field with options Yes/No,
// where the "Yes" option reveals a "PoE Standard" child field on the product.
export type SpecOption = {
  value: string;
  children: SpecField[];
};

export type SpecField = {
  key: string;
  label: string;
  options: SpecOption[];
};
