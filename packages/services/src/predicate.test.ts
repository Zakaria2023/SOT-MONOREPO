import { describe, expect, it } from "vitest";
import type { Predicate } from "../../../db/types";
import {
  evaluatePredicate,
  predicateMatches,
  validatePredicate,
} from "./predicate";
import {
  asNumber,
  convert,
  indexAttributes,
  unitFactor,
  type AttributeMeta,
} from "./spec-values";

// A small library: one boolean, one ordered scale, one unordered multi-select,
// one number in watts and one in kilowatts.
const poe: AttributeMeta = {
  uuid: "a-poe",
  label: "PoE",
  type: "boolean",
  unit: null,
  ordered: false,
  options: [],
};

const poeType: AttributeMeta = {
  uuid: "a-poe-type",
  label: "PoE Type",
  type: "multi_select",
  unit: null,
  ordered: true,
  options: [
    { value: "af", label: "802.3af", rank: 1, retired: false },
    { value: "at", label: "802.3at", rank: 2, retired: false },
    { value: "bt", label: "802.3bt", rank: 3, retired: false },
  ],
};

const powerMode: AttributeMeta = {
  uuid: "a-power-mode",
  label: "Power Supply Mode",
  type: "multi_select",
  unit: null,
  ordered: false,
  options: [
    { value: "ac", label: "AC", rank: null, retired: false },
    { value: "dc", label: "DC", rank: null, retired: false },
    { value: "poe", label: "PoE", rank: null, retired: false },
  ],
};

const draw: AttributeMeta = {
  uuid: "a-draw",
  label: "Operating Power",
  type: "number",
  unit: "W",
  ordered: false,
  options: [],
};

const attributes = indexAttributes([poe, poeType, powerMode, draw]);

describe("evaluatePredicate", () => {
  it("treats a null predicate as always shown", () => {
    expect(predicateMatches(null, {}, attributes)).toBe(true);
  });

  it("matches a real boolean, not the string Yes", () => {
    const predicate: Predicate = {
      op: "equals",
      attr: "a-poe",
      value: true,
    };
    expect(predicateMatches(predicate, { "a-poe": true }, attributes)).toBe(
      true,
    );
    expect(predicateMatches(predicate, { "a-poe": false }, attributes)).toBe(
      false,
    );
  });

  // The Q57 decision: `any` is overlap, `all` is subset. The same product gives
  // opposite answers, which is exactly why the author has to choose.
  it("reads mode any as overlap and mode all as subset", () => {
    const values = { "a-power-mode": ["ac", "poe"] };

    const overlap: Predicate = {
      op: "in",
      attr: "a-power-mode",
      values: ["poe"],
      mode: "any",
    };
    const only: Predicate = {
      op: "in",
      attr: "a-power-mode",
      values: ["poe"],
      mode: "all",
    };

    expect(predicateMatches(overlap, values, attributes)).toBe(true);
    expect(predicateMatches(only, values, attributes)).toBe(false);
    expect(
      predicateMatches(only, { "a-power-mode": ["poe"] }, attributes),
    ).toBe(true);
  });

  it("reads equals on a multi-select as an exact set of one", () => {
    const predicate: Predicate = {
      op: "equals",
      attr: "a-power-mode",
      value: "poe",
    };
    expect(
      predicateMatches(predicate, { "a-power-mode": ["poe"] }, attributes),
    ).toBe(true);
    expect(
      predicateMatches(
        predicate,
        { "a-power-mode": ["poe", "ac"] },
        attributes,
      ),
    ).toBe(false);
  });

  it("compares an ordered select by rank, taking the best ticked option", () => {
    const atMostAt: Predicate = { op: "lte", attr: "a-poe-type", value: 2 };
    expect(
      predicateMatches(atMostAt, { "a-poe-type": ["af"] }, attributes),
    ).toBe(true);
    expect(
      predicateMatches(atMostAt, { "a-poe-type": ["bt"] }, attributes),
    ).toBe(false);
    // af + at → best is at (rank 2), which still fits "at most at".
    expect(
      predicateMatches(atMostAt, { "a-poe-type": ["af", "at"] }, attributes),
    ).toBe(true);
  });

  // The failure that would otherwise be invisible: a numeric comparison on an
  // unordered list. It must report as unanswerable, not quietly false.
  it("reports a numeric comparison on an unordered list as missing", () => {
    const result = evaluatePredicate(
      { op: "gte", attr: "a-power-mode", value: 1 },
      { "a-power-mode": ["poe"] },
      attributes,
    );
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual(["a-power-mode"]);
  });

  it("never lets a missing value satisfy a condition", () => {
    const isNotPoe: Predicate = {
      op: "not_equals",
      attr: "a-poe",
      value: true,
    };
    const result = evaluatePredicate(isNotPoe, {}, attributes);
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual(["a-poe"]);
  });

  it("reports an attribute that no longer exists as missing", () => {
    const result = evaluatePredicate(
      { op: "exists", attr: "a-deleted" },
      { "a-deleted": "something" },
      attributes,
    );
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual(["a-deleted"]);
  });

  it("ands with all, ors with any, and inverts with not", () => {
    const values = { "a-poe": true, "a-draw": 12 };

    const both: Predicate = {
      op: "all",
      children: [
        { op: "equals", attr: "a-poe", value: true },
        { op: "gte", attr: "a-draw", value: 10 },
      ],
    };
    const either: Predicate = {
      op: "any",
      children: [
        { op: "equals", attr: "a-poe", value: false },
        { op: "gte", attr: "a-draw", value: 10 },
      ],
    };

    expect(predicateMatches(both, values, attributes)).toBe(true);
    expect(predicateMatches(either, values, attributes)).toBe(true);
    expect(
      predicateMatches({ op: "not", child: both }, values, attributes),
    ).toBe(false);
  });

  it("collects every missing attribute, not just the first", () => {
    const result = evaluatePredicate(
      {
        op: "all",
        children: [
          { op: "exists", attr: "a-poe" },
          { op: "exists", attr: "a-draw" },
        ],
      },
      {},
      attributes,
    );
    expect(result.matched).toBe(false);
    expect(result.missing.sort()).toEqual(["a-draw", "a-poe"]);
  });

  it("treats zero and false as real answers, not as blanks", () => {
    expect(
      predicateMatches(
        { op: "exists", attr: "a-draw" },
        { "a-draw": 0 },
        attributes,
      ),
    ).toBe(true);
    expect(
      predicateMatches(
        { op: "exists", attr: "a-poe" },
        { "a-poe": false },
        attributes,
      ),
    ).toBe(true);
  });
});

