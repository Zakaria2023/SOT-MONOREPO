import { describe, expect, it } from "vitest";
import {
  assessFirmware,
  compareVersions,
  meetsMinimum,
  parseVersion,
} from "./firmware";

describe("reading a version", () => {
  it("reads a dotted version", () => {
    expect(parseVersion("2.15.4")?.parts).toEqual([2, 15, 4]);
  });

  it("ignores a leading v", () => {
    expect(parseVersion("v3.42")?.parts).toEqual([3, 42]);
  });

  it("keeps a suffix without ranking on it", () => {
    const parsed = parseVersion("2.15.4-beta");
    expect(parsed?.parts).toEqual([2, 15, 4]);
    expect(parsed?.suffix).toBe("beta");
  });

  it("refuses to guess a version out of prose", () => {
    // A product name in the field means nobody was asked for a version. Reading
    // one out of it would invent the fact the whole file exists to be honest
    // about.
    for (const raw of ["OS Malevich 2.15.4", "latest", "", "  ", "unknown"]) {
      expect(parseVersion(raw), raw).toBeNull();
    }
  });
});

describe("comparing versions", () => {
  it("compares numerically, not as strings", () => {
    // THE BUG §8 NAMED. String comparison ranks "2.9" above "2.15", so a rule
    // requiring 2.15.4 would have passed a device on 2.9 — wrong in the direction
    // of approval, which is the worst direction.
    expect(compareVersions("2.9", "2.15")).toBeLessThan(0);
    expect(compareVersions("2.100", "2.99")).toBeGreaterThan(0);
  });

  it("treats a missing part as zero", () => {
    // 3.42 and 3.42.0 are the same release. Ranking the shorter one lower would
    // fail a device for having a tidier version number than the rule was written
    // with.
    expect(compareVersions("3.42", "3.42.0")).toBe(0);
    expect(compareVersions("3.42.1", "3.42")).toBeGreaterThan(0);
  });

  it("does not rank a pre-release against a release", () => {
    // Adopting a pre-release convention silently would put a device on the wrong
    // side of a fire-safety rule.
    expect(compareVersions("2.15.4-beta", "2.15.4")).toBe(0);
  });

  it("returns null rather than a number it cannot mean", () => {
    expect(compareVersions("latest", "2.15.4")).toBeNull();
    expect(compareVersions("2.15.4", null)).toBeNull();
  });

  it("answers the minimum question", () => {
    expect(meetsMinimum("2.15.4", "2.15.4")).toBe(true);
    expect(meetsMinimum("2.16", "2.15.4")).toBe(true);
    expect(meetsMinimum("2.9", "2.15.4")).toBe(false);
    expect(meetsMinimum(null, "2.15.4")).toBeNull();
  });
});

describe("what a firmware check may conclude", () => {
  const facts = {
    declared: "2.9",
    verified: false,
    required: "2.15.4",
    deviceName: "the UL detector",
  };

  it("warns, never blocks, on a version nobody verified", () => {
    // The central rule. The only evidence is somebody's word, and gating a
    // customer's system on hearsay is a different failure from letting it through
    // with a note.
    const assessment = assessFirmware(facts);
    expect(assessment.outcome).toBe("warn");
    expect(assessment.message).toContain("self-declared");
  });

  it("blocks the same shortfall once it is verified", () => {
    expect(assessFirmware({ ...facts, verified: true }).outcome).toBe("block");
  });

  it("passes a version that is new enough, verified or not", () => {
    // No warning for an unverified version that is new ENOUGH — there is no
    // problem to warn about, and warning anyway trains people to ignore the
    // warnings that matter.
    expect(assessFirmware({ ...facts, declared: "2.16" }).outcome).toBe("pass");
    expect(
      assessFirmware({ ...facts, declared: "2.16", verified: true }).outcome,
    ).toBe("pass");
  });

  it("is unknown when nobody recorded a version", () => {
    // Never a pass. A check that could not run is not a check that succeeded.
    for (const declared of [null, "", "   "]) {
      expect(assessFirmware({ ...facts, declared }).outcome).toBe("unknown");
    }
  });

  it("is unknown when the declared version cannot be parsed", () => {
    const assessment = assessFirmware({ ...facts, declared: "latest" });
    expect(assessment.outcome).toBe("unknown");
    expect(assessment.message).toContain("latest");
  });

  it("says so when it is the RULE that cannot be read, not the device", () => {
    // One of these is the customer's problem and the other is ours.
    const assessment = assessFirmware({ ...facts, required: "whatever" });
    expect(assessment.outcome).toBe("unknown");
    expect(assessment.message).toContain("requirement");
  });

  it("puts both numbers in every sentence it can", () => {
    // "Firmware too old" sends somebody hunting for which version they have and
    // which they need.
    for (const verified of [true, false]) {
      const { message } = assessFirmware({ ...facts, verified });
      expect(message).toContain("2.9");
      expect(message).toContain("2.15.4");
    }
  });
});
