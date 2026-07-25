import { describe, expect, it } from "vitest";
import type { SpecOption } from "../../../db/types";
import {
  type AssignmentDefinition,
  type AssignmentRow,
  clearHiddenValues,
  facetAssignments,
  isVisibleTo,
  resolveAssignments,
  sliceOptions,
  visibleAssignments,
} from "./assignment-resolver";

// Category tree used throughout: Networking → Switches → SMB & SME. The chain
// is nearest-first, the order getCategoryAndAncestors returns.
const CHAIN = ["smb", "switches", "networking"];

const options = (...values: string[]): SpecOption[] =>
  values.map((value) => ({ value, children: [] }));

const definition = (
  overrides: Partial<AssignmentDefinition> &
    Pick<AssignmentDefinition, "uuid" | "key" | "label">,
): AssignmentDefinition => ({
  valueType: "select",
  inputType: "single_select",
  unit: null,
  allowMultiple: false,
  allowRange: false,
  ordered: false,
  options: [],
  order: 0,
  ...overrides,
});

const row = (
  overrides: Partial<AssignmentRow> &
    Pick<AssignmentRow, "specificationUuid" | "categoryUuid">,
): AssignmentRow => ({
  isFilter: false,
  isRule: true,
  scope: "branch",
  showIf: null,
  audience: "all",
  enabledValues: null,
  order: 0,
  ...overrides,
});

const PORT_SPEED = definition({
  uuid: "spec-speed",
  key: "port-speed",
  label: "Port Speed",
  ordered: true,
  options: options("100M", "1G", "2.5G", "10G"),
});

const POE = definition({
  uuid: "spec-poe",
  key: "poe",
  label: "PoE",
  options: options("Yes", "No"),
});

const POE_BUDGET = definition({
  uuid: "spec-poe-budget",
  key: "poe-budget",
  label: "PoE Budget",
  valueType: "number",
  inputType: "number",
  unit: "W",
});

const COLOR = definition({
  uuid: "spec-color",
  key: "color",
  label: "Color",
  options: options("Black", "White", "Grey"),
});

describe("sliceOptions", () => {
  it("offers the whole master list when nothing is disabled", () => {
    expect(sliceOptions(COLOR, null).map((option) => option.value)).toEqual([
      "Black",
      "White",
      "Grey",
    ]);
    expect(sliceOptions(COLOR, []).map((option) => option.value)).toHaveLength(
      3,
    );
  });

  it("narrows an unordered attribute to exactly the enabled set", () => {
    expect(
      sliceOptions(COLOR, ["Black", "Grey"]).map((option) => option.value),
    ).toEqual(["Black", "Grey"]);
  });

  it("reads an ordered slice as a ceiling, not a set", () => {
    // Enabling only 2.5G on a scale means "up to 2.5G" — 100M and 1G come too.
    expect(
      sliceOptions(PORT_SPEED, ["2.5G"]).map((option) => option.value),
    ).toEqual(["100M", "1G", "2.5G"]);
  });

  it("never edits the master list, only narrows it", () => {
    const sliced = sliceOptions(COLOR, ["Black"]);
    expect(sliced.every((option) => COLOR.options?.includes(option))).toBe(true);
    expect(COLOR.options).toHaveLength(3);
  });

  it("falls back to the master list when the slice is entirely stale", () => {
    // Options renamed in the library since the slice was authored.
    expect(
      sliceOptions(PORT_SPEED, ["40G"]).map((option) => option.value),
    ).toHaveLength(4);
  });
});

describe("resolveAssignments", () => {
  it("inherits an ancestor's assignment down the tree", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [row({ specificationUuid: "spec-speed", categoryUuid: "networking" })],
      definitions: [PORT_SPEED],
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].inherited).toBe(true);
    expect(resolved[0].sourceCategoryUuid).toBe("networking");
  });

  it("lets the nearest category override an ancestor's switches", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "spec-speed",
          categoryUuid: "networking",
          isFilter: true,
          enabledValues: ["10G"],
        }),
        row({
          specificationUuid: "spec-speed",
          categoryUuid: "switches",
          isFilter: false,
          enabledValues: ["1G"],
        }),
      ],
      definitions: [PORT_SPEED],
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].sourceCategoryUuid).toBe("switches");
    expect(resolved[0].isFilter).toBe(false);
    expect(resolved[0].offeredOptions.map((option) => option.value)).toEqual([
      "100M",
      "1G",
    ]);
  });

  it("ignores assignments from categories outside the chain", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [row({ specificationUuid: "spec-color", categoryUuid: "cameras" })],
      definitions: [COLOR],
    });

    expect(resolved).toEqual([]);
  });

  it("skips an assignment whose definition was deleted", () => {
    const resolved = resolveAssignments({
      chain: CHAIN,
      rows: [row({ specificationUuid: "spec-gone", categoryUuid: "smb" })],
      definitions: [COLOR],
    });

    expect(resolved).toEqual([]);
  });
});

