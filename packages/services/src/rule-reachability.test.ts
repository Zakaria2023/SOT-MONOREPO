import { describe, expect, it } from "vitest";
import type { AssignmentRow } from "./assignment-resolver";
import {
  diagnoseRules,
  predicateTestedValues,
  resolveLiveCategories,
  type ReachabilityFacts,
  type RuleFacts,
} from "./rule-reachability";

// A three-level tree: root > mid > leaf, plus an unrelated empty branch.
const CHAINS = new Map<string, string[]>([
  ["leaf", ["leaf", "mid", "root"]],
  ["mid", ["mid", "root"]],
  ["root", ["root"]],
  ["empty", ["empty", "root"]],
]);

const row = (over: Partial<AssignmentRow> = {}): AssignmentRow => ({
  specificationUuid: "power",
  categoryUuid: "root",
  isFilter: false,
  isRule: true,
  optional: false,
  scope: "leaf",
  showIf: null,
  audience: "everyone",
  enabledValues: null,
  suppressed: false,
  order: 0,
  ...over,
});

const rule = (over: Partial<RuleFacts> = {}): RuleFacts => ({
  uuid: "r1",
  name: "A rule",
  family: "budget",
  attributeUuids: ["power"],
  predicates: [],
  regions: null,
  ...over,
});

const facts = (over: Partial<ReachabilityFacts> = {}): ReachabilityFacts => ({
  rules: [rule()],
  attributeLabels: new Map([
    ["power", "Operating Power"],
    ["mount", "Mounting"],
  ]),
  assignments: [row()],
  chains: CHAINS,
  products: [{ categoryUuid: "leaf", attributeUuids: ["power"] }],
  ...over,
});

describe("resolveLiveCategories", () => {
  it("carries an ancestor's row down to every descendant", () => {
    const live = resolveLiveCategories([row()], CHAINS);
    expect([...(live.get("power")?.keys() ?? [])].sort()).toEqual([
      "empty",
      "leaf",
      "mid",
      "root",
    ]);
  });

  it("lets the nearest row win, so a suppression on the leaf takes it off", () => {
    const live = resolveLiveCategories(
      [row(), row({ categoryUuid: "leaf", suppressed: true })],
      CHAINS,
    );
    const carrying = [...(live.get("power")?.keys() ?? [])].sort();
    expect(carrying).toEqual(["empty", "mid", "root"]);
    expect(carrying).not.toContain("leaf");
  });

  it("does NOT let a suppression on an ancestor beat a nearer live row", () => {
    // The leaf re-enables what mid switched off. Nearest wins, so the leaf keeps
    // it — the same precedence the resolver uses at query time.
    const live = resolveLiveCategories(
      [
        row(),
        row({ categoryUuid: "mid", suppressed: true }),
        row({ categoryUuid: "leaf", suppressed: false }),
      ],
      CHAINS,
    );
    expect([...(live.get("power")?.keys() ?? [])].sort()).toEqual([
      "empty",
      "leaf",
      "root",
    ]);
  });

  it("keeps each category's own enabled slice", () => {
    const live = resolveLiveCategories(
      [
        row({ specificationUuid: "mount", enabledValues: ["rack", "wall"] }),
        row({
          specificationUuid: "mount",
          categoryUuid: "leaf",
          enabledValues: ["din"],
        }),
      ],
      CHAINS,
    );
    expect(live.get("mount")?.get("leaf")).toEqual(["din"]);
    expect(live.get("mount")?.get("mid")).toEqual(["rack", "wall"]);
  });
});

describe("predicateTestedValues", () => {
  it("collects equals and in, through all/any/not", () => {
    const found = predicateTestedValues({
      op: "all",
      children: [
        { op: "equals", attr: "mount", value: "rack" },
        {
          op: "not",
          child: { op: "in", attr: "mount", values: ["wall", "din"], mode: "any" },
        },
      ],
    });
    expect(found.get("mount")).toEqual(["rack", "wall", "din"]);
  });

  it("ignores a sub-field condition, whose values a slice does not govern", () => {
    const found = predicateTestedValues({
      op: "equals",
      attr: "ports",
      field: "speed",
      value: "10g",
    });
    expect(found.size).toBe(0);
  });
});

