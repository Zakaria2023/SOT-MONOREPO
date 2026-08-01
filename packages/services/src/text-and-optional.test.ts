import { describe, expect, it } from "vitest";
import type { ProductValues } from "../../../db/types";
import {
  completenessProblems,
  expectedAttributes,
  facetAssignments,
  type AssignmentDefinition,
  type ResolvedAssignment,
} from "./assignment-resolver";
import { validatePredicate } from "./predicate";
import {
  asNumber,
  describeValue,
  indexAttributes,
  type AttributeMeta,
} from "./spec-values";

// ---------------------------------------------------------------------------
// TWO ADMISSIONS, and the guards that make them safe.
//
// `text` admits that some facts are a sentence. Left out of the model, they were
// still recorded — as OPTIONS — and a vocabulary with a sentence in it stops
// being comparable for every attribute sharing it. So the type exists, and
// everything that could try to COMPUTE on it refuses.
//
// `optional` admits that some blanks are real answers. Left out, a switch with
// an empty SFP cage was permanently incomplete for a media type that genuinely
// does not exist yet — and a warning that fires on the correct answer is one
// people learn to click past, along with the real ones beside it.
//
// Both are dangerous in the same direction, so every test below asks the same
// question: does the escape hatch stay shut where it matters?
// ---------------------------------------------------------------------------

const NOTE = "attr-mounting-note";
const DRAW = "attr-draw";
const MEDIA = "attr-uplink-media";

const meta = (
  overrides: Partial<AttributeMeta> & { uuid: string },
): AttributeMeta => ({
  label: "Attribute",
  type: "number",
  unit: null,
  ordered: false,
  options: [],
  ...overrides,
});

const MOUNTING_NOTE = meta({
  uuid: NOTE,
  label: "Mounting note",
  type: "text",
});

const OPERATING_DRAW = meta({
  uuid: DRAW,
  label: "Operating draw",
  type: "number",
  unit: "W",
});

const UPLINK_MEDIA = meta({
  uuid: MEDIA,
  label: "Uplink media",
  type: "single_select",
  options: [
    { value: "copper", label: "Copper", rank: null, retired: false },
    { value: "fibre", label: "Fibre", rank: null, retired: false },
  ],
});

const definition = (source: AttributeMeta): AssignmentDefinition => ({
  ...source,
  key: source.label.toLowerCase().replace(/ /g, "-"),
  internalName: null,
  description: null,
  audience: "everyone",
  allowRange: false,
  order: 0,
  groupUuid: null,
});

