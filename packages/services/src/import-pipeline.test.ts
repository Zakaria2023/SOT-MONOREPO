import { describe, expect, it } from "vitest";
import type { SpecOption } from "../../../db/types";
import {
  applyResolutions,
  issueGroupKey,
  parseQuantity,
  parseSourceRow,
  parseSpan,
  type ImportTarget,
} from "./import-pipeline";
import type { AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// The importer's one rule is that it never invents. Every case below is a real
// defect from the source data (§K.4), and the pass condition is always the same
// shape: either the value is resolved with certainty, or a human is asked.
//
// A wrong value is worse than no value. An empty field is visible to the
// completeness check; a plausible wrong one looks entered and is invisible to
// every rule that reads it.
// ---------------------------------------------------------------------------

const option = (value: string, aliases?: string[]): SpecOption => ({
  value,
  label: value,
  rank: 0,
  retired: false,
  ...(aliases ? { aliases } : {}),
});

const meta = (over: Partial<AttributeMeta> & { uuid: string }): AttributeMeta => ({
  label: over.uuid,
  type: "number",
  unit: null,
  ordered: false,
  options: [],
  ...over,
});

const target = (
  over: Partial<AttributeMeta> & { uuid: string },
  extra: Partial<ImportTarget> = {},
): ImportTarget => ({
  meta: meta(over),
  key: over.uuid,
  ...extra,
});

const IP = target({
  uuid: "ip",
  label: "Ingress protection",
  type: "single_select",
  options: [option("IP66"), option("IP67")],
});
const IK = target({
  uuid: "ik",
  label: "Impact protection",
  type: "single_select",
  options: [option("IK08"), option("IK10")],
});
const CLASS = target({
  uuid: "class",
  label: "Environmental class",
  type: "single_select",
  // §M.2: `||` means `II` on 68 products. Aliases are the only reason an import
  // does not fork the master list on every run.
  options: [option("II", ["||"]), option("III", ["|||"])],
});
const DRAW = target({
  uuid: "draw",
  label: "Power draw",
  type: "number",
  unit: "W",
});
const RANGE_M = target({
  uuid: "range",
  label: "Radio communication range",
  type: "number",
  unit: "m",
});
const TEMP = target({
  uuid: "temp",
  label: "Operating temperature",
  type: "number",
  unit: "°C",
});
const BATTERY = target({
  uuid: "battery",
  label: "Battery type",
  type: "single_select",
  options: [option("CR123A"), option("CR2032")],
});

describe("parseQuantity", () => {
  it("reads a plain quantity and its unit", () => {
    expect(parseQuantity("4.8 W")).toEqual({ value: 4.8, unit: "W" });
  });

  it("survives thousands separators", () => {
    expect(parseQuantity("1,700 m")).toEqual({ value: 1700, unit: "m" });
  });

  it("converts imperial on the way in", () => {
    // §M.4: `5,550 ft` = `1,700 m`. Feet must never reach the catalogue — the
    // engine's unit table has no imperial in it at all, deliberately.
    const parsed = parseQuantity("5550 ft");
    expect(parsed?.unit).toBe("m");
    expect(parsed?.value).toBeCloseTo(1691.64, 1);
  });

  it("applies the offset for temperature rather than a factor", () => {
    // A factor-only conversion turns 32 °F into 17.8 °C and nothing looks wrong.
    expect(parseQuantity("32 °F")?.value).toBeCloseTo(0, 6);
    expect(parseQuantity("212 °F")?.value).toBeCloseTo(100, 6);
  });

  it("refuses text holding more than one number", () => {
    // "Up to 8 cameras over 4 channels" has no single answer, and a
    // search-anywhere regex would confidently return 8.
    expect(parseQuantity("Up to 8 cameras over 4 channels")).toBeNull();
  });

  it("refuses text holding no number", () => {
    expect(parseQuantity("not relevant")).toBeNull();
  });
});

describe("parseSpan", () => {
  it("reads a span written with a dash, a unicode minus and the word to", () => {
    expect(parseSpan("-20 to 60 °C")?.range).toEqual({ min: -20, max: 60 });
    expect(parseSpan("−20–60 °C")?.range).toEqual({ min: -20, max: 60 });
    expect(parseSpan("2.8...12.0 mm")?.range).toEqual({ min: 2.8, max: 12 });
  });

  it("puts a backwards span the right way round", () => {
    // Stored the wrong way round, a span inverts every comparison silently.
    expect(parseSpan("60 to -20 °C")?.range).toEqual({ min: -20, max: 60 });
  });
});

describe("issueGroupKey", () => {
  it("gives the same key to the same question asked by two products", () => {
    // This is what turns 68 answers into one.
    expect(issueGroupKey("unknown_value", "||", "class")).toBe(
      issueGroupKey("unknown_value", " ||  ", "class"),
    );
  });

  it("keeps the same text under two attributes apart", () => {
    // `Auto` under Frame Rate and `Auto` under White Balance look identical and
    // are two different questions.
    expect(issueGroupKey("unknown_value", "Auto", "a")).not.toBe(
      issueGroupKey("unknown_value", "Auto", "b"),
    );
  });
});

describe("parseSourceRow", () => {
  it("resolves a value through its alias", () => {
    const row = {
      sourceRef: "x",
      fields: [{ label: "Environmental class", text: "||" }],
    };
    const parsed = parseSourceRow(row, [CLASS]);
    expect(parsed.specValues.class).toBe("II");
    expect(parsed.issues).toHaveLength(0);
  });

  it("splits a fused field into two attributes", () => {
    // §K.4: `IP66, IK08` in one field on 228 products.
    const row = {
      sourceRef: "x",
      fields: [{ label: "Ingress protection", text: "IP66, IK08" }],
    };
    const parsed = parseSourceRow(row, [IP, IK]);
    expect(parsed.specValues).toEqual({ ip: "IP66", ik: "IK08" });
    expect(parsed.issues).toHaveLength(0);
  });

  it("does not split a value that merely contains a comma", () => {
    // The reason the whole is always tried first. Splitting eagerly turns one
    // good value into two issues.
    const graded = target({
      uuid: "grade",
      label: "Grade",
      type: "single_select",
      options: [option("Grade 2, Class II")],
    });
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Grade", text: "Grade 2, Class II" }] },
      [graded],
    );
    expect(parsed.specValues.grade).toBe("Grade 2, Class II");
    expect(parsed.issues).toHaveLength(0);
  });

  it("queues the whole field when only part of a split resolves", () => {
    // A partial match means the guess was wrong, so the text goes to a human
    // intact rather than half-applied.
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Ingress protection", text: "IP66, IK99" }] },
      [IP, IK],
    );
    expect(parsed.specValues).toEqual({});
    expect(parsed.issues[0]?.type).toBe("unknown_value");
    expect(parsed.issues[0]?.sourceText).toBe("IP66, IK99");
  });

  it("converts an imperial figure into the stored unit", () => {
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Radio communication range", text: "5550 ft" }] },
      [RANGE_M],
    );
    expect(parsed.specValues.range).toBeCloseTo(1691.64, 1);
    expect(parsed.issues).toHaveLength(0);
  });

  it("stores a span as a range", () => {
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Operating temperature", text: "-20 to 60 °C" }] },
      [TEMP],
    );
    expect(parsed.specValues.temp).toEqual({ min: -20, max: 60 });
  });

  it("refuses a unit that does not convert instead of assuming", () => {
    // W read as VA is the classic UPS sizing mistake, and every downstream
    // check reports it as a pass.
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Power draw", text: "1500 VA" }] },
      [DRAW],
    );
    expect(parsed.specValues).toEqual({});
    expect(parsed.issues[0]?.type).toBe("unit_ambiguity");
  });

  it("takes a bare number at the attribute's unit", () => {
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Power draw", text: "4.8" }] },
      [DRAW],
    );
    expect(parsed.specValues.draw).toBe(4.8);
  });

  it("normalises a punctuation variant onto the canonical option", () => {
    // §A5 warns that `IP-66` typed into a FREE field stops matching every rule
    // reading ingress protection. The library's loose pass is what stops that
    // happening on the way in: the punctuation is dropped and the canonical
    // value is stored, so the fork never enters the catalogue.
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Ingress protection", text: "IP-66" }] },
      [IP],
    );
    expect(parsed.specValues.ip).toBe("IP66");
    expect(parsed.issues).toHaveLength(0);
  });

  it("queues a value the master list has genuinely never seen", () => {
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Ingress protection", text: "IP69K" }] },
      [IP],
    );
    expect(parsed.specValues).toEqual({});
    expect(parsed.issues[0]?.type).toBe("unknown_value");
  });

  it("refuses a spelling that two options both answer to", () => {
    // Ambiguity is never broken by picking one. Two options claiming `Std`
    // means the source is unreadable, and choosing gives half the catalogue a
    // value nobody checked.
    const ambiguous = target({
      uuid: "amb",
      label: "Mode",
      type: "single_select",
      options: [option("Standard", ["Std"]), option("Standby", ["Std"])],
    });
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Mode", text: "Std" }] },
      [ambiguous],
    );
    expect(parsed.specValues).toEqual({});
    expect(parsed.issues[0]?.type).toBe("unknown_value");
  });

  it("tells 'not a value' apart from 'not a value here'", () => {
    // Different questions with different fixes: controlled-add versus a product
    // filed in the wrong category.
    const sliced: ImportTarget = { ...IP, enabledValues: ["IP67"] };
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Ingress protection", text: "IP66" }] },
      [sliced],
    );
    expect(parsed.issues[0]?.type).toBe("outside_vocabulary");
    expect(parsed.issues[0]?.proposedValue?.option).toBe("IP66");
  });

  it("queues a label that resolves to no attribute", () => {
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Sensitive element", text: "PIR" }] },
      [IP],
    );
    expect(parsed.issues[0]?.type).toBe("unknown_attribute");
    expect(parsed.issues[0]?.sourceText).toBe("Sensitive element");
  });

  it("flags two parts of the source disagreeing", () => {
    // §A5, the real case: DoorProtect U's body text says CR123A, its spec table
    // says CR131A. Neither is preferred.
    const parsed = parseSourceRow(
      {
        sourceRef: "x",
        fields: [
          { label: "Battery type", text: "CR123A" },
          { label: "Battery type", text: "CR2032" },
        ],
      },
      [BATTERY],
    );
    expect(parsed.specValues.battery).toBe("CR123A");
    expect(parsed.issues[0]?.type).toBe("contradiction");
  });

  it("does not flag the same value stated twice", () => {
    const parsed = parseSourceRow(
      {
        sourceRef: "x",
        fields: [
          { label: "Battery type", text: "CR123A" },
          { label: "Battery type", text: "CR123A" },
        ],
      },
      [BATTERY],
    );
    expect(parsed.issues).toHaveLength(0);
  });

  it("treats an empty field as empty, not as an issue and not as zero", () => {
    // Empty is empty — never zero, never N/A. The source simply did not say.
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Power draw", text: "   " }] },
      [DRAW],
    );
    expect(parsed.specValues).toEqual({});
    expect(parsed.issues).toHaveLength(0);
  });

  it("queues a group attribute rather than dropping its source text", () => {
    const ports = target({
      uuid: "ports",
      label: "Network ports",
      type: "group",
      groupFields: [],
    });
    const parsed = parseSourceRow(
      { sourceRef: "x", fields: [{ label: "Network ports", text: "4x 1G RJ45" }] },
      [ports],
    );
    expect(parsed.issues[0]?.type).toBe("unparseable");
    expect(parsed.issues[0]?.sourceText).toBe("4x 1G RJ45");
  });

  it("carries name and model through without touching them", () => {
    const parsed = parseSourceRow(
      { sourceRef: "x", name: "  DomeCam Mini  ", model: " DC-MINI ", fields: [] },
      [],
    );
    expect(parsed.name).toBe("DomeCam Mini");
    expect(parsed.model).toBe("DC-MINI");
  });
});