describe("diagnoseRules", () => {
  it("calls a rule reachable when its attribute is assigned, stocked and filled", () => {
    const [result] = diagnoseRules(facts());
    expect(result.status).toBe("reachable");
    expect(result.attributes[0].productsAnswering).toBe(1);
  });

  it("reports an attribute assigned nowhere as an authoring mistake", () => {
    const [result] = diagnoseRules(facts({ assignments: [] }));
    expect(result.status).toBe("unassigned");
    expect(result.reason).toContain("authoring mistake");
  });

  it("separates waiting-on-stock from broken", () => {
    const [result] = diagnoseRules(facts({ products: [] }));
    expect(result.status).toBe("no_products");
    expect(result.reason).toContain("stock");
  });

  it("separates waiting-on-data from waiting-on-stock", () => {
    const [result] = diagnoseRules(
      facts({ products: [{ categoryUuid: "leaf", attributeUuids: [] }] }),
    );
    expect(result.status).toBe("no_values");
    expect(result.reason).toContain("data entry");
  });

  it("does not count a stale value on a category that no longer carries it", () => {
    // The product sits in `empty`, which the suppression takes the attribute
    // off. Its leftover value must not make the attribute look answered.
    const [result] = diagnoseRules(
      facts({
        assignments: [row(), row({ categoryUuid: "empty", suppressed: true })],
        products: [{ categoryUuid: "empty", attributeUuids: ["power"] }],
      }),
    );
    expect(result.status).toBe("no_products");
    expect(result.attributes[0].productsAnswering).toBe(0);
  });

  it("catches a value narrowed out of existence by every slice", () => {
    const [result] = diagnoseRules(
      facts({
        rules: [
          rule({
            attributeUuids: ["mount"],
            predicates: [{ op: "equals", attr: "mount", value: "din" }],
          }),
        ],
        assignments: [
          row({ specificationUuid: "mount", enabledValues: ["rack", "wall"] }),
        ],
        products: [{ categoryUuid: "leaf", attributeUuids: ["mount"] }],
      }),
    );
    expect(result.status).toBe("value_disabled");
    expect(result.disabled[0].values).toEqual(["din"]);
  });

  it("stays quiet when one category still offers the value", () => {
    const [result] = diagnoseRules(
      facts({
        rules: [
          rule({
            attributeUuids: ["mount"],
            predicates: [{ op: "equals", attr: "mount", value: "din" }],
          }),
        ],
        assignments: [
          row({ specificationUuid: "mount", enabledValues: ["rack"] }),
          row({
            specificationUuid: "mount",
            categoryUuid: "leaf",
            enabledValues: ["din"],
          }),
        ],
        products: [{ categoryUuid: "leaf", attributeUuids: ["mount"] }],
      }),
    );
    expect(result.status).toBe("reachable");
    expect(result.disabled).toEqual([]);
  });

  it("treats an unrestricted slice as offering everything", () => {
    const [result] = diagnoseRules(
      facts({
        rules: [
          rule({
            attributeUuids: ["mount"],
            predicates: [{ op: "equals", attr: "mount", value: "anything" }],
          }),
        ],
        assignments: [row({ specificationUuid: "mount", enabledValues: null })],
        products: [{ categoryUuid: "leaf", attributeUuids: ["mount"] }],
      }),
    );
    expect(result.status).toBe("reachable");
  });

  it("reports the unassigned attribute ahead of a narrowed value", () => {
    // Fixing the slice would not help while the attribute is assigned nowhere,
    // so the deeper problem has to be the one that gets reported.
    const [result] = diagnoseRules(
      facts({
        rules: [
          rule({
            attributeUuids: ["power", "mount"],
            predicates: [{ op: "equals", attr: "mount", value: "din" }],
          }),
        ],
        assignments: [
          row({ specificationUuid: "mount", enabledValues: ["rack"] }),
        ],
        products: [{ categoryUuid: "leaf", attributeUuids: ["mount"] }],
      }),
    );
    expect(result.status).toBe("unassigned");
    expect(result.attributes.find((a) => a.specUuid === "power")?.status).toBe(
      "unassigned",
    );
  });

  it("does not claim a rule naming no attribute is broken", () => {
    const [result] = diagnoseRules(
      facts({ rules: [rule({ attributeUuids: [] })] }),
    );
    expect(result.status).toBe("reachable");
    expect(result.reason).toContain("names no attribute");
  });
});