describe("facetAssignments", () => {
  const resolved = resolveAssignments({
    chain: CHAIN,
    rows: [
      // Branch-wide from an ancestor — reaches down here.
      row({
        specificationUuid: "spec-speed",
        categoryUuid: "networking",
        isFilter: true,
        scope: "branch",
      }),
      // Leaf-only on an ancestor — must not escape that category.
      row({
        specificationUuid: "spec-color",
        categoryUuid: "switches",
        isFilter: true,
        scope: "leaf",
      }),
      // Living, not showing: the engine reads it, the shopper never sees it.
      row({
        specificationUuid: "spec-poe-budget",
        categoryUuid: "smb",
        isFilter: false,
        isRule: true,
      }),
    ],
    definitions: [PORT_SPEED, COLOR, POE_BUDGET],
  });

  it("offers a branch-wide filter inherited from an ancestor", () => {
    const keys = facetAssignments(resolved, "all").map(
      (assignment) => assignment.definition.key,
    );
    expect(keys).toContain("port-speed");
  });

  it("does not let a leaf-only filter escape the category that owns it", () => {
    const keys = facetAssignments(resolved, "all").map(
      (assignment) => assignment.definition.key,
    );
    expect(keys).not.toContain("color");
  });

  it("hides a rule-only attribute from the shopper", () => {
    const keys = facetAssignments(resolved, "all").map(
      (assignment) => assignment.definition.key,
    );
    expect(keys).not.toContain("poe-budget");
  });

  it("gates a facet by audience without affecting rule participation", () => {
    const partnerOnly = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "spec-color",
          categoryUuid: "smb",
          isFilter: true,
          audience: "partner",
        }),
      ],
      definitions: [COLOR],
    });

    expect(facetAssignments(partnerOnly, "all")).toHaveLength(0);
    expect(facetAssignments(partnerOnly, "partner")).toHaveLength(1);
    expect(facetAssignments(partnerOnly, "staff")).toHaveLength(1);
    // Still alive for the engine regardless of who can see it.
    expect(partnerOnly[0].isRule).toBe(true);
  });

  it("ranks audiences widest to narrowest", () => {
    expect(isVisibleTo("all", "all")).toBe(true);
    expect(isVisibleTo("partner", "all")).toBe(false);
    expect(isVisibleTo("staff", "partner")).toBe(false);
    expect(isVisibleTo("partner", "staff")).toBe(true);
  });
});

describe("show-if", () => {
  const resolved = resolveAssignments({
    chain: CHAIN,
    rows: [
      row({ specificationUuid: "spec-poe", categoryUuid: "smb" }),
      row({
        specificationUuid: "spec-poe-budget",
        categoryUuid: "smb",
        showIf: { specKey: "poe", values: ["Yes"] },
      }),
    ],
    definitions: [POE, POE_BUDGET],
  });

  it("shows a conditional attribute when its controller matches", () => {
    const keys = visibleAssignments(resolved, { poe: "Yes" }).map(
      (assignment) => assignment.definition.key,
    );
    expect(keys).toContain("poe-budget");
  });

  it("hides it when the controller does not match", () => {
    const keys = visibleAssignments(resolved, { poe: "No" }).map(
      (assignment) => assignment.definition.key,
    );
    expect(keys).not.toContain("poe-budget");
  });

  it("matches when any value of a multi-select controller is listed", () => {
    const multi = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "spec-color", categoryUuid: "smb" }),
        row({
          specificationUuid: "spec-poe-budget",
          categoryUuid: "smb",
          showIf: { specKey: "color", values: ["Grey"] },
        }),
      ],
      definitions: [COLOR, POE_BUDGET],
    });

    const keys = visibleAssignments(multi, { color: "Black, Grey" }).map(
      (assignment) => assignment.definition.key,
    );
    expect(keys).toContain("poe-budget");
  });

  it("clears the stored value of an attribute it hides", () => {
    // The half that matters: a leftover budget would let the engine size a
    // switch off a number that no longer applies.
    expect(clearHiddenValues(resolved, { poe: "No", "poe-budget": "370" })).toEqual(
      { poe: "No" },
    );
  });

  it("keeps the value while the attribute is shown", () => {
    expect(
      clearHiddenValues(resolved, { poe: "Yes", "poe-budget": "370" }),
    ).toEqual({ poe: "Yes", "poe-budget": "370" });
  });

  it("leaves values this category does not assign untouched", () => {
    // Belongs to another category's template or an older product — not ours
    // to delete.
    expect(clearHiddenValues(resolved, { poe: "No", "legacy-key": "keep" })).toEqual(
      { poe: "No", "legacy-key": "keep" },
    );
  });

  it("cascades: hiding a controller hides what depends on it", () => {
    const chained = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({ specificationUuid: "spec-poe", categoryUuid: "smb" }),
        row({
          specificationUuid: "spec-speed",
          categoryUuid: "smb",
          showIf: { specKey: "poe", values: ["Yes"] },
        }),
        row({
          specificationUuid: "spec-poe-budget",
          categoryUuid: "smb",
          showIf: { specKey: "port-speed", values: ["10G"] },
        }),
      ],
      definitions: [POE, PORT_SPEED, POE_BUDGET],
    });

    const keys = visibleAssignments(chained, {
      poe: "No",
      "port-speed": "10G",
      "poe-budget": "370",
    }).map((assignment) => assignment.definition.key);

    expect(keys).toEqual(["poe"]);
  });

  it("terminates on a circular show-if instead of spinning", () => {
    const circular = resolveAssignments({
      chain: CHAIN,
      rows: [
        row({
          specificationUuid: "spec-poe",
          categoryUuid: "smb",
          showIf: { specKey: "color", values: ["Black"] },
        }),
        row({
          specificationUuid: "spec-color",
          categoryUuid: "smb",
          showIf: { specKey: "poe", values: ["Yes"] },
        }),
      ],
      definitions: [POE, COLOR],
    });

    expect(
      visibleAssignments(circular, { poe: "Yes", color: "Black" }),
    ).toHaveLength(2);
  });
});
