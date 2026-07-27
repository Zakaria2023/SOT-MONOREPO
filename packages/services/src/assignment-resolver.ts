import type { AssignmentAudience, AssignmentScope } from "../../../db/enum";
import {
  predicateAttributes,
  type Predicate,
  type ProductValues,
  type SpecOption,
} from "../../../db/types";
import { evaluatePredicate } from "./predicate";
import {
  hasValue,
  indexAttributes,
  optionRank,
  readValue,
  type AttributeIndex,
  type AttributeMeta,
} from "./spec-values";

// ---------------------------------------------------------------------------
// Resolving a category into the attributes it carries. Pure — no database, so
// the whole inherit-and-override model is testable with plain fixtures.
//
// Two registries join here. The LIBRARY holds each definition exactly once. The
// TREE holds navigation. An ASSIGNMENT is a category borrowing a definition and
// setting seven switches on that pointer:
//
//   1. isFilter      — does the shopper see it and click it?
//   2. isRule        — does the compatibility engine read it?
//   3. scope         — how far the FILTER reaches (branch-wide vs leaf-only)
//   4. showIf        — is it revealed conditionally?
//   5. audience      — who is it surfaced to?
//   6. enabledValues — which slice of the master list does this category offer?
//   7. suppressed    — is an inherited attribute removed here entirely?
//
// The definition never varies per category; only the switches do.
// ---------------------------------------------------------------------------

// The definition, as the resolver needs it. Extends the engine's AttributeMeta
// with the display and authoring fields the engine must never read.
export type AssignmentDefinition = AttributeMeta & {
  key: string;
  internalName: string | null;
  description: string | null;
  audience: AssignmentAudience;
  order: number;
  // Library group — filing only, carried so a product page can section its spec
  // table the way the library is organised. Never read by the engine.
  groupUuid: string | null;
};

export type AssignmentSwitches = {
  isFilter: boolean;
  isRule: boolean;
  scope: AssignmentScope;
  showIf: Predicate | null;
  audience: AssignmentAudience;
  enabledValues: string[] | null;
  suppressed: boolean;
  order: number;
};

export type AssignmentRow = AssignmentSwitches & {
  specificationUuid: string;
  categoryUuid: string;
};

export type ResolvedAssignment = AssignmentSwitches & {
  definition: AssignmentDefinition;
  // Who actually sees it. The library decides who an attribute is FOR; a
  // category may pick a side only when the library left the choice open. A
  // staff-only attribute cannot leak because one category was set to
  // "everyone".
  effectiveAudience: AssignmentAudience;
  // Which category in the chain authored the winning row.
  sourceCategoryUuid: string;
  // True when the winning row came from an ancestor. Leaf-scoped filters are
  // offered only when this is false.
  inherited: boolean;
  // The master list narrowed to this category's slice, retired options removed.
  offeredOptions: SpecOption[];
};

export type ResolveAssignmentsInput = {
  // The category being resolved, then each ancestor up to the root — nearest
  // first. The nearest row for an attribute wins, so a child overrides its
  // parent.
  chain: string[];
  rows: AssignmentRow[];
  definitions: AssignmentDefinition[];
};

// Who is looking, on a shopper surface. Staff are not a shopper audience — the
// admin panel shows everything, because that is where the catalog is authored.
export type Viewer = "user" | "partner";

// ---------------------------------------------------------------------------
// The enabled slice
// ---------------------------------------------------------------------------

/**
 * The options a category offers: the master list narrowed to the assignment's
 * slice, with retired options dropped.
 *
 * Read LITERALLY. If an author enables 1G, 2.5G and 10G on a scale that also
 * holds 5G, they get exactly those three — 5G stays out. A "ceiling" reading
 * (everything up to the highest enabled option) would silently re-include a
 * value the author deliberately excluded, and nothing would ever tell them.
 * Authoring a ceiling is a one-click helper (see `ceilingSlice`) that fills the
 * values in, rather than a reinterpretation applied later.
 *
 * Narrowing is not forking: the master list is untouched and option values keep
 * their identity, so a rule comparing across two categories still lines up. A
 * category simply never OFFERS a value it has disabled.
 */
