import { describe, expect, it } from "vitest";
import type { ProductValues } from "../../../db/types";
import {
  evaluateSelection,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
} from "./relationship-engine";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// COMPARING A VALUE AGAINST A SPAN.
//
// The gap: a device accepts 36–57 V DC and a PSU supplies 48 V. Every existing
// comparator is one-sided, so an author writes "at most 57" and the rule then
// passes a 12 V supply without a word. Both ends have to be read at once.
//
// The bug found on the way: `asOptionList` flattens a span to nothing on purpose
// (stringifying it would hand the set operators "[object Object]"), so EVERY
// comparator except "within" returned false for a span — a match rule with a range
// on either side reported every item as failing. One authoring slip blocked every
// cart in the catalog, while reading like a genuine finding.
// ---------------------------------------------------------------------------

const ACCEPTS = "attr-accepts";
const SUPPLIES = "attr-supplies";

const accepts: AttributeMeta = {
  uuid: ACCEPTS,
  label: "DC input voltage",
  type: "number",
  unit: "V",
  ordered: false,
  options: [],
};

const supplies: AttributeMeta = {
  uuid: SUPPLIES,
  label: "DC output voltage",
  type: "number",
  unit: "V",
  ordered: false,
  options: [],
};

const context: EngineContext = {
  attributes: indexAttributes([accepts, supplies]),
  variables: new Map(),
  catalog: [],
};

const rule = (
  comparator: EngineRelationship["comparator"],
): EngineRelationship => ({
  uuid: "rule-voltage",
  name: "DC supply must suit the device",
  description: null,
  family: "match",
  gate: "block",
  comparator,
  matchMode: "any",
  headroomPercent: 100,
  ratioLimit: null,
  allocation: "per_unit",
  perItem: false,
  // A is the supply, B is the accepted window: the supplied value must fall
  // inside what the device takes.
  consumer: { source: "spec", specUuid: SUPPLIES },
  provider: { source: "spec", specUuid: ACCEPTS },
  consumerWhen: null,
  providerWhen: null,
  lookup: null,
  presence: null,
  scope: null,
});

const item = (name: string, values: ProductValues): EngineItem => ({
  productUuid: name,
  name,
  quantity: 1,
  values,
});

const psu = (volts: number) => item("PSU", { [SUPPLIES]: volts });
const device = item("Switch", { [ACCEPTS]: { min: 36, max: 57 } });

const verdict = (comparator: EngineRelationship["comparator"], supply: number) =>
  evaluateSelection([rule(comparator)], [psu(supply), device], context)
    .findings[0];

describe("within", () => {
  it("passes a supply inside the accepted window", () => {
    expect(verdict("within", 48)?.status).toBe("pass");
  });

  it("blocks a supply below the window, which a ceiling rule would pass", () => {
    // THE case. "at most 57" is satisfied by 12 V, so an author who wrote only the
    // ceiling has a rule that approves a supply the device cannot run on.
    expect(verdict("within", 12)?.status).toBe("block");
  });

  it("blocks a supply above the window", () => {
    expect(verdict("within", 60)?.status).toBe("block");
  });

  it("accepts the boundaries as inside", () => {
    expect(verdict("within", 36)?.status).toBe("pass");
    expect(verdict("within", 57)?.status).toBe("pass");
  });

  it("requires the whole span to fit when both sides are spans", () => {
    // Mains 100–240 V against a PSU that accepts 200–240: the low end does not
    // fit, so it is not compatible — "overlaps" is a different and weaker question.
    const wide = item("Wide PSU", { [SUPPLIES]: { min: 100, max: 240 } });
    const report = evaluateSelection(
      [rule("within")],
      [wide, item("Switch", { [ACCEPTS]: { min: 200, max: 240 } })],
      context,
    );
    expect(report.findings[0]?.status).toBe("block");
  });
});

describe("a span under a set comparator", () => {
  it("reports unknown instead of failing every item", () => {
    // Before this, each of these returned false for the span and the rule reported
    // every item as failing — a blocker on every cart, authored by one wrong
    // dropdown choice.
    for (const comparator of ["in", "intersects", "eq", "lte", "gte"] as const) {
      const finding = verdict(comparator, 48);
      expect(finding?.status).toBe("unknown");
      expect(finding?.message).toContain("must fall within");
    }
  });

  it("never reports it as a pass either", () => {
    // Unknown is surfaced, not swallowed. The one thing an unreadable comparison
    // must never look like is an approved one.
    const finding = verdict("in", 48);
    expect(finding?.status).not.toBe("pass");
  });
});

describe("within on an ordered scale", () => {
  const cage: AttributeMeta = {
    uuid: "attr-cage",
    label: "Cage speeds",
    type: "multi_select",
    unit: null,
    ordered: true,
    options: [
      { value: "1g", label: "1G", rank: 1000, retired: false },
      { value: "10g", label: "10G", rank: 10000, retired: false },
      { value: "25g", label: "25G", rank: 25000, retired: false },
    ],
  };
  const moduleSpeed: AttributeMeta = {
    uuid: "attr-module",
    label: "Module speed",
    type: "single_select",
    unit: null,
    ordered: true,
    options: cage.options,
  };

  const scaleRule: EngineRelationship = {
    ...rule("within"),
    consumer: { source: "spec", specUuid: "attr-module" },
    provider: { source: "spec", specUuid: "attr-cage" },
  };
  const scaleContext: EngineContext = {
    ...context,
    attributes: indexAttributes([cage, moduleSpeed]),
  };

  it("reads a rank span, so a dropdown works like a number", () => {
    // The cage supports 1G and 10G — its span is those ranks. A 10G module fits;
    // a 25G one does not.
    const cageItem = item("Switch", { "attr-cage": ["1g", "10g"] });
    expect(
      evaluateSelection(
        [scaleRule],
        [item("Module", { "attr-module": "10g" }), cageItem],
        scaleContext,
      ).findings[0]?.status,
    ).toBe("pass");
    expect(
      evaluateSelection(
        [scaleRule],
        [item("Module", { "attr-module": "25g" }), cageItem],
        scaleContext,
      ).findings[0]?.status,
    ).toBe("block");
  });
});