const assignment = (
  source: AttributeMeta,
  overrides: Partial<ResolvedAssignment> = {},
): ResolvedAssignment => ({
  isFilter: false,
  isRule: true,
  optional: false,
  scope: "branch",
  showIf: null,
  audience: "everyone",
  enabledValues: null,
  suppressed: false,
  order: 0,
  definition: definition(source),
  effectiveAudience: "everyone",
  sourceCategoryUuid: "cat",
  inherited: false,
  offeredOptions: source.options,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Free text: the value layer
// ---------------------------------------------------------------------------

describe("free text has no magnitude, including when it looks like one", () => {
  it("reads as no number even when the prose parses", () => {
    // THE case. "48" typed into a note is a perfectly good Number(), so a reader
    // that fell through to the numeric branch would run arithmetic on exactly the
    // products whose note happened to start with a digit — a rule that fires for
    // some items and not others, with nothing to say which.
    expect(asNumber("48", MOUNTING_NOTE)).toBeNull();
  });

  it("reads as no number for ordinary prose", () => {
    expect(
      asNumber("Ceiling or wall; bracket sold separately", MOUNTING_NOTE),
    ).toBeNull();
  });

  it("still reads a real number attribute", () => {
    // The guard is about the TYPE, not about strings — proof it did not just
    // break numbers stored as text.
    expect(asNumber("48", OPERATING_DRAW)).toBe(48);
  });

  it("shows the prose as written", () => {
    expect(describeValue("Wall mount only", MOUNTING_NOTE)).toBe(
      "Wall mount only",
    );
  });

  it("shows a blank note as unanswered, not as an empty sentence", () => {
    expect(describeValue("   ", MOUNTING_NOTE)).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// Free text: the guards
// ---------------------------------------------------------------------------

describe("free text cannot drive logic", () => {
  const attributes = indexAttributes([MOUNTING_NOTE, OPERATING_DRAW]);

  it("refuses a condition that compares the prose", () => {
    const problems = validatePredicate(
      { op: "equals", attr: NOTE, value: "Wall mount only" },
      attributes,
    );
    expect(problems.map((problem) => problem.code)).toContain("free_text");
  });

  it("refuses `has any value` too — the tempting one", () => {
    // `exists` is the operator that looks harmless: it does not compare the
    // words. What it actually tests is whether a colleague has finished typing,
    // and a reveal keyed on that appears and disappears as the catalog is filled
    // in, which nobody would ever diagnose from the outside.
    const problems = validatePredicate(
      { op: "exists", attr: NOTE },
      attributes,
    );
    expect(problems.map((problem) => problem.code)).toContain("free_text");
  });

  it("refuses an ordered comparison rather than suggesting a scale", () => {
    // Without the type check this lands on the "mark it as an ordered scale"
    // message, which is advice that sends an author off to add ranks to
    // sentences.
    const problems = validatePredicate(
      { op: "gte", attr: NOTE, value: 10 },
      attributes,
    );
    expect(problems.map((problem) => problem.code)).toEqual(["free_text"]);
  });

  it("leaves conditions on real attributes alone", () => {
    expect(
      validatePredicate({ op: "gte", attr: DRAW, value: 10 }, attributes),
    ).toEqual([]);
  });

  it("is never offered as a shopper facet", () => {
    // Belt and braces: assignments already normalise isFilter off for a text
    // attribute, so this is the state that should be unreachable. It is asserted
    // anyway, because "unreachable" is a claim about a different file.
    const facets = facetAssignments(
      [
        assignment(MOUNTING_NOTE, { isFilter: true, isRule: false }),
        assignment(UPLINK_MEDIA, { isFilter: true }),
      ],
      "user",
    );
    expect(facets.map((entry) => entry.definition.uuid)).toEqual([MEDIA]);
  });

  it("is never expected of a product, even when an assignment claims otherwise", () => {
    // The state saving normalises away, asserted anyway. A text attribute that
    // reached this list would make every product in the category permanently
    // incomplete for a value no rule could ever use.
    expect(
      expectedAttributes([
        assignment(MOUNTING_NOTE, { isRule: true }),
        assignment(OPERATING_DRAW),
      ]),
    ).toEqual([DRAW]);
  });

  it("is never reported as a missing value", () => {
    expect(
      completenessProblems([assignment(MOUNTING_NOTE, { isRule: true })], {}),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// optional: a blank that is a real answer
// ---------------------------------------------------------------------------

describe("an optional rule input", () => {
  const empty: ProductValues = {};

  it("reports a blank on a REQUIRED input", () => {
    const problems = completenessProblems([assignment(UPLINK_MEDIA)], empty);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.kind).toBe("missing");
  });

  it("says nothing about a blank the author declared legitimate", () => {
    const problems = completenessProblems(
      [assignment(UPLINK_MEDIA, { optional: true })],
      empty,
    );
    expect(problems).toEqual([]);
  });

  it("waives ABSENCE only — a wrong answer is still wrong", () => {
    // The line that keeps this from becoming an off switch for the whole
    // completeness model. An optional attribute holding a value no option carries
    // is unreadable data, not a missing value, and nothing about the waiver makes
    // it readable.
    const problems = completenessProblems(
      [assignment(UPLINK_MEDIA, { optional: true })],
      { [MEDIA]: "coax" },
    );
    expect(problems.map((problem) => problem.kind)).toEqual(["unknown_value"]);
  });

  it("is still read when the product DID answer", () => {
    const problems = completenessProblems(
      [assignment(UPLINK_MEDIA, { optional: true })],
      { [MEDIA]: "fibre" },
    );
    expect(problems).toEqual([]);
  });

  it("drops out of what a category expects, so no rule reports it missing", () => {
    // `expects` is how the engine tells a blank apart from an absence. Taking an
    // optional attribute off that list is the whole mechanism: the item stops
    // being reported as skipped, and a rule with nothing else to judge falls to
    // not-applicable rather than to "could not be checked".
    const resolved = [
      assignment(OPERATING_DRAW),
      assignment(UPLINK_MEDIA, { optional: true }),
    ];
    expect(expectedAttributes(resolved)).toEqual([DRAW]);
  });

  it("expects nothing of an attribute the engine does not read either way", () => {
    expect(
      expectedAttributes([
        assignment(UPLINK_MEDIA, { isRule: false, optional: false }),
      ]),
    ).toEqual([]);
  });

  it("does not waive a blank on a DIFFERENT attribute", () => {
    // One waiver, one attribute. A per-assignment flag leaking across the
    // category would silently exempt everything beside it.
    const problems = completenessProblems(
      [
        assignment(UPLINK_MEDIA, { optional: true }),
        assignment(OPERATING_DRAW),
      ],
      empty,
    );
    expect(problems.map((problem) => problem.specificationUuid)).toEqual([
      DRAW,
    ]);
  });
});
