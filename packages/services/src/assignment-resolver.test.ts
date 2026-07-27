import { describe, expect, it } from "vitest";
import type { Predicate, ProductValues } from "../../../db/types";
import {
  ceilingSlice,
  clearHiddenValues,
  completenessProblems,
  facetAssignments,
  isVisibleTo,
  outOfSliceValues,
  resolveAssignments,
  revealProblems,
  ruleAssignments,
  sliceOptions,
  visibleAssignments,
  type AssignmentDefinition,
  type AssignmentRow,
} from "./assignment-resolver";

// The tree used throughout: Networking (root) → Switches → SMB Switches.
const SMB = "cat-smb";
const SWITCHES = "cat-switches";
const NETWORKING = "cat-networking";
const CHAIN = [SMB, SWITCHES, NETWORKING];

const definition = (
  overrides: Partial<AssignmentDefinition> & { uuid: string; label: string },
): AssignmentDefinition => ({
  type: "single_select",
  unit: null,
  ordered: false,
  options: [],
  key: overrides.label.toLowerCase().replace(/\s+/g, "-"),
  internalName: null,
  description: null,
  audience: "everyone",
  order: 0,
  groupUuid: null,
  ...overrides,
});

const row = (
  overrides: Partial<AssignmentRow> & {
    specificationUuid: string;
    categoryUuid: string;
  },
): AssignmentRow => ({
  isFilter: true,
  isRule: true,
  scope: "branch",
  showIf: null,
  audience: "everyone",
  enabledValues: null,
  suppressed: false,
  order: 0,
  ...overrides,
});

const portSpeed = definition({
  uuid: "a-speed",
  label: "Port Speed",
  ordered: true,
  options: [
    { value: "100m", label: "100M", rank: 100, retired: false },
    { value: "1g", label: "1G", rank: 1000, retired: false },
    { value: "2.5g", label: "2.5G", rank: 2500, retired: false },
    { value: "5g", label: "5G", rank: 5000, retired: false },
    { value: "10g", label: "10G", rank: 10000, retired: false },
    { value: "40g", label: "40G", rank: 40000, retired: false },
  ],
});

const poe = definition({ uuid: "a-poe", label: "PoE", type: "boolean" });

const poeBudget = definition({
  uuid: "a-budget",
  label: "PoE Budget",
  type: "number",
  unit: "W",
});

const certification = definition({
  uuid: "a-cert",
  label: "Installer Certification",
  audience: "partner",
  options: [
    { value: "required", label: "Required", rank: null, retired: false },
    { value: "not", label: "Not required", rank: null, retired: false },
  ],
});

const definitions = [portSpeed, poe, poeBudget, certification];

describe("resolveAssignments", () => {
  it("inherits from an ancestor and marks it inherited", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [row({ specificationUuid: "a-speed", categoryUuid: NETWORKING })],
      definitions,
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.inherited).toBe(true);
    expect(resolved[0]?.sourceCategoryUuid).toBe(NETWORKING);
  });

  it("lets the nearest ancestor win", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-speed",
          categoryUuid: NETWORKING,
          enabledValues: ["1g"],
        }),
        row({
          specificationUuid: "a-speed",
          categoryUuid: SWITCHES,
          enabledValues: ["10g"],
        }),
      ],
      definitions,
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.sourceCategoryUuid).toBe(SWITCHES);
    expect(resolved[0]?.enabledValues).toEqual(["10g"]);
  });

  it("ignores rows from categories outside the chain", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [row({ specificationUuid: "a-speed", categoryUuid: "cat-cameras" })],
      definitions,
    });
    expect(resolved).toEqual([]);
  });

  // Q19: suppression removes the attribute, which is NOT the same as turning
  // both switches off — that would leave it resolved and still in the form.
  it("removes a suppressed attribute entirely", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "a-speed", categoryUuid: NETWORKING }),
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          suppressed: true,
        }),
      ],
      definitions,
    });
    expect(resolved).toEqual([]);
  });

  // Two rows for one pair should be impossible — the table is unique on
  // (specification, category). If bad data ever produces them, the answer must
  // not depend on which row was read first.
  it("lets suppression win over a duplicate row at the same distance", () => {
    const forward = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "a-speed", categoryUuid: SMB }),
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          suppressed: true,
        }),
      ],
      definitions,
    });
    const reversed = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          suppressed: true,
        }),
        row({ specificationUuid: "a-speed", categoryUuid: SMB }),
      ],
      definitions,
    });
    expect(forward).toEqual([]);
    expect(reversed).toEqual([]);
  });

  it("drops an assignment whose definition was deleted", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [row({ specificationUuid: "a-gone", categoryUuid: SMB })],
      definitions,
    });
    expect(resolved).toEqual([]);
  });

  it("lets the library narrow the audience but never a category widen it", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        // The category tries to expose a partner-only attribute to everyone.
        row({
          specificationUuid: "a-cert",
          categoryUuid: SMB,
          audience: "everyone",
        }),
        // The library left this one open, so the category's choice stands.
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          audience: "partner",
        }),
      ],
      definitions,
    });
    const byUuid = new Map(
      resolved.map((entry) => [entry.definition.uuid, entry]),
    );
    expect(byUuid.get("a-cert")?.effectiveAudience).toBe("partner");
    expect(byUuid.get("a-speed")?.effectiveAudience).toBe("partner");
  });
});

