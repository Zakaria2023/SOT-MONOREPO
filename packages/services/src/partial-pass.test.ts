import { describe, expect, it } from "vitest";
import { splitPasses, type Finding, type SkippedItem } from "./relationship-engine";

// ---------------------------------------------------------------------------
// The "looks like approval" bug, at the last boundary it could still hide in.
//
// The engine gets this right: a rule reports `pass` on what it could read and
// carries the items it had to skip. The design check then dropped every `pass`
// finding on the floor and returned a single number, so the skipped list — the
// one thing standing between a buyer and an unchecked design — went with it.
//
// A basket where one rule approved three products and could not read five
// reported "1 check passed" and nothing else at all.
// ---------------------------------------------------------------------------

const skipped = (name: string): SkippedItem => ({
  productUuid: `p-${name}`,
  name,
  missing: ["Operating Power"],
});

const finding = (over: Partial<Finding> = {}): Finding => ({
  relationshipUuid: "r1",
  name: "PoE",
  description: null,
  family: "budget",
  gate: "block",
  status: "pass",
  message: "Everything fits.",
  demand: 87,
  capacity: 1440,
  effectiveCapacity: 1152,
  unit: "W",
  consumers: [],
  providers: [],
  failingItems: [],
  bins: [],
  skipped: [],
  corrections: [],
  ...over,
});

describe("splitPasses", () => {
  it("counts a pass that read everything as clean", () => {
    const { clean, partial } = splitPasses([finding()]);
    expect(clean).toBe(1);
    expect(partial).toEqual([]);
  });

  it("does not count a pass that skipped items as clean", () => {
    const { clean, partial } = splitPasses([
      finding({ skipped: [skipped("EKI-2708P")] }),
    ]);
    expect(clean).toBe(0);
    expect(partial).toHaveLength(1);
  });

  it("keeps the skipped items, which are the whole point", () => {
    const { partial } = splitPasses([
      finding({
        skipped: [skipped("EKI-2708P"), skipped("DC-NVR5232")],
      }),
    ]);
    expect(partial[0].skipped.map((item) => item.name)).toEqual([
      "EKI-2708P",
      "DC-NVR5232",
    ]);
  });

  it("splits a mixed set without losing either side", () => {
    const { clean, partial } = splitPasses([
      finding({ relationshipUuid: "clean-1" }),
      finding({ relationshipUuid: "clean-2" }),
      finding({ relationshipUuid: "partial-1", skipped: [skipped("A")] }),
    ]);
    expect(clean).toBe(2);
    expect(partial.map((item) => item.relationshipUuid)).toEqual(["partial-1"]);
  });

  it("ignores every status that is not a pass", () => {
    // A blocked or unknown finding already reaches the buyer with its skipped
    // list intact. Counting those here would report them twice.
    const { clean, partial } = splitPasses([
      finding({ status: "block", skipped: [skipped("A")] }),
      finding({ status: "warn", skipped: [skipped("B")] }),
      finding({ status: "unknown", skipped: [skipped("C")] }),
      finding({ status: "not_applicable" }),
    ]);
    expect(clean).toBe(0);
    expect(partial).toEqual([]);
  });

  it("handles an empty report", () => {
    expect(splitPasses([])).toEqual({ clean: 0, partial: [] });
  });
});