export const sliceOptions = (
  definition: AssignmentDefinition,
  enabledValues: string[] | null,
): SpecOption[] => {
  const live = definition.options.filter((option) => !option.retired);
  if (!enabledValues || enabledValues.length === 0) {
    return live;
  }
  const enabled = new Set(enabledValues);
  const sliced = live.filter((option) => enabled.has(option.value));
  // The slice names only options that have since been removed from the master
  // list — offer the whole live list rather than offering nothing at all, which
  // would make the attribute unusable with no explanation.
  return sliced.length > 0 ? sliced : live;
};

/**
 * The "up to" authoring helper: every option at or below the given one on the
 * scale. Fills an author's slice in one click without the stored slice meaning
 * anything other than the literal values it contains.
 */
export const ceilingSlice = (
  definition: AssignmentDefinition,
  highestValue: string,
): string[] => {
  if (!definition.ordered) {
    return [highestValue];
  }
  const ceiling = optionRank(definition, highestValue);
  if (ceiling === null) {
    return [highestValue];
  }
  return definition.options
    .filter(
      (option) =>
        !option.retired && option.rank !== null && option.rank <= ceiling,
    )
    .map((option) => option.value);
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

const resolveAudience = (
  definition: AssignmentDefinition,
  row: AssignmentSwitches,
): AssignmentAudience =>
  // The library may narrow but never widen. If it named an audience, that wins.
  definition.audience === "everyone" ? row.audience : definition.audience;

/**
 * Every attribute a category carries: its own assignments plus those inherited
 * from ancestors, nearest ancestor winning, minus anything suppressed.
 *
 * Ordered by the assignment's own order, then the library's, then label — so an
 * author can arrange a category's form without disturbing any other category.
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
      continue;
    }
    // Two rows for the same attribute at the same distance should be impossible
    // — the table is unique on (specification, category). If it ever happens
    // anyway (an import, a bad migration), SUPPRESSION wins rather than input
    // order: "this category does not carry it" is the safer reading, and an
    // outcome that depends on row order is worse than either answer.
    if (rowDistance === current.distance && row.suppressed) {
      winners.set(row.specificationUuid, { row, distance: rowDistance });
    }
  }

  const resolved: ResolvedAssignment[] = [];
  for (const { row, distance: rowDistance } of winners.values()) {
    // Suppression removes the attribute entirely rather than leaving it
    // resolved with both switches off — those are different things, and the
    // difference shows up in exports, the product form and completeness.
    if (row.suppressed) {
      continue;
    }
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
      suppressed: false,
      order: row.order,
      definition,
      effectiveAudience: resolveAudience(definition, row),
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

/** The resolved set as an attribute index the engine and evaluator can read. */
export const resolvedAttributeIndex = (
  resolved: ResolvedAssignment[],
): AttributeIndex => indexAttributes(resolved.map((entry) => entry.definition));

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

/**
 * Whether this shopper sees an attribute marked for that audience.
 *
 * Set membership, not a ladder: "everyone" is the union of user and partner, a
 * partner does NOT see a user-only attribute any more than a user sees a
 * partner-only one.
 */
export const isVisibleTo = (
  audience: AssignmentAudience,
  viewer: Viewer,
): boolean => audience === "everyone" || audience === viewer;

// ---------------------------------------------------------------------------
// The conditional reveal
// ---------------------------------------------------------------------------

/**
 * The assignments actually shown for a set of values, cascading.
 *
 * Two things have to hold for an attribute to be visible: its own condition
 * matches, AND the attributes its condition depends on are themselves visible.
 * The second is what makes it cascade — if PoE = No hides PoE Type, then
 * anything revealed by PoE Type hides too, rather than lingering because its own
 * condition happened to still match.
 *
 * Runs to a fixed point, bounded by the number of assignments, so a circular
 * reveal that slipped past authoring validation cannot spin forever.
 */
export const visibleAssignments = (
  resolved: ResolvedAssignment[],
  values: ProductValues,
): ResolvedAssignment[] => {
  const attributes = resolvedAttributeIndex(resolved);
  let visible = resolved;

  for (let pass = 0; pass <= resolved.length; pass += 1) {
    const present = new Set(
      visible.map((assignment) => assignment.definition.uuid),
    );
    const next = visible.filter((assignment) => {
      if (!assignment.showIf) {
        return true;
      }
      const dependencies = predicateAttributes(assignment.showIf);
      // A trigger that is not visible (or not assigned here at all) cannot
      // reveal anything. This is also what stops an orphaned reveal from
      // defaulting to "always show".
      if (!dependencies.every((attr) => present.has(attr))) {
        return false;
      }
      return evaluatePredicate(assignment.showIf, values, attributes).matched;
    });
    if (next.length === visible.length) {
      return next;
    }
    visible = next;
  }
  return visible;
};

/**
 * Drop the stored values of attributes the reveal conditions now hide.
 *
 * The half everyone forgets. Hiding PoE Budget without clearing it leaves the
 * engine sizing a switch off a number that no longer applies — and because the
 * field is hidden, nobody can see the number that is doing the damage.
 *
 * Values whose attribute this category does not assign are left untouched: they
 * belong to another category or an older product, and this resolver knows
 * nothing about them.
 */
export const clearHiddenValues = (
  resolved: ResolvedAssignment[],
  values: ProductValues,
): ProductValues => {
  const assigned = new Set(
    resolved.map((assignment) => assignment.definition.uuid),
  );
  const visible = new Set(
    visibleAssignments(resolved, values).map(
      (assignment) => assignment.definition.uuid,
    ),
  );

  const next: ProductValues = {};
  for (const [uuid, value] of Object.entries(values)) {
    if (!assigned.has(uuid) || visible.has(uuid)) {
      next[uuid] = value;
    }
  }
  return next;
};

// ---------------------------------------------------------------------------
// Storefront facets
// ---------------------------------------------------------------------------

/**
 * The assignments offered as facets on a category page.
 *
 * Scope decides reach: an assignment authored on this very category always
 * shows, but one inherited from an ancestor only shows if it is branch-wide.
 * Port Speed sits at Networking as branch-wide and filters switches, APs and
 * routers together; Detection Range sits on the motion-detector leaf and never
 * escapes it.
 *
 * `selection` is the shopper's OWN filter state, and it drives the conditional
 * reveal here the same way a product's values drive it on the product form: the
 * PoE Budget facet appears once the shopper has ticked PoE = Yes. Without it, a
 * PoE Budget filter sits on a page of non-PoE switches as pure noise.
 */
export const facetAssignments = (
  resolved: ResolvedAssignment[],
  viewer: Viewer,
  selection: ProductValues = {},
): ResolvedAssignment[] => {
  const revealed = new Set(
    visibleAssignments(resolved, selection).map(
      (assignment) => assignment.definition.uuid,
    ),
  );
  return resolved.filter(
    (assignment) =>
      assignment.isFilter &&
      isVisibleTo(assignment.effectiveAudience, viewer) &&
      (!assignment.inherited || assignment.scope === "branch") &&
      revealed.has(assignment.definition.uuid) &&
      // A number facet is a range input and needs no options; an option-backed
      // facet with nothing to offer would render an empty box.
      (assignment.definition.type === "number" ||
        assignment.definition.type === "boolean" ||
        assignment.offeredOptions.length > 0),
  );
};

/** The assignments the compatibility engine may read. Audience never gates this. */
export const ruleAssignments = (
  resolved: ResolvedAssignment[],
): ResolvedAssignment[] =>
  resolved.filter((assignment) => assignment.isRule);

// ---------------------------------------------------------------------------
// Completeness — the most dangerous failure mode in the system
// ---------------------------------------------------------------------------

export type CompletenessProblem = {
  specificationUuid: string;
  label: string;
  // revealed = the value is required because a condition brought the field into
  // view; assigned = it is required because the category assigns it as a rule
  // input at all times.
  reason: "revealed" | "assigned";
  // outside_slice is not a missing value but a value this category does not
  // offer — the author entered 40G where the category stops at 10G.
  kind: "missing" | "outside_slice";
};

/**
 * Which attributes a product MUST have a value for before it can be sold.
 *
 * A rule only fires on items that carry its attribute. So a camera with a blank
 * operating power silently passes every PoE budget check — and incomplete data
 * does not look like an error, it looks like approval. That is the single most
 * dangerous thing this model can do, so every attribute the engine reads is
 * mandatory, and a revealed field is mandatory the moment it becomes visible.
 *
 * Attributes that are filters only (isRule off) are never required: they affect
 * browsing, and a blank one cannot mislead the engine.
 */
export const completenessProblems = (
  resolved: ResolvedAssignment[],
  values: ProductValues,
): CompletenessProblem[] => {
  const visible = visibleAssignments(resolved, values);
  const problems: CompletenessProblem[] = [];

  for (const assignment of visible) {
    if (!assignment.isRule) {
      continue;
    }
    const raw = readValue(values, assignment.definition.uuid);
    if (!hasValue(raw)) {
      problems.push({
        specificationUuid: assignment.definition.uuid,
        label: assignment.definition.label,
        reason: assignment.showIf ? "revealed" : "assigned",
        kind: "missing",
      });
    }
  }

  for (const entry of outOfSliceValues(visible, values)) {
    problems.push({
      specificationUuid: entry.specificationUuid,
      label: entry.label,
      reason: "assigned",
      kind: "outside_slice",
    });
  }

  return problems;
};

/**
 * Values a product holds that its category does not offer.
 *
 * A real switch may support 40G in a category whose slice stops at 10G. Blocking
 * the entry would make the catalog unable to describe a product it sells;
 * silently allowing it would let the facet and the data disagree with nobody
 * noticing. So it is allowed, recorded, and surfaced — the conflict becomes a
 * task for whoever owns the assignment.
 */
export const outOfSliceValues = (
  resolved: ResolvedAssignment[],
  values: ProductValues,
): { specificationUuid: string; label: string; values: string[] }[] => {
  const found: {
    specificationUuid: string;
    label: string;
    values: string[];
  }[] = [];

  for (const assignment of resolved) {
    const { definition } = assignment;
    if (definition.type !== "single_select" && definition.type !== "multi_select") {
      continue;
    }
    const raw = readValue(values, definition.uuid);
    if (!hasValue(raw) || raw === undefined) {
      continue;
    }
    const offered = new Set(
      assignment.offeredOptions.map((option) => option.value),
    );
    const chosen = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const outside = chosen.filter((value) => !offered.has(value));
    if (outside.length > 0) {
      found.push({
        specificationUuid: definition.uuid,
        label: definition.label,
        values: outside,
      });
    }
  }
  return found;
};

// ---------------------------------------------------------------------------
// Authoring-time validation of the reveal graph
// ---------------------------------------------------------------------------

export type RevealProblem = {
  specificationUuid: string;
  label: string;
  code: "cycle" | "unassigned_trigger";
  message: string;
};

/**
 * Problems in a category's reveal graph, checked when an author saves.
 *
 * Two failures, both silent at runtime:
 *
 * - a CYCLE (A reveals B, B reveals A). The runtime is bounded so it cannot
 *   hang, but the outcome depends on evaluation order, which means the same data
 *   can render differently. Rejected at save time.
 * - an UNASSIGNED TRIGGER: the reveal watches an attribute this category does
 *   not carry, usually because someone removed it later. The field is then
 *   permanently hidden, and nothing says so.
 */
export const revealProblems = (
  resolved: ResolvedAssignment[],
): RevealProblem[] => {
  const problems: RevealProblem[] = [];
  const present = new Map(
    resolved.map((assignment) => [assignment.definition.uuid, assignment]),
  );

  const dependencies = new Map<string, string[]>();
  for (const assignment of resolved) {
    const deps = predicateAttributes(assignment.showIf);
    dependencies.set(assignment.definition.uuid, deps);
    for (const dep of deps) {
      if (!present.has(dep)) {
        problems.push({
          specificationUuid: assignment.definition.uuid,
          label: assignment.definition.label,
          code: "unassigned_trigger",
          message: `"${assignment.definition.label}" is revealed by an attribute this category does not carry, so it can never be shown.`,
        });
      }
    }
  }

  // Depth-first search over the reveal graph; a back edge is a cycle.
  const state = new Map<string, "visiting" | "done">();
  const seenCycle = new Set<string>();

  const visit = (uuid: string): boolean => {
    const current = state.get(uuid);
    if (current === "visiting") {
      return true;
    }
    if (current === "done") {
      return false;
    }
    state.set(uuid, "visiting");
    for (const dep of dependencies.get(uuid) ?? []) {
      if (present.has(dep) && visit(dep)) {
        if (!seenCycle.has(uuid)) {
          seenCycle.add(uuid);
          const assignment = present.get(uuid);
          problems.push({
            specificationUuid: uuid,
            label: assignment?.definition.label ?? uuid,
            code: "cycle",
            message: `"${assignment?.definition.label ?? uuid}" is part of a circular reveal — two attributes each wait for the other, so neither can ever be shown.`,
          });
        }
        state.set(uuid, "done");
        return true;
      }
    }
    state.set(uuid, "done");
    return false;
  };

  for (const uuid of present.keys()) {
    visit(uuid);
  }

  return problems;
};
