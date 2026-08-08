import { describe, expect, it } from "vitest";
import type { ScenarioRuleVerdict, ScenarioSnapshot } from "../../../db/types";
import { diffScenario } from "./scenario-drift";

const verdict = (
  over: Partial<ScenarioRuleVerdict> = {},
): ScenarioRuleVerdict => ({
  relationshipUuid: "r1",
  name: "PoE",
  status: "pass",
  skippedProductUuids: [],
  ...over,
});

const snapshot = (rules: ScenarioRuleVerdict[]): ScenarioSnapshot => ({ rules });

describe("diffScenario", () => {
  it("says nothing when nothing moved", () => {
    const drift = diffScenario(snapshot([verdict()]), snapshot([verdict()]));
    expect(drift.identical).toBe(true);
    expect(drift.regressed).toBe(false);
  });

  it("reports a rule that now says something else, and calls it a regression", () => {
    const drift = diffScenario(
      snapshot([verdict({ status: "pass" })]),
      snapshot([verdict({ status: "block" })]),
    );
    expect(drift.changed).toEqual([
      { relationshipUuid: "r1", name: "PoE", before: "pass", after: "block" },
    ]);
    expect(drift.regressed).toBe(true);
  });

  it("does not call a newly authored rule a regression", () => {
    // Nobody ever agreed to it. Worth surfacing, not worth an alarm.
    const drift = diffScenario(
      snapshot([verdict()]),
      snapshot([verdict(), verdict({ relationshipUuid: "r2", name: "New" })]),
    );
    expect(drift.appeared.map((rule) => rule.name)).toEqual(["New"]);
    expect(drift.regressed).toBe(false);
    expect(drift.identical).toBe(false);
  });

  it("reports a deleted rule as lost cover, not as a failure", () => {
    const drift = diffScenario(
      snapshot([verdict(), verdict({ relationshipUuid: "r2", name: "Gone" })]),
      snapshot([verdict()]),
    );
    expect(drift.disappeared.map((rule) => rule.name)).toEqual(["Gone"]);
    expect(drift.regressed).toBe(false);
  });

  it("catches a rule that still passes while reading fewer products", () => {
    // The failure a status comparison cannot see: pass before, pass after, on
    // half the basket.
    const drift = diffScenario(
      snapshot([verdict({ status: "pass", skippedProductUuids: [] })]),
      snapshot([verdict({ status: "pass", skippedProductUuids: ["p1", "p2"] })]),
    );
    expect(drift.changed).toEqual([]);
    expect(drift.coverage).toEqual([
      {
        relationshipUuid: "r1",
        name: "PoE",
        status: "pass",
        newlySkipped: ["p1", "p2"],
        newlyRead: [],
      },
    ]);
    expect(drift.identical).toBe(false);
  });

  it("reports newly readable products too, so the baseline gets re-agreed", () => {
    const drift = diffScenario(
      snapshot([verdict({ skippedProductUuids: ["p1"] })]),
      snapshot([verdict({ skippedProductUuids: [] })]),
    );
    expect(drift.coverage[0].newlyRead).toEqual(["p1"]);
    expect(drift.coverage[0].newlySkipped).toEqual([]);
  });

  it("does not report coverage when the status itself changed", () => {
    // The status change is the headline; listing the skips underneath it would
    // be two findings for one event.
    const drift = diffScenario(
      snapshot([verdict({ status: "pass", skippedProductUuids: [] })]),
      snapshot([verdict({ status: "block", skippedProductUuids: ["p1"] })]),
    );
    expect(drift.changed).toHaveLength(1);
    expect(drift.coverage).toEqual([]);
  });

  it("follows a renamed rule by uuid rather than losing it", () => {
    const drift = diffScenario(
      snapshot([verdict({ name: "PoE" })]),
      snapshot([verdict({ name: "PoE budget" })]),
    );
    expect(drift.appeared).toEqual([]);
    expect(drift.disappeared).toEqual([]);
    expect(drift.identical).toBe(true);
  });

  it("names a changed rule by what it is called now", () => {
    const drift = diffScenario(
      snapshot([verdict({ name: "Old name", status: "pass" })]),
      snapshot([verdict({ name: "Current name", status: "warn" })]),
    );
    expect(drift.changed[0].name).toBe("Current name");
  });

  it("handles a baseline taken when there were no rules at all", () => {
    const drift = diffScenario(snapshot([]), snapshot([verdict()]));
    expect(drift.appeared).toHaveLength(1);
    expect(drift.regressed).toBe(false);
  });
});
