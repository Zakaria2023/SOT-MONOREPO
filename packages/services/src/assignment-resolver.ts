import { parseSpecValues } from "utils";
import type { AssignmentAudience } from "../../../db/enum";
import type { SelectSpecificationCategories } from "../../../db/schema/specification-categories";
import type { SelectSpecifications } from "../../../db/schema/specifications";
import type { ShowIfCondition, SpecOption } from "../../../db/types";

// Pure resolution of category → attribute assignments. No database access, so
// the whole inherit-and-override model is testable in isolation.
//
// Two registries join here: the attribute LIBRARY holds each definition
// exactly once (label, value type, master option list, `ordered`), and the
// category TREE holds navigation. An assignment is a category borrowing a
// definition and setting four switches on that pointer:
//
//   1. isFilter — does the shopper see it and click it?
//   2. isRule   — does the compatibility engine read it?
//   3. scope    — how far the filter reaches (branch-wide vs leaf-only)
//   4. showIf   — is it conditional on another attribute's value?
//
// The definition never varies per category; only the switches do.

// The switches an assignment carries, without its identity columns.
export type AssignmentSwitches = Pick<
  SelectSpecificationCategories,
  | "isFilter"
  | "isRule"
  | "scope"
  | "showIf"
  | "audience"
  | "enabledValues"
  | "order"
>;

// One stored assignment row, as the resolver needs it.
export type AssignmentRow = AssignmentSwitches & {
  specificationUuid: SelectSpecificationCategories["specificationUuid"];
  categoryUuid: SelectSpecificationCategories["categoryUuid"];
};

// The slice of a library definition the resolver reads.
export type AssignmentDefinition = Pick<
  SelectSpecifications,
  | "uuid"
  | "key"
  | "label"
  | "valueType"
  | "inputType"
  | "unit"
  | "allowMultiple"
  | "allowRange"
  | "ordered"
  | "options"
  | "order"
>;

export type ResolvedAssignment = AssignmentSwitches & {
  definition: AssignmentDefinition;
  // Which category in the chain authored the winning row.
  sourceCategoryUuid: AssignmentRow["categoryUuid"];
  // True when the winning row came from an ancestor rather than the category
  // being resolved. Leaf-scoped filters are offered only when this is false.
  inherited: boolean;
  // The master option list narrowed to this category's enabled slice.
  offeredOptions: SpecOption[];
};

export type ResolveAssignmentsInput = {
  // The category being resolved, then each ancestor up to the root — nearest
  // first, which is the order getCategoryAndAncestors already returns. The
  // first row found for a specification wins, so a child overrides its parent.
  chain: string[];
  rows: AssignmentRow[];
  definitions: AssignmentDefinition[];
};

// Widest to narrowest. A viewer sees an assignment when their own rank is at
// least the assignment's.
const AUDIENCE_RANK: Record<AssignmentAudience, number> = {
  all: 0,
  partner: 1,
  staff: 2,
};

/** Position of a value in an attribute's master option list, or -1. */
export const optionIndex = (
  definition: AssignmentDefinition,
  value: string,
): number =>
  (definition.options ?? []).findIndex((option) => option.value === value);

/**
 * The options a category offers: the library's master list narrowed to the
 * assignment's enabled slice. Narrowing is not forking — the master list is
 * untouched and option values keep their identity, so a rule comparing across
 * two categories still lines up. A category simply never offers a value it
 * has disabled.
 *
 * On an ORDERED attribute the slice reads as a ceiling: enabling 48 on
 * Downlink Ports offers everything up to 48, because the list is a scale and
 * a gap in the middle of a scale isn't a thing a catalog can mean. On an
 * unordered attribute it's plain set membership.
 */
export const sliceOptions = (
  definition: AssignmentDefinition,
  enabledValues: string[] | null,
): SpecOption[] => {
  const master = definition.options ?? [];
  if (!enabledValues || enabledValues.length === 0) {
    return master;
  }
  const enabled = new Set(enabledValues);

  if (!definition.ordered) {
    return master.filter((option) => enabled.has(option.value));
  }

  let ceiling = -1;
  master.forEach((option, index) => {
    if (enabled.has(option.value)) {
      ceiling = index;
    }
  });
  // The slice only references options that have since been removed from the
  // master list — fall back to the full list rather than offering nothing.
  if (ceiling < 0) {
    return master;
  }
  return master.slice(0, ceiling + 1);
};

/**
 * Every attribute a category carries: its own assignments plus those inherited
 * from its ancestors, nearest ancestor winning. Ordered by the assignment's
 * own order, then the library's, then label.
 */
