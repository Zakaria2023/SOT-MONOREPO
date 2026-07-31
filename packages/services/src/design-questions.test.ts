import { describe, expect, it } from "vitest";
import { pendingQuestions } from "./design-questions";
import {
  evaluateSelection,
  ruleVariables,
  type EngineContext,
  type EngineItem,
  type EngineRelationship,
  type EngineVariable,
  type Finding,
} from "./relationship-engine";
import { indexAttributes, type AttributeMeta } from "./spec-values";

// ---------------------------------------------------------------------------
// ASKING THE BUYER THE PROJECT QUESTIONS.
//
// The engine has always refused to run a rule whose project input was unanswered,
// and says so in the finding — "Tell us X and we can check Y". Nothing ever
// collected the answer. So a ratio rule told the buyer to tell us something with
// nowhere to tell us in, and a presence requirement excusable by a yes/no ("the
// site already records to the cloud") could never be excused: the buyer was
// blocked and handed no way through except buying a recorder they do not need.
//
// The rule for what to ask: derive it from the FINDINGS, never from the library.
// A dozen project inputs may exist; a buyer with three cameras in the cart must
// not be asked about PBX capacity, or they learn to skip the whole block.
// ---------------------------------------------------------------------------

const ROLE = "attr-role";
const DEMAND = "var-demand";
const CLOUD = "var-cloud";
const PORTS = "attr-ports";

const role: AttributeMeta = {
  uuid: ROLE,
  label: "Device role",
  type: "single_select",
  unit: null,
  ordered: false,
  options: [
    { value: "camera", label: "Camera", rank: null, retired: false },
    { value: "recorder", label: "Recorder", rank: null, retired: false },
  ],
};

const ports: AttributeMeta = {
  uuid: PORTS,
  label: "Ports",
  type: "number",
  unit: "ports",
  ordered: false,
  options: [],
};

const base = {
  description: null,
  matchMode: "any" as const,
  headroomPercent: 100,
  ratioLimit: null,
  allocation: "per_unit" as const,
  perItem: false,
  consumerWhen: null,
  providerWhen: null,
  lookup: null,
  presence: null,
  scope: null,
};

// "Access demand ÷ uplink capacity" — the demand is a number only the buyer knows.
const ratioRule: EngineRelationship = {
  ...base,
  uuid: "rule-ratio",
  name: "Uplink contention",
  family: "ratio",
  gate: "warn",
  comparator: "lte",
  ratioLimit: 20,
  consumer: { source: "variable", variableUuid: DEMAND },
  provider: { source: "spec", specUuid: PORTS },
};

// A camera needs a recorder — unless the buyer says recording is in the cloud.
const presenceRule: EngineRelationship = {
  ...base,
  uuid: "rule-presence",
  name: "Cameras need a recorder",
  family: "presence",
  gate: "block",
  comparator: "gte",
  consumer: null,
  provider: null,
  presence: {
    trigger: { op: "equals", attr: ROLE, value: "camera" },
    requires: [
      {
        description: "somewhere to record to",
        satisfiedBy: [
          {
            type: "item_exists",
            predicate: { op: "equals", attr: ROLE, value: "recorder" },
          },
          { type: "variable_true", variableUuid: CLOUD },
        ],
        perTriggerQuantity: 0,
      },
    ],
    suggestedFix: "Add a recorder, or tell us recording is in the cloud.",
  },
};

const variable = (
  uuid: string,
  label: string,
  value: number | boolean | null,
  unit: string | null = null,
): EngineVariable => ({ uuid, label, unit, value });

const withVariables = (...entries: EngineVariable[]): EngineContext => ({
  attributes: indexAttributes([role, ports]),
  variables: new Map(entries.map((entry) => [entry.uuid, entry])),
  catalog: [],
});

const camera: EngineItem = {
  productUuid: "cam",
  name: "Dome camera",
  quantity: 3,
  values: { [ROLE]: "camera" },
};

const recorder: EngineItem = {
  productUuid: "nvr",
  name: "Recorder",
  quantity: 1,
  values: { [ROLE]: "recorder" },
};

const switchItem: EngineItem = {
  productUuid: "sw",
  name: "Access switch",
  quantity: 1,
  values: { [ROLE]: "camera", [PORTS]: 8 },
};

const ask = (
  rules: EngineRelationship[],
  selection: EngineItem[],
  context: EngineContext,
) =>
  pendingQuestions(
    evaluateSelection(rules, selection, context).findings,
    rules,
    context.variables,
  );