describe("applyResolutions", () => {
  const payload = { specValues: { ip: "IP66" } };

  it("leaves the parser's draft alone when nothing was asked", () => {
    expect(applyResolutions(payload, [])).toEqual({ ip: "IP66" });
  });

  it("fills in an approved answer", () => {
    expect(
      applyResolutions(payload, [
        { status: "approved", specificationUuid: "ik", resolvedValue: { option: "IK08" } },
      ]),
    ).toEqual({ ip: "IP66", ik: "IK08" });
  });

  it("leaves a rejected field empty rather than filling it with a default", () => {
    // Empty is empty. Rejecting IS the answer, and a zero here would be read by
    // every budget rule as a real measurement.
    expect(
      applyResolutions(payload, [
        { status: "rejected", specificationUuid: "draw", resolvedValue: { value: 0 } },
      ]),
    ).toEqual({ ip: "IP66" });
  });

  it("ignores an issue still open", () => {
    // The commit path refuses first; this is the second line, because a
    // half-answered row committing quietly is the one outcome worth two checks.
    expect(
      applyResolutions(payload, [
        { status: "approved", specificationUuid: "a", resolvedValue: { option: "X" } },
        { status: "open", specificationUuid: "b", resolvedValue: { option: "Y" } },
      ]),
    ).toEqual({ ip: "IP66", a: "X" });
  });

  it("lets a correction overwrite what the parser read", () => {
    expect(
      applyResolutions(payload, [
        { status: "corrected", specificationUuid: "ip", resolvedValue: { option: "IP67" } },
      ]),
    ).toEqual({ ip: "IP67" });
  });

  it("prefers the typed value over the option shorthand", () => {
    // A multi-select answer has to arrive as an array; `option` is only the
    // convenience for the ordinary single-select case.
    expect(
      applyResolutions(payload, [
        {
          status: "corrected",
          specificationUuid: "codec",
          resolvedValue: { option: "H.264", value: ["H.264", "H.265"] },
        },
      ]),
    ).toEqual({ ip: "IP66", codec: ["H.264", "H.265"] });
  });

  it("routes an unknown_attribute answer to the attribute the reviewer named", () => {
    // The issue itself has no attribute — that was the question. The answer
    // supplies one.
    expect(
      applyResolutions(payload, [
        {
          status: "corrected",
          specificationUuid: null,
          resolvedValue: { specificationUuid: "elements", value: "PIR" },
        },
      ]),
    ).toEqual({ ip: "IP66", elements: "PIR" });
  });
});