export const resolveAssignments = ({
  chain,
  rows,
  definitions,
}: ResolveAssignmentsInput): ResolvedAssignment[] => {
  // Distance from the category being resolved — 0 is the category itself.
  const distance = new Map(chain.map((uuid, index) => [uuid, index]));
  const definitionByUuid = new Map(
    definitions.map((definition) => [definition.uuid, definition]),
  );

  const winners = new Map<string, { row: AssignmentRow; distance: number }>();
  for (const row of rows) {
    const rowDistance = distance.get(row.categoryUuid);
    if (rowDistance === undefined) {
      continue;
    }
    const current = winners.get(row.specificationUuid);
    if (!current || rowDistance < current.distance) {
      winners.set(row.specificationUuid, { row, distance: rowDistance });
    }
  }

  const resolved: ResolvedAssignment[] = [];
  for (const { row, distance: rowDistance } of winners.values()) {
    const definition = definitionByUuid.get(row.specificationUuid);
    // An assignment pointing at a deleted definition has nothing to render.
    if (!definition) {
      continue;
    }
    resolved.push({
      isFilter: row.isFilter,
      isRule: row.isRule,
      scope: row.scope,
      showIf: row.showIf,
      audience: row.audience,
      enabledValues: row.enabledValues,
      order: row.order,
      definition,
      sourceCategoryUuid: row.categoryUuid,
      inherited: rowDistance > 0,
      offeredOptions: sliceOptions(definition, row.enabledValues),
    });
  }

  return resolved.sort(
    (a, b) =>
      a.order - b.order ||
      a.definition.order - b.definition.order ||
      a.definition.label.localeCompare(b.definition.label),
  );
};

/** Whether a viewer of the given audience level may see this assignment. */
export const isVisibleTo = (
  audience: AssignmentAudience,
  viewer: AssignmentAudience,
): boolean => AUDIENCE_RANK[audience] <= AUDIENCE_RANK[viewer];

/**
 * The assignments offered as storefront facets on a category page.
 *
 * Scope decides reach: an assignment authored on this very category always
 * shows, but one inherited from an ancestor only shows if it's branch-wide.
 * Port Speed sits at Networking as branch-wide and filters switches, APs and
 * routers together; Detection Range sits on the motion-detector leaf and never
 * escapes it.
 */
export const facetAssignments = (
  resolved: ResolvedAssignment[],
  viewer: AssignmentAudience,
): ResolvedAssignment[] =>
  resolved.filter(
    (assignment) =>
      assignment.isFilter &&
      isVisibleTo(assignment.audience, viewer) &&
      (!assignment.inherited || assignment.scope === "branch") &&
      assignment.offeredOptions.length > 0,
  );

/** The assignments the compatibility engine may read. Audience never gates this. */
export const ruleAssignments = (
  resolved: ResolvedAssignment[],
): ResolvedAssignment[] =>
  resolved.filter((assignment) => assignment.isRule);

/** Whether a show-if condition holds against a product's chosen values. */
export const isShowIfSatisfied = (
  condition: ShowIfCondition | null,
  values: Record<string, string>,
): boolean => {
  if (!condition) {
    return true;
  }
  // Multi-select values are stored comma-joined; the condition holds if any
  // chosen value is listed.
  const chosen = parseSpecValues(values[condition.specKey]);
  return chosen.some((value) => condition.values.includes(value));
};

/**
 * The assignments actually shown for a set of chosen values, cascading: if PoE
 * = No hides PoE Type, anything shown only when PoE Type has a value hides too.
 * Runs to a fixed point, bounded by the number of assignments so a circular
 * show-if can't spin.
 */
export const visibleAssignments = (
  resolved: ResolvedAssignment[],
  values: Record<string, string>,
): ResolvedAssignment[] => {
  let visible = resolved;
  for (let pass = 0; pass <= resolved.length; pass += 1) {
    const present = new Set(
      visible.map((assignment) => assignment.definition.key),
    );
    const next = visible.filter(
      (assignment) =>
        isShowIfSatisfied(assignment.showIf, values) &&
        (!assignment.showIf || present.has(assignment.showIf.specKey)),
    );
    if (next.length === visible.length) {
      return next;
    }
    visible = next;
  }
  return visible;
};

/**
 * Drop the stored values of attributes the show-if conditions now hide. This
 * is the half that's easy to miss: hiding PoE Budget without clearing it
 * leaves the engine sizing a switch off a number that no longer applies.
 *
 * Values whose key this category doesn't assign at all are left untouched —
 * they belong to another category's template or an older product, and this
 * resolver knows nothing about them.
 */
export const clearHiddenValues = (
  resolved: ResolvedAssignment[],
  values: Record<string, string>,
): Record<string, string> => {
  const assigned = new Set(
    resolved.map((assignment) => assignment.definition.key),
  );
  const visible = new Set(
    visibleAssignments(resolved, values).map(
      (assignment) => assignment.definition.key,
    ),
  );

  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!assigned.has(key) || visible.has(key)) {
      next[key] = value;
    }
  }
  return next;
};
