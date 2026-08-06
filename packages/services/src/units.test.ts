import { describe, expect, it } from "vitest";
import { measurementUnits, UNIT_DIMENSIONS } from "../../../db/enum";
import { convert, unitFactor } from "./spec-values";

// ---------------------------------------------------------------------------
// UNITS — the quantities the specification library actually has to write down.
//
// Every unit added here exists because a real attribute could not otherwise be
// expressed: a polling interval in seconds, a detection speed in milliseconds, a
// radio output in milliwatts, a CO threshold in ppm, a floor area in m². Before
// them the nearest available unit turned a 36 s interval into 0.6 and a 20 mW
// output into 0.02 W — numbers no author recognises and no datasheet agrees with.
// ---------------------------------------------------------------------------

describe("the units the library needs exist", () => {
  it.each(["s", "ms", "mW", "ppm", "m²"])("offers %s", (unit) => {
    expect(measurementUnits).toContain(unit);
  });
});

describe("duration converts exactly", () => {
  // The reason the base moved from minutes to seconds. On a minute base a second
  // is 1/60 and h → s came out as 3600.0000000000005, so a detection speed
  // compared against a polling interval failed on the last decimal place —
  // intermittently, and irreproducibly.
  it("h to s is exactly 3600", () => {
    expect(unitFactor("h", "s")).toEqual({ ok: true, factor: 3600 });
  });

  it("s to ms is exactly 1000", () => {
    expect(unitFactor("s", "ms")).toEqual({ ok: true, factor: 1000 });
  });

  it("keeps a real polling interval whole", () => {
    expect(convert(36, "s", "s")).toBe(36);
    expect(convert(300, "s", "min")).toBe(5);
    expect(convert(24, "h", "s")).toBe(86400);
  });

  it("still converts the units that existed before the re-base", () => {
    // The base cancels in `unitFactor`, so re-basing changed no stored value and
    // no authored limit. This is the assertion that says so.
    expect(unitFactor("h", "min")).toEqual({ ok: true, factor: 60 });
    expect(convert(2, "h", "min")).toBe(120);
  });
});

describe("power", () => {
  it("converts milliwatts against watts", () => {
    expect(convert(20, "mW", "W")).toBe(0.02);
    expect(convert(1, "W", "mW")).toBe(1000);
  });

  it("still refuses to convert watts against volt-amps", () => {
    // 1500 VA is not 1500 W, and letting them convert is the classic UPS sizing
    // mistake. Adding mW must not have opened a door beside it.
    expect(unitFactor("mW", "VA").ok).toBe(false);
  });
});

describe("the new dimensions stay separate", () => {
  it("area does not convert against distance", () => {
    // Otherwise a floor plan compares against a cable run and reports a number.
    const result = unitFactor("m²", "m");
    expect(result.ok).toBe(false);
  });

  it("a CO threshold does not convert against a percentage", () => {
    expect(unitFactor("ppm", "%").ok).toBe(false);
  });

  it("ppm compares against ppm", () => {
    expect(unitFactor("ppm", "ppm")).toEqual({ ok: true, factor: 1 });
  });
});

describe("every unit that claims a dimension is a real unit", () => {
  // A typo in the dimension table is invisible: the unit simply becomes
  // unconvertible and every rule reading it reports "could not be checked".
  it("has no dimension entry for a unit nobody can pick", () => {
    const offered = new Set<string>(measurementUnits);
    for (const unit of Object.keys(UNIT_DIMENSIONS)) {
      expect(offered.has(unit)).toBe(true);
    }
  });
});
