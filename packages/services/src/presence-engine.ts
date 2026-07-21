// The Presence engine — requires-companion validation. Structurally different
// from Budget/Count/Match: those compare items that are IN the BOQ; Presence
// detects a companion that SHOULD be present but ISN'T. So the loop is over
// RULES, and each requirement is an EXISTENCE scan across the whole BOQ, not a
// pairwise comparison. Pure and I/O-free — the DB loader lives in
// presence-rules.ts, so this whole module is unit-testable with plain fixtures.

// An attribute value on a projected BOQ item. Arrays back multi-select specs
// (e.g. power_method = ["poe","dc"]); scalars back single values and flags.
export type PresenceAttrValue = string | number | boolean | string[];

// The predicate DSL — data, not code, so rules stay editable without a deploy.
// Reusable by the Match family later.
export type PresencePredicate =
  | { op: "equals" | "not_equals"; attr: string; value: string | number | boolean }
  | { op: "in" | "not_in"; attr: string; value: (string | number)[] }
  | { op: "gte" | "lte"; attr: string; value: number }
  | { op: "includes"; attr: string; value: string }
  | { op: "only"; attr: string; value: string[] }
  | { op: "exists"; attr: string }
  | { op: "all" | "any"; value: PresencePredicate[] }
  | { op: "not"; value: PresencePredicate };

export type PresenceAlternative =
  | { type: "item_exists"; predicate: PresencePredicate }
  | { type: "boq_flag"; flag: string };

export type PresenceRequirementGroup = {
  description: string;
  // ANY one alternative satisfies the group.
  satisfiedBy: PresenceAlternative[];
};

export type PresenceSeverity = "hard" | "soft";

export type PresenceRule = {
  id: string; // P1…P18
  name: string;
  severity: PresenceSeverity;
  trigger: PresencePredicate; // any item (or project choices) matches -> active
  requires: PresenceRequirementGroup[]; // ALL groups must pass
  message: string;
  suggestedFix?: string;
};

export type PresenceItem = {
  productUuid?: string;
  name: string;
  quantity: number;
  attributes: Record<string, PresenceAttrValue>;
};

export type PresenceBoq = {
  items: PresenceItem[];
  // Project-level boolean choices (the escape hatches), e.g. cloud_recording.
  choices: Record<string, boolean>;
};

export type PresenceFinding = {
  ruleId: string;
  name: string;
  severity: PresenceSeverity;
  groupDescription: string;
  message: string;
  suggestedFix?: string;
  triggeredCount: number;
};

export type PresenceGateDecision = {
  blocked: boolean;
  hard: PresenceFinding[];
  soft: PresenceFinding[];
};

// Coerce any attribute value to a string list for set/array operators.
const toList = (value: PresenceAttrValue | undefined): string[] => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).map((entry) => String(entry));
};

const scalarEquals = (
  value: PresenceAttrValue | undefined,
  target: string | number | boolean,
): boolean => {
  if (typeof target === "boolean") {
    return Boolean(value) === target;
  }
  return String(value ?? "") === String(target);
};

const attrExists = (value: PresenceAttrValue | undefined): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== null && value !== "";
};

// Evaluate one predicate against a flat attribute map.
export const matchPredicate = (
  attributes: Record<string, PresenceAttrValue>,
  predicate: PresencePredicate,
): boolean => {
  switch (predicate.op) {
    case "equals":
      return scalarEquals(attributes[predicate.attr], predicate.value);
    case "not_equals":
      return !scalarEquals(attributes[predicate.attr], predicate.value);
    case "in":
      return predicate.value
        .map(String)
        .includes(String(attributes[predicate.attr] ?? ""));
    case "not_in":
      return !predicate.value
        .map(String)
        .includes(String(attributes[predicate.attr] ?? ""));
    case "gte": {
      const raw = attributes[predicate.attr];
      return raw !== undefined && Number(raw) >= predicate.value;
    }
    case "lte": {
      const raw = attributes[predicate.attr];
      return raw !== undefined && Number(raw) <= predicate.value;
    }
    case "includes":
      return toList(attributes[predicate.attr]).includes(String(predicate.value));
    case "only": {
      const have = toList(attributes[predicate.attr]);
      const want = predicate.value.map(String);
      return (
        have.length > 0 &&
        have.length === want.length &&
        have.every((entry) => want.includes(entry)) &&
        want.every((entry) => have.includes(entry))
      );
    }
    case "exists":
      return attrExists(attributes[predicate.attr]);
    case "all":
      return predicate.value.every((child) => matchPredicate(attributes, child));
    case "any":
      return predicate.value.some((child) => matchPredicate(attributes, child));
    case "not":
      return !matchPredicate(attributes, predicate.value);
  }
};

// Choices projected as a pseudo-item so a choice can activate a trigger
// (e.g. P7 triggers on uses_pstn_lines) without being a real product.
const choiceItem = (boq: PresenceBoq): Record<string, PresenceAttrValue> => {
  const attributes: Record<string, PresenceAttrValue> = {};
  for (const [flag, on] of Object.entries(boq.choices)) {
    attributes[flag] = on;
  }
  return attributes;
};

// How many items (real items + the project choices) activate a rule's trigger.
const triggerCount = (boq: PresenceBoq, rule: PresenceRule): number => {
  let count = 0;
  for (const item of boq.items) {
    if (matchPredicate(item.attributes, rule.trigger)) {
      count += 1;
    }
  }
  if (matchPredicate(choiceItem(boq), rule.trigger)) {
    count += 1;
  }
  return count;
};

// A requirement alternative is satisfied by a matching REAL item (never the
// choices pseudo-item) or by a set project flag.
const alternativeSatisfied = (
  boq: PresenceBoq,
  alternative: PresenceAlternative,
): boolean => {
  if (alternative.type === "boq_flag") {
    return Boolean(boq.choices[alternative.flag]);
  }
  return boq.items.some((item) =>
    matchPredicate(item.attributes, alternative.predicate),
  );
};

/**
 * Run the presence rules over a BOQ. For every rule whose trigger matches any
 * item (or a project choice), every requirement group must be satisfied by some
 * companion item or project flag — otherwise a finding is emitted, one per
 * unsatisfied group.
 */
export const evaluatePresence = (
  boq: PresenceBoq,
  rules: PresenceRule[],
): PresenceFinding[] => {
  const findings: PresenceFinding[] = [];
  for (const rule of rules) {
    const count = triggerCount(boq, rule);
    if (count === 0) {
      continue; // rule not relevant to this BOQ
    }
    for (const group of rule.requires) {
      const satisfied = group.satisfiedBy.some((alternative) =>
        alternativeSatisfied(boq, alternative),
      );
      if (!satisfied) {
        findings.push({
          ruleId: rule.id,
          name: rule.name,
          severity: rule.severity,
          groupDescription: group.description,
          message: rule.message,
          suggestedFix: rule.suggestedFix,
          triggeredCount: count,
        });
      }
    }
  }
  return findings;
};

/** The purchase gate: blocked when any HARD finding exists; soft ones warn. */
export const gateDecision = (
  findings: PresenceFinding[],
): PresenceGateDecision => {
  const hard = findings.filter((finding) => finding.severity === "hard");
  const soft = findings.filter((finding) => finding.severity === "soft");
  return { blocked: hard.length > 0, hard, soft };
};
