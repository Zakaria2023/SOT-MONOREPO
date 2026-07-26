import type { RuleComparator, RuleKind } from "../../../db/enum";
import type { LookupTable } from "../../../db/types";

// ---------------------------------------------------------------------------
// Shape checks for a relation, before it is ever stored.
//
// The engine fails SILENTLY on a mis-shaped rule: a Budget rule pointed at a
// dropdown attribute finds no numeric value, so nobody participates and it
// reports not_applicable forever. It looks like a rule that simply never
// fires, which is the worst kind of wrong — no error, no gate, no clue. These
// checks turn that into a refusal at authoring time.
//
// Pure: plain descriptions in, problems out, so both the service and the form
// can run it and neither can drift from the other.
// ---------------------------------------------------------------------------

// The two things a family can compare.
export type OperandType = "number" | "select";

// One side of a proposed relation, as much as the checker needs.
export type OperandShape = {
  label: string;
  valueType: OperandType;
  unit: string | null;
  // Whether the option list is an ordered scale. Only meaningful on a select.
  ordered?: boolean;
};

export type RuleShape = {
  kind: RuleKind;
  comparator: RuleComparator;
  // Absent when the side is not filled in yet.
  consumer?: OperandShape;
  provider?: OperandShape;
  lookup?: LookupTable | null;
};

/**
 * What each family compares. Match reads chosen dropdown values; every other
 * family does arithmetic and needs numbers on both sides — including Count,
 * whose consumer still has to carry a readable value to be counted at all.
 */
export const familyOperandType = (kind: RuleKind): OperandType =>
  kind === "spec_match" ? "select" : "number";

/** Families that compare against another product rather than a lookup table. */
export const familyNeedsProvider = (kind: RuleKind): boolean =>
  kind !== "conditional";

/**
 * Units must agree wherever two values are compared directly. Count is exempt
 * — it weighs a quantity against a count-like capacity, so devices against
 * ports is correct. Match compares dropdown values, which carry no unit, and
 * Conditional compares an item against a limit already in its own unit.
 */
const comparesUnitsDirectly = (kind: RuleKind): boolean =>
  kind !== "count_limit" && kind !== "spec_match" && kind !== "conditional";

/**
 * Everything wrong with a proposed relation, phrased for whoever is authoring
 * it. Empty means it will behave as intended.
 */
export const validateRuleShape = (shape: RuleShape): string[] => {
  const problems: string[] = [];
  const wanted = familyOperandType(shape.kind);
  const needsProvider = familyNeedsProvider(shape.kind);

  const describe = (operand: OperandShape) =>
    `"${operand.label}" is a ${operand.valueType === "number" ? "number" : "dropdown"} attribute`;

  const reason =
    wanted === "number"
      ? "this family adds up and compares values, so both sides must be numbers"
      : "Match compares chosen dropdown values, so both sides must be dropdowns";

  if (shape.consumer && shape.consumer.valueType !== wanted) {
    problems.push(
      `${describe(shape.consumer)}, but ${reason}. Nothing would ever match, so the rule would never fire.`,
    );
  }

  if (needsProvider) {
    if (!shape.provider) {
      problems.push("Pick what this is measured against.");
    } else if (shape.provider.valueType !== wanted) {
      problems.push(
        `${describe(shape.provider)}, but ${reason}. Nothing would ever match, so the rule would never fire.`,
      );
    }
  } else if (shape.provider) {
    problems.push(
      "A Conditional relation reads its limit from its own table — leave the other side empty.",
    );
  }

  // Units, once both sides are known to be the right kind.
  if (
    comparesUnitsDirectly(shape.kind) &&
    shape.consumer?.valueType === "number" &&
    shape.provider?.valueType === "number" &&
    shape.consumer.unit !== shape.provider.unit
  ) {
    problems.push(
      `Both sides must use the same unit — got "${shape.consumer.unit ?? "no unit"}" against "${shape.provider.unit ?? "no unit"}". Only a Count relation may mix them.`,
    );
  }

  // A scale comparison needs a scale to rank on.
  if (
    shape.kind === "spec_match" &&
    (shape.comparator === "lte" || shape.comparator === "gte") &&
    shape.consumer &&
    shape.provider &&
    !shape.consumer.ordered &&
    !shape.provider.ordered
  ) {
    problems.push(
      'Neither attribute is an ordered scale, so "at most" has no meaning — mark one ordered in the library, or use "must be one of".',
    );
  }

  if (shape.kind === "conditional") {
    if (!shape.lookup || shape.lookup.rows.length === 0) {
      problems.push(
        "A Conditional relation needs at least one lookup row — that table is where its limit comes from.",
      );
    } else if (shape.lookup.inputs.length === 0) {
      problems.push(
        "Pick at least one attribute to key the lookup table by, or every row matches everything.",
      );
    } else if (
      shape.lookup.rows.some((row) => Object.keys(row.when).length === 0)
    ) {
      problems.push(
        "Every lookup row must say which attribute values it applies to.",
      );
    }
  } else if (shape.lookup) {
    problems.push(
      "A lookup table only applies to a Conditional relation — clear it or change the family.",
    );
  }

  return problems;
};
