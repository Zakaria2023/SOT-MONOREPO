import { describe, expect, it } from "vitest";
import {
  familyNeedsProvider,
  familyOperandType,
  validateRuleShape,
  type OperandShape,
  type RuleShape,
} from "./rule-validation";

// These cover the class of bug that is worst to ship: a relation the engine
// accepts, stores, and then never acts on. There is no error and no gate —
// the rule simply reports not_applicable forever and the design passes.

const number = (
  label: string,
  unit: string | null = "W",
): OperandShape => ({ label, valueType: "number", unit });

const select = (
  label: string,
  ordered = false,
): OperandShape => ({ label, valueType: "select", unit: null, ordered });

const shape = (overrides: Partial<RuleShape>): RuleShape => ({
  kind: "sum_budget",
  comparator: "lte",
  consumer: number("Power Consumption"),
  provider: number("PoE Budget"),
  ...overrides,
});

describe("familyOperandType", () => {
  it("wants numbers for every arithmetic family", () => {
    for (const kind of [
      "sum_budget",
      "count_limit",
      "per_item_threshold",
      "ratio",
      "conditional",
    ] as const) {
      expect(familyOperandType(kind)).toBe("number");
    }
  });

  it("wants dropdowns for Match", () => {
    expect(familyOperandType("spec_match")).toBe("select");
  });

  it("only lets Conditional go without a provider", () => {
    expect(familyNeedsProvider("conditional")).toBe(false);
    for (const kind of [
      "sum_budget",
      "count_limit",
      "per_item_threshold",
      "ratio",
      "spec_match",
    ] as const) {
      expect(familyNeedsProvider(kind)).toBe(true);
    }
  });
});

describe("a well-formed relation passes", () => {
  it("Budget: watts against watts", () => {
    expect(validateRuleShape(shape({}))).toEqual([]);
  });

  it("Count: may mix units, devices against ports", () => {
    expect(
      validateRuleShape(
        shape({
          kind: "count_limit",
          consumer: number("Device", "devices"),
          provider: number("Port Count", "ports"),
        }),
      ),
    ).toEqual([]);
  });

  it("Ratio: demand over supply", () => {
    expect(
      validateRuleShape(
        shape({
          kind: "ratio",
          consumer: number("Access demand", "Gbps"),
          provider: number("Uplink", "Gbps"),
        }),
      ),
    ).toEqual([]);
  });

  it("Match: dropdown against dropdown", () => {
    expect(
      validateRuleShape(
        shape({
          kind: "spec_match",
          comparator: "in",
          consumer: select("Impedance"),
          provider: select("Supported impedance"),
        }),
      ),
    ).toEqual([]);
  });

  it("Conditional: a measured number and a table, no provider", () => {
    expect(
      validateRuleShape(
        shape({
          kind: "conditional",
          consumer: number("Run length", "m"),
          provider: undefined,
          lookup: {
            inputs: ["cable-grade"],
            rows: [{ when: { "cable-grade": "Cat6" }, limit: 55 }],
          },
        }),
      ),
    ).toEqual([]);
  });
});