describe("sliceOptions", () => {
  // Q18: the slice is literal. A ceiling reading would silently put 5G back.
  it("offers exactly the enabled values, gaps included", () => {
    const offered = sliceOptions(portSpeed, ["1g", "2.5g", "10g"]);
    expect(offered.map((option) => option.value)).toEqual([
      "1g",
      "2.5g",
      "10g",
    ]);
  });

  it("offers the whole live list when nothing is enabled", () => {
    expect(sliceOptions(portSpeed, null)).toHaveLength(6);
    expect(sliceOptions(portSpeed, [])).toHaveLength(6);
  });

  it("never offers a retired option", () => {
    const withRetired = definition({
      uuid: "a-x",
      label: "X",
      options: [
        { value: "keep", label: "Keep", rank: null, retired: false },
        { value: "old", label: "Old", rank: null, retired: true },
      ],
    });
    expect(sliceOptions(withRetired, null).map((o) => o.value)).toEqual([
      "keep",
    ]);
  });

  it("falls back to the live list when the slice names only dead options", () => {
    expect(sliceOptions(portSpeed, ["nonexistent"])).toHaveLength(6);
  });

  it("fills a ceiling for the author in one click", () => {
    expect(ceilingSlice(portSpeed, "2.5g")).toEqual(["100m", "1g", "2.5g"]);
  });

  it("does not invent a ceiling on an unordered attribute", () => {
    expect(ceilingSlice(certification, "required")).toEqual(["required"]);
  });
});

describe("the conditional reveal", () => {
  const revealRows = [
    row({ specificationUuid: "a-poe", categoryUuid: SWITCHES }),
    row({
      specificationUuid: "a-budget",
      categoryUuid: SMB,
      showIf: { op: "equals", attr: "a-poe", value: true },
    }),
  ];

  const resolved = resolveAssignments({
    chain: CHAIN,
    rows: revealRows,
    definitions,
  });

  it("hides the revealed attribute until its trigger matches", () => {
    const hidden = visibleAssignments(resolved, { "a-poe": false });
    expect(hidden.map((a) => a.definition.uuid)).toEqual(["a-poe"]);

    const shown = visibleAssignments(resolved, { "a-poe": true });
    expect(shown.map((a) => a.definition.uuid).sort()).toEqual([
      "a-budget",
      "a-poe",
    ]);
  });

  // Q60: the trigger sits on an ancestor while the revealed field sits on the
  // leaf. Requiring both on one category would defeat inheritance.
  it("accepts a trigger inherited from an ancestor", () => {
    expect(
      visibleAssignments(resolved, { "a-poe": true }).some(
        (a) => a.definition.uuid === "a-budget",
      ),
    ).toBe(true);
  });

  it("cascades: hiding a trigger hides what it revealed", () => {
    const chained = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "a-poe", categoryUuid: SMB }),
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          showIf: { op: "equals", attr: "a-poe", value: true },
        }),
        row({
          specificationUuid: "a-budget",
          categoryUuid: SMB,
          showIf: { op: "in", attr: "a-speed", values: ["10g"], mode: "any" },
        }),
      ],
      definitions,
    });

    // PoE on and 10G picked: everything visible.
    expect(
      visibleAssignments(chained, { "a-poe": true, "a-speed": "10g" }),
    ).toHaveLength(3);

    // PoE off hides Port Speed, and PoE Budget goes with it even though its own
    // condition (speed = 10G) still technically matches the stored value.
    const collapsed = visibleAssignments(chained, {
      "a-poe": false,
      "a-speed": "10g",
    });
    expect(collapsed.map((a) => a.definition.uuid)).toEqual(["a-poe"]);
  });

  // Q22: the half everyone forgets.
  it("clears the value of a field it hides", () => {
    const values: ProductValues = { "a-poe": false, "a-budget": 130 };
    expect(clearHiddenValues(resolved, values)).toEqual({ "a-poe": false });
  });

  it("keeps the value while the field is shown", () => {
    const values: ProductValues = { "a-poe": true, "a-budget": 130 };
    expect(clearHiddenValues(resolved, values)).toEqual(values);
  });

  it("leaves values it does not assign untouched", () => {
    const values: ProductValues = { "a-poe": false, "a-foreign": "keep me" };
    expect(clearHiddenValues(resolved, values)["a-foreign"]).toBe("keep me");
  });

  it("hides a field whose trigger is not assigned at all", () => {
    const orphaned = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-budget",
          categoryUuid: SMB,
          showIf: { op: "equals", attr: "a-poe", value: true },
        }),
      ],
      definitions,
    });
    // The trigger is gone. It must not default to "always show".
    expect(visibleAssignments(orphaned, { "a-poe": true })).toEqual([]);
  });
});