describe("ruleVariables", () => {
  it("reads a magnitude off either operand", () => {
    expect(ruleVariables(ratioRule)).toEqual([
      { variableUuid: DEMAND, kind: "magnitude" },
    ]);
  });

  it("reads a toggle off a presence alternative", () => {
    expect(ruleVariables(presenceRule)).toEqual([
      { variableUuid: CLOUD, kind: "toggle" },
    ]);
  });

  it("reports nothing for a rule that reads only product values", () => {
    expect(
      ruleVariables({
        ...base,
        uuid: "rule-budget",
        name: "PoE budget",
        family: "budget",
        gate: "block",
        comparator: "lte",
        consumer: { source: "spec", specUuid: PORTS },
        provider: { source: "spec", specUuid: PORTS },
      }),
    ).toEqual([]);
  });

  it("names a variable once however many times the rule reads it", () => {
    expect(
      ruleVariables({
        ...base,
        uuid: "rule-both",
        name: "Both sides",
        family: "ratio",
        gate: "warn",
        comparator: "lte",
        consumer: { source: "variable", variableUuid: DEMAND },
        provider: { source: "variable", variableUuid: DEMAND },
      }),
    ).toHaveLength(1);
  });
});

describe("pendingQuestions", () => {
  it("asks for the magnitude a rule could not run without", () => {
    const questions = ask(
      [ratioRule],
      [switchItem],
      withVariables(variable(DEMAND, "Access demand", null, "ports")),
    );
    expect(questions).toEqual([
      {
        uuid: DEMAND,
        label: "Access demand",
        unit: "ports",
        kind: "magnitude",
        value: null,
        affects: ["ratio:rule-ratio"],
      },
    ]);
  });

  it("stops asking once the answer is in force", () => {
    // The answer may be the buyer's or the authored default; either way the rule
    // ran, so there is nothing left to ask.
    expect(
      ask(
        [ratioRule],
        [switchItem],
        withVariables(variable(DEMAND, "Access demand", 40, "ports")),
      ),
    ).toEqual([]);
  });

  it("asks a toggle that is merely defaulted to no, not answered no", () => {
    // THE case that blocked a buyer with no way out. "Recording is in the cloud"
    // sitting at its false default is not the buyer saying no — and it is the one
    // thing that would clear this blocker without buying a recorder.
    const questions = ask(
      [presenceRule],
      [camera],
      withVariables(variable(CLOUD, "Recording is in the cloud", false)),
    );
    expect(questions.map((question) => question.kind)).toEqual(["toggle"]);
    expect(questions[0]?.affects).toEqual(["presence:rule-presence"]);
  });

  it("asks nothing once the toggle is yes, because the rule now passes", () => {
    expect(
      ask(
        [presenceRule],
        [camera],
        withVariables(variable(CLOUD, "Recording is in the cloud", true)),
      ),
    ).toEqual([]);
  });

  it("asks nothing when the requirement is met by a product instead", () => {
    // The alternative was satisfied the other way, so the question would be an
    // interruption with nothing riding on it.
    expect(
      ask(
        [presenceRule],
        [camera, recorder],
        withVariables(variable(CLOUD, "Recording is in the cloud", false)),
      ),
    ).toEqual([]);
  });

  it("asks nothing about a rule nothing in the basket participates in", () => {
    // Not applicable, not unanswered. This is what keeps the block short enough
    // that a buyer reads it.
    expect(
      ask(
        [presenceRule],
        [recorder],
        withVariables(variable(CLOUD, "Recording is in the cloud", null)),
      ),
    ).toEqual([]);
  });

  it("names every finding that hinges on the same question, once", () => {
    const second: EngineRelationship = {
      ...ratioRule,
      uuid: "rule-ratio-2",
      name: "Second contention rule",
    };
    const questions = ask(
      [ratioRule, second],
      [switchItem],
      withVariables(variable(DEMAND, "Access demand", null, "ports")),
    );
    expect(questions).toHaveLength(1);
    expect(questions[0]?.affects).toEqual([
      "ratio:rule-ratio",
      "ratio:rule-ratio-2",
    ]);
  });

  it("stays silent about a deleted input rather than rendering a blank field", () => {
    // The finding still reports the problem in its own words; what it cannot do is
    // become a question with no label on it.
    expect(ask([ratioRule], [switchItem], withVariables())).toEqual([]);
  });

  it("asks nothing when the rule could not run on PRODUCT data", () => {
    // Our gap, not the buyer's. A question here would ask them to answer for a
    // value we failed to record.
    const unreadable: EngineItem = {
      productUuid: "sw2",
      name: "Switch with no ports recorded",
      quantity: 1,
      values: { [ROLE]: "camera" },
      expects: [PORTS],
    };
    const findings: Finding[] = evaluateSelection(
      [
        {
          ...base,
          uuid: "rule-budget",
          name: "PoE budget",
          family: "budget",
          gate: "block",
          comparator: "lte",
          consumer: { source: "spec", specUuid: PORTS },
          provider: { source: "spec", specUuid: PORTS },
        },
      ],
      [unreadable],
      withVariables(variable(DEMAND, "Access demand", null)),
    ).findings;
    expect(pendingQuestions(findings, [], new Map())).toEqual([]);
  });
});
