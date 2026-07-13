export type Highlight = {
  k: string;
  v: string;
};

export type SpecGroup = {
  title: string;
  rows: { k: string; v: string }[];
};

// A per-category spec-template field: a stable key, a display label, and the
// editable set of allowed dropdown values. Products fill these (dropdown-only)
// into their `technicalAttributes` map, keyed by `key`.
export type SpecField = {
  key: string;
  label: string;
  options: string[];
};