describe("the silent-failure bug: family against attribute type", () => {
  // The exact mistake that prompted this: Certification is Available / Not
  // Available, and Budget wants something to add up.
  it("rejects Budget on a dropdown attribute", () => {
    const problems = validateRuleShape(
      shape({ consumer: select("Certification") }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Certification");
    expect(problems[0]).toContain("dropdown");
    expect(problems[0]).toContain("never fire");
  });

  it("rejects Budget with a dropdown capacity", () => {
    expect(
      validateRuleShape(shape({ provider: select("Stacking") })),
    ).toHaveLength(1);
  });

  it("rejects Count on a dropdown — it still needs a readable value", () => {
    expect(
      validateRuleShape(
        shape({ kind: "count_limit", consumer: select("Certification") }),
      ),
    ).not.toEqual([]);
  });

  it("rejects Ratio on a dropdown", () => {
    expect(
      validateRuleShape(
        shape({ kind: "ratio", consumer: select("Certification") }),
      ),
    ).not.toEqual([]);
  });

  it("rejects Per-item on a dropdown", () => {
    expect(
      validateRuleShape(
        shape({ kind: "per_item_threshold", consumer: select("SFP Type") }),
      ),
    ).not.toEqual([]);
  });

  it("rejects Match on a numeric attribute — the mirror mistake", () => {
    const problems = validateRuleShape(
      shape({
        kind: "spec_match",
        comparator: "in",
        consumer: number("PoE Budget"),
        provider: select("Supported"),
      }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("both sides must be dropdowns");
  });

  it("names both sides when both are wrong", () => {
    expect(
      validateRuleShape(
        shape({
          consumer: select("Certification"),
          provider: select("Stacking"),
        }),
      ),
    ).toHaveLength(2);
  });
});

describe("units", () => {
  it("rejects watts against ports on a Budget", () => {
    const problems = validateRuleShape(
      shape({ provider: number("Port Count", "ports") }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("same unit");
  });

  it("rejects a unit mismatch on Per-item too", () => {
    expect(
      validateRuleShape(
        shape({
          kind: "per_item_threshold",
          provider: number("Per-port max", "A"),
        }),
      ),
    ).not.toEqual([]);
  });

  it("exempts Count, which weighs a quantity against a capacity", () => {
    expect(
      validateRuleShape(
        shape({
          kind: "count_limit",
          consumer: number("Camera", "devices"),
          provider: number("Ports", "ports"),
        }),
      ),
    ).toEqual([]);
  });

  it("treats a missing unit as a unit — no unit is not a wildcard", () => {
    expect(
      validateRuleShape(shape({ provider: number("Budget", null) })),
    ).not.toEqual([]);
  });
});

describe("ordered scales", () => {
  const scaleMatch = (consumerOrdered: boolean, providerOrdered: boolean) =>
    validateRuleShape(
      shape({
        kind: "spec_match",
        comparator: "lte",
        consumer: select("PoE required", consumerOrdered),
        provider: select("PoE supplied", providerOrdered),
      }),
    );

  it('rejects "at most" when neither side is a scale', () => {
    const problems = scaleMatch(false, false);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ordered scale");
  });

  it("accepts it when either side is ordered", () => {
    expect(scaleMatch(true, false)).toEqual([]);
    expect(scaleMatch(false, true)).toEqual([]);
  });

  it("leaves set operators alone on unordered attributes", () => {
    for (const comparator of ["in", "intersects", "eq"] as const) {
      expect(
        validateRuleShape(
          shape({
            kind: "spec_match",
            comparator,
            consumer: select("Codecs"),
            provider: select("PBX codecs"),
          }),
        ),
      ).toEqual([]);
    }
  });
});

describe("conditional relations", () => {
  const conditional = (overrides: Partial<RuleShape>) =>
    validateRuleShape(
      shape({
        kind: "conditional",
        consumer: number("Run length", "m"),
        provider: undefined,
        lookup: {
          inputs: ["cable-grade"],
          rows: [{ when: { "cable-grade": "Cat6" }, limit: 55 }],
        },
        ...overrides,
      }),
    );

  it("rejects one with no table — it has no limit to read", () => {
    expect(conditional({ lookup: null })).not.toEqual([]);
    expect(conditional({ lookup: { inputs: [], rows: [] } })).not.toEqual([]);
  });

  it("rejects a table with no key — every row would match everything", () => {
    expect(
      conditional({
        lookup: { inputs: [], rows: [{ when: {}, limit: 55 }] },
      }),
    ).not.toEqual([]);
  });

  it("rejects a row that says nothing about when it applies", () => {
    expect(
      conditional({
        lookup: {
          inputs: ["cable-grade"],
          rows: [
            { when: { "cable-grade": "Cat6" }, limit: 55 },
            { when: {}, limit: 100 },
          ],
        },
      }),
    ).not.toEqual([]);
  });

  it("rejects a provider — the table is the capacity", () => {
    const problems = conditional({ provider: number("PoE Budget") });
    expect(problems.some((p) => p.includes("leave the other side empty"))).toBe(
      true,
    );
  });

  it("rejects a lookup table on a family that cannot use one", () => {
    const problems = validateRuleShape(
      shape({
        lookup: {
          inputs: ["cable-grade"],
          rows: [{ when: { "cable-grade": "Cat6" }, limit: 55 }],
        },
      }),
    );
    expect(problems.some((p) => p.includes("only applies to"))).toBe(true);
  });
});

describe("incomplete relations", () => {
  it("asks for the capacity side when a family needs one", () => {
    const problems = validateRuleShape(shape({ provider: undefined }));
    expect(problems).toEqual(["Pick what this is measured against."]);
  });

  it("says nothing about an unpicked demand side — it is simply unfinished", () => {
    // The form disables submit on an empty name/operand; the checker only
    // reports pairings that would misbehave.
    expect(
      validateRuleShape(shape({ consumer: undefined })),
    ).toEqual([]);
  });
});