describe("validatePredicate", () => {
  it("rejects a numeric comparison on an unordered list", () => {
    const problems = validatePredicate(
      { op: "lte", attr: "a-power-mode", value: 1 },
      attributes,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("not_ordered");
  });

  it("allows a numeric comparison on an ordered list", () => {
    expect(
      validatePredicate(
        { op: "lte", attr: "a-poe-type", value: 2 },
        attributes,
      ),
    ).toEqual([]);
  });

  it("catches an empty value list, which could never match", () => {
    const problems = validatePredicate(
      { op: "in", attr: "a-power-mode", values: [], mode: "any" },
      attributes,
    );
    expect(problems[0]?.code).toBe("empty_values");
  });

  it("catches an empty group, which always matches or always fails", () => {
    const problems = validatePredicate({ op: "all", children: [] }, attributes);
    expect(problems[0]?.code).toBe("empty_group");
  });

  it("catches a reference to a deleted attribute", () => {
    const problems = validatePredicate(
      { op: "exists", attr: "a-gone" },
      attributes,
    );
    expect(problems[0]?.code).toBe("unknown_attribute");
  });

  it("catches an inverted range", () => {
    const problems = validatePredicate(
      { op: "between", attr: "a-draw", min: 50, max: 10 },
      attributes,
    );
    expect(problems[0]?.code).toBe("bad_range");
  });
});

describe("unit safety", () => {
  it("converts within a dimension", () => {
    expect(convert(1.5, "kW", "W")).toBe(1500);
    expect(convert(500, "W", "kW")).toBe(0.5);
    expect(convert(2, "km", "m")).toBe(2000);
  });

  // The mistake this exists to prevent: VA and W are numerically similar and
  // physically different. 1500 VA is not 1500 W.
  it("refuses to convert VA to W", () => {
    const conversion = unitFactor("VA", "W");
    expect(conversion.ok).toBe(false);
    expect(convert(1500, "VA", "W")).toBeNull();
  });

  it("refuses to convert across unrelated dimensions", () => {
    expect(convert(10, "W", "m")).toBeNull();
    expect(convert(10, "ports", "channels")).toBeNull();
  });

  it("refuses when one side has a unit and the other does not", () => {
    expect(unitFactor("W", null).ok).toBe(false);
  });

  it("allows two unitless sides", () => {
    expect(unitFactor(null, null)).toEqual({ ok: true, factor: 1 });
  });
});

describe("asNumber", () => {
  it("returns the stored number for a number attribute", () => {
    expect(asNumber(12.5, draw)).toBe(12.5);
  });

  it("returns null for a non-numeric string rather than NaN", () => {
    expect(asNumber("12 W", draw)).toBeNull();
  });

  it("returns the highest rank for an ordered multi-select", () => {
    expect(asNumber(["af", "bt"], poeType)).toBe(3);
  });

  it("returns null for an unordered select", () => {
    expect(asNumber(["poe"], powerMode)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ranges in a condition.
//
// A condition on a span has to hold for the WHOLE span, so each operator reads
// the end that could break it. Reading the wrong end is silently wrong in the
// unsafe direction: a −20 to 60 °C part would pass "rated at most 40" because
// one end of it happens to be.
// ---------------------------------------------------------------------------

describe("Ranges in a condition", () => {
  const temperature: AttributeMeta = {
    uuid: "a-temp",
    label: "Operating Temperature",
    type: "number",
    unit: "°C",
    ordered: false,
    options: [],
  };
  const withTemperature = indexAttributes([
    poe,
    poeType,
    powerMode,
    draw,
    temperature,
  ]);

  // A part rated −20 to 60 °C.
  const outdoor = { "a-temp": { min: -20, max: 60 } };

  it("holds 'at least' only when the whole span clears the floor", () => {
    expect(
      predicateMatches(
        { op: "gte", attr: "a-temp", value: -30 },
        outdoor,
        withTemperature,
      ),
    ).toBe(true);
    // The top end is above −10, but the bottom is not, so the part is not
    // "always at least −10".
    expect(
      predicateMatches(
        { op: "gte", attr: "a-temp", value: -10 },
        outdoor,
        withTemperature,
      ),
    ).toBe(false);
  });

  it("holds 'at most' only when the whole span stays under the ceiling", () => {
    expect(
      predicateMatches(
        { op: "lte", attr: "a-temp", value: 70 },
        outdoor,
        withTemperature,
      ),
    ).toBe(true);
    expect(
      predicateMatches(
        { op: "lte", attr: "a-temp", value: 40 },
        outdoor,
        withTemperature,
      ),
    ).toBe(false);
  });

  it("holds 'between' only when the span sits entirely inside", () => {
    expect(
      predicateMatches(
        { op: "between", attr: "a-temp", min: -40, max: 80 },
        outdoor,
        withTemperature,
      ),
    ).toBe(true);
    expect(
      predicateMatches(
        { op: "between", attr: "a-temp", min: 0, max: 80 },
        outdoor,
        withTemperature,
      ),
    ).toBe(false);
  });

  it("counts a span as a value for exists", () => {
    expect(
      predicateMatches(
        { op: "exists", attr: "a-temp" },
        outdoor,
        withTemperature,
      ),
    ).toBe(true);
  });

  it("reports a malformed span as missing, never as a non-match", () => {
    const result = evaluatePredicate(
      { op: "gte", attr: "a-temp", value: 0 },
      { "a-temp": { max: 60 } as unknown as number },
      withTemperature,
    );
    expect(result.matched).toBe(false);
    expect(result.missing).toEqual(["a-temp"]);
  });

  it("reads a span at the named end", () => {
    expect(asNumber({ min: 4, max: 12 }, draw)).toBe(12);
    expect(asNumber({ min: 4, max: 12 }, draw, "min")).toBe(4);
    // Defaulting to the top is the safe default: a reader that does not know
    // which side it is on over-counts demand rather than over-promising supply.
    expect(asNumber({ min: 4, max: 12 }, draw, "max")).toBe(12);
  });
});