describe("revealProblems", () => {
  it("reports a circular reveal", () => {
    const cyclic = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-poe",
          categoryUuid: SMB,
          showIf: { op: "exists", attr: "a-budget" },
        }),
        row({
          specificationUuid: "a-budget",
          categoryUuid: SMB,
          showIf: { op: "exists", attr: "a-poe" },
        }),
      ],
      definitions,
    });
    const problems = revealProblems(cyclic);
    expect(problems.some((problem) => problem.code === "cycle")).toBe(true);
  });

  it("reports a trigger the category does not carry", () => {
    const orphaned = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-budget",
          categoryUuid: SMB,
          showIf: { op: "equals", attr: "a-poe", value: true },
        }),
      ],
      definitions,
    });
    const problems = revealProblems(orphaned);
    expect(problems[0]?.code).toBe("unassigned_trigger");
  });

  it("passes a healthy chain", () => {
    const healthy = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "a-poe", categoryUuid: SMB }),
        row({
          specificationUuid: "a-budget",
          categoryUuid: SMB,
          showIf: { op: "equals", attr: "a-poe", value: true },
        }),
      ],
      definitions,
    });
    expect(revealProblems(healthy)).toEqual([]);
  });
});

describe("facetAssignments", () => {
  it("offers a branch-scoped inherited facet but not a leaf-scoped one", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-speed",
          categoryUuid: NETWORKING,
          scope: "branch",
        }),
        row({
          specificationUuid: "a-poe",
          categoryUuid: NETWORKING,
          scope: "leaf",
        }),
      ],
      definitions,
    });
    expect(
      facetAssignments(resolved, "user").map((a) => a.definition.uuid),
    ).toEqual(["a-speed"]);
  });

  it("shows a partner attribute to a partner and not to a user", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [row({ specificationUuid: "a-cert", categoryUuid: SMB })],
      definitions,
    });
    expect(facetAssignments(resolved, "partner")).toHaveLength(1);
    expect(facetAssignments(resolved, "user")).toHaveLength(0);
  });

  it("omits a living attribute the shopper never filters on", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          isFilter: false,
          isRule: true,
        }),
      ],
      definitions,
    });
    expect(facetAssignments(resolved, "user")).toEqual([]);
    expect(ruleAssignments(resolved)).toHaveLength(1);
  });

  // Q63: the facet reveal follows the SHOPPER's own filter selection.
  it("reveals a conditional facet once the shopper's filter satisfies it", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "a-poe", categoryUuid: SMB }),
        row({
          specificationUuid: "a-budget",
          categoryUuid: SMB,
          showIf: { op: "equals", attr: "a-poe", value: true },
        }),
      ],
      definitions,
    });
    expect(
      facetAssignments(resolved, "user", {}).map((a) => a.definition.uuid),
    ).toEqual(["a-poe"]);
    expect(
      facetAssignments(resolved, "user", { "a-poe": true })
        .map((a) => a.definition.uuid)
        .sort(),
    ).toEqual(["a-budget", "a-poe"]);
  });
});

describe("isVisibleTo", () => {
  it("treats user and partner as siblings, not a ladder", () => {
    expect(isVisibleTo("user", "partner")).toBe(false);
    expect(isVisibleTo("partner", "user")).toBe(false);
    expect(isVisibleTo("everyone", "user")).toBe(true);
    expect(isVisibleTo("everyone", "partner")).toBe(true);
  });
});

