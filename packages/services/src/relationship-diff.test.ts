import { describe, expect, it } from "vitest";
import type { RelationshipSnapshot } from "../../../db/types";
import { describeSnapshotValue, diffSnapshots } from "./relationship-diff";

const snapshot = (
  over: Partial<RelationshipSnapshot> = {},
): RelationshipSnapshot => ({
  name: "PoE",
  description: null,
  family: "budget",
  gate: "block",
  comparator: "lte",
  matchMode: "any",
  headroomPercent: 80,
  ratioLimit: null,
  allocation: "per_unit",
  perItem: true,
  consumer: { source: "spec", specUuid: "power" },
  provider: { source: "spec", specUuid: "budget" },
  consumerWhen: null,
  providerWhen: null,
  lookup: null,
  presence: null,
  scope: null,
  ...over,
});

describe("diffSnapshots", () => {
  it("says nothing when nothing changed", () => {
    expect(diffSnapshots(snapshot(), snapshot())).toEqual([]);
  });

  it("catches a scalar change", () => {
    const changes = diffSnapshots(
      snapshot({ headroomPercent: 80 }),
      snapshot({ headroomPercent: 60 }),
    );
    expect(changes).toEqual([
      { field: "headroomPercent", from: "80", to: "60" },
    ]);
  });

  it("catches a change the audit trail never recorded — the consumer operand", () => {
    // This is the whole reason the file exists. CatalogAudit diffs family, gate
    // and headroom, so re-pointing a rule at a different attribute left no trace.
    const changes = diffSnapshots(
      snapshot({ consumer: { source: "spec", specUuid: "power" } }),
      snapshot({ consumer: { source: "spec", specUuid: "draw" } }),
    );
    expect(changes.map((change) => change.field)).toEqual(["consumer"]);
  });

  it("catches a side filter appearing", () => {
    const changes = diffSnapshots(
      snapshot({ consumerWhen: null }),
      snapshot({
        consumerWhen: { op: "equals", attr: "family", value: "sfp" },
      }),
    );
    expect(changes).toEqual([
      { field: "consumerWhen", from: "—", to: "a condition" },
    ]);
  });

  it("counts lookup rows rather than unfolding them", () => {
    const changes = diffSnapshots(
      snapshot({
        lookup: {
          inputs: ["grade"],
          rows: [{ when: { op: "equals", attr: "g", value: "cat6" }, limit: 55 }],
        },
      }),
      snapshot({
        lookup: {
          inputs: ["grade"],
          rows: [
            { when: { op: "equals", attr: "g", value: "cat6" }, limit: 55 },
            { when: { op: "equals", attr: "g", value: "cat6a" }, limit: 100 },
          ],
        },
      }),
    );
    expect(changes).toEqual([
      { field: "lookup", from: "1 row", to: "2 rows" },
    ]);
  });

  it("does not report null against undefined as a change", () => {
    // A rule saved before a field existed has the key missing; one saved after
    // has it null. They are the same rule, and reporting it would put a row in
    // every diff forever.
    const before = snapshot();
    const after = snapshot();
    delete (after as Partial<RelationshipSnapshot>).providerWhen;
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("reports several changes in form order, not alphabetically", () => {
    const changes = diffSnapshots(
      snapshot(),
      snapshot({
        headroomPercent: 50,
        name: "PoE budget",
        gate: "warn",
      }),
    );
    expect(changes.map((change) => change.field)).toEqual([
      "name",
      "gate",
      "headroomPercent",
    ]);
  });

  it("treats a reordered but identical predicate as a change", () => {
    // Honest about its own limit: the comparison is on JSON text, so two trees
    // that mean the same thing written in a different order do read as changed.
    // Both versions are on screen, and a false 'changed' is cheaper here than a
    // deep-equality routine nobody can audit.
    const changes = diffSnapshots(
      snapshot({
        consumerWhen: {
          op: "all",
          children: [
            { op: "equals", attr: "a", value: 1 },
            { op: "equals", attr: "b", value: 2 },
          ],
        },
      }),
      snapshot({
        consumerWhen: {
          op: "all",
          children: [
            { op: "equals", attr: "b", value: 2 },
            { op: "equals", attr: "a", value: 1 },
          ],
        },
      }),
    );
    expect(changes.map((change) => change.field)).toEqual(["consumerWhen"]);
  });
});

describe("describeSnapshotValue", () => {
  it("renders the empty cases as one dash", () => {
    expect(describeSnapshotValue(null)).toBe("—");
    expect(describeSnapshotValue(undefined)).toBe("—");
    expect(describeSnapshotValue("")).toBe("—");
  });

  it("renders a boolean as a word, not as true/false", () => {
    expect(describeSnapshotValue(true)).toBe("yes");
    expect(describeSnapshotValue(false)).toBe("no");
  });

  it("names an operand by its source", () => {
    expect(describeSnapshotValue({ source: "item_count" })).toBe("a item_count");
  });

  it("counts presence requirements", () => {
    expect(
      describeSnapshotValue({
        trigger: { op: "exists", attr: "a" },
        requires: [{ description: "x", satisfiedBy: [] }],
      }),
    ).toBe("1 requirement");
  });

  it("does not print zero as a dash", () => {
    // 0 is an answer. Rendering it as "—" would read as "not set", which is the
    // one thing it is not.
    expect(describeSnapshotValue(0)).toBe("0");
  });
});