describe("completenessProblems", () => {
  const resolved = resolveAssignments({
    chain: CHAIN,
    rows: [
      row({ specificationUuid: "a-poe", categoryUuid: SMB }),
      row({
        specificationUuid: "a-budget",
        categoryUuid: SMB,
        showIf: { op: "equals", attr: "a-poe", value: true },
      }),
      // A filter-only attribute: browsing aid, never a rule input.
      row({
        specificationUuid: "a-speed",
        categoryUuid: SMB,
        isFilter: true,
        isRule: false,
      }),
    ],
    definitions,
  });

  // Q62 + Q40 together: this is the scenario that would otherwise ship a switch
  // with PoE and no budget, and let every budget rule skip it in silence.
  it("requires a revealed rule input once it is visible", () => {
    const problems = completenessProblems(resolved, { "a-poe": true });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.specificationUuid).toBe("a-budget");
    expect(problems[0]?.reason).toBe("revealed");
    expect(problems[0]?.kind).toBe("missing");
  });

  it("does not require a field that is hidden", () => {
    expect(completenessProblems(resolved, { "a-poe": false })).toEqual([]);
  });

  it("never requires a filter-only attribute", () => {
    const problems = completenessProblems(resolved, {
      "a-poe": true,
      "a-budget": 130,
    });
    expect(problems).toEqual([]);
  });

  it("accepts zero as a real answer", () => {
    expect(
      completenessProblems(resolved, { "a-poe": true, "a-budget": 0 }),
    ).toEqual([]);
  });
});

describe("outOfSliceValues", () => {
  // Q64: a real product that exceeds its category's slice. Allowed, recorded,
  // surfaced — not silently accepted and not blocked.
  it("reports a value the category does not offer", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-speed",
          categoryUuid: SMB,
          enabledValues: ["1g", "10g"],
        }),
      ],
      definitions,
    });
    const found = outOfSliceValues(resolved, { "a-speed": "40g" });
    expect(found).toHaveLength(1);
    expect(found[0]?.values).toEqual(["40g"]);

    expect(outOfSliceValues(resolved, { "a-speed": "10g" })).toEqual([]);
  });

  it("checks every ticked value of a multi-select", () => {
    const multi = definition({
      uuid: "a-bands",
      label: "Frequency Band",
      type: "multi_select",
      options: [
        { value: "2.4", label: "2.4GHz", rank: null, retired: false },
        { value: "5", label: "5GHz", rank: null, retired: false },
        { value: "6", label: "6GHz", rank: null, retired: false },
      ],
    });
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "a-bands",
          categoryUuid: SMB,
          enabledValues: ["2.4", "5"],
        }),
      ],
      definitions: [multi],
    });
    const found = outOfSliceValues(resolved, { "a-bands": ["5", "6"] });
    expect(found[0]?.values).toEqual(["6"]);
  });
});

describe("ordering", () => {
  it("sorts by assignment order, then library order, then label", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "a-budget", categoryUuid: SMB, order: 2 }),
        row({ specificationUuid: "a-poe", categoryUuid: SMB, order: 1 }),
        row({ specificationUuid: "a-speed", categoryUuid: SMB, order: 1 }),
      ],
      definitions,
    });
    // Both PoE and Port Speed sit at order 1, so the label breaks the tie.
    expect(resolved.map((a) => a.definition.label)).toEqual([
      "PoE",
      "Port Speed",
      "PoE Budget",
    ]);
  });
});

describe("a reveal driven by a number", () => {
  // Q58: "show Fan Type when draw > 500 W" — a natural rule that would
  // otherwise be faked with a dummy dropdown.
  it("reveals on a numeric threshold", () => {
    const fan = definition({ uuid: "a-fan", label: "Fan Type" });
    const showIf: Predicate = { op: "gt", attr: "a-budget", value: 500 };
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "a-budget", categoryUuid: SMB }),
        row({ specificationUuid: "a-fan", categoryUuid: SMB, showIf }),
      ],
      definitions: [...definitions, fan],
    });

    expect(
      visibleAssignments(resolved, { "a-budget": 400 }).map(
        (a) => a.definition.uuid,
      ),
    ).toEqual(["a-budget"]);
    expect(
      visibleAssignments(resolved, { "a-budget": 740 })
        .map((a) => a.definition.uuid)
        .sort(),
    ).toEqual(["a-budget", "a-fan"]);
  });
});
