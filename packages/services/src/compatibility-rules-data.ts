import type { RuleComparator, RuleKind, RuleSeverity } from "../../../db/enum";
import type { LookupTable } from "../../../db/types";

// The researched compatibility rules, as blueprints rather than seed rows.
//
// The library is admin-built and unseeded, so these can't be inserted blindly:
// a rule needs real attributes to bind to, and those attributes may not exist
// yet. Each blueprint therefore names the attribute KEYS it needs, and
// getRuleBlueprints() reports which are installable now and which are still
// missing a piece. Nothing is written until an admin installs one — same
// rules-as-data stance as the presence engine, just with a bind step.

export type RuleBlueprintOperand =
  | { type: "spec"; key: string }
  | { type: "variable"; key: string }
  // A conditional rule's capacity side: the lookup table is the capacity.
  | { type: "lookup" };

export type RuleBlueprint = {
  id: string;
  name: string;
  description: string;
  kind: RuleKind;
  comparator: RuleComparator;
  severity: RuleSeverity;
  headroomPercent?: number;
  consumer: RuleBlueprintOperand;
  provider: RuleBlueprintOperand;
  lookup?: LookupTable;
  // Why this rule exists, for the admin deciding whether to install it.
  rationale: string;
};

export const RULE_BLUEPRINTS: RuleBlueprint[] = [
  {
    id: "R1",
    name: "Camera ONVIF profile supported by the recorder",
    description:
      "A camera's ONVIF profile must be one the recorder supports. Profile S covers streaming, G recording, T advanced streaming — a camera offering only T against an S-only NVR will connect but not do what was sold.",
    kind: "spec_match",
    comparator: "intersects",
    severity: "block",
    consumer: { type: "spec", key: "onvif-profile" },
    provider: { type: "spec", key: "onvif-profile-supported" },
    rationale:
      "ONVIF conformance is per-profile, not a single yes/no, so the sets have to overlap rather than match exactly.",
  },
  {
    id: "R2",
    name: "Reader protocol supported by the access controller",
    description:
      "A reader's protocol (Wiegand or OSDP) must be one the controller speaks. OSDP readers on a Wiegand-only controller need a converter that is rarely quoted.",
    kind: "spec_match",
    comparator: "in",
    severity: "block",
    consumer: { type: "spec", key: "reader-protocol" },
    provider: { type: "spec", key: "reader-protocol-supported" },
    rationale:
      "The reader's protocol must be a member of what the controller supports — overlap isn't enough, since a reader speaks one protocol at a time.",
  },
  {
    id: "R3",
    name: "Lock fail mode matches the door's requirement",
    description:
      "A door specified fail-safe (unlocks on power loss, for egress) must not be fitted with a fail-secure lock, and vice versa. Getting this wrong is a life-safety issue, not an inconvenience.",
    kind: "spec_match",
    comparator: "eq",
    severity: "block",
    consumer: { type: "spec", key: "lock-fail-mode" },
    provider: { type: "spec", key: "door-required-fail-mode" },
    rationale:
      "Fail-safe and fail-secure are opposites; there is no partial match, so this is equality.",
  },
  {
    id: "R4",
    name: "Phone and PBX share a codec",
    description:
      "A handset and the PBX must have at least one audio codec in common, or the call sets up and carries no audio.",
    kind: "spec_match",
    comparator: "intersects",
    severity: "block",
    consumer: { type: "spec", key: "voip-codecs" },
    provider: { type: "spec", key: "pbx-codecs" },
    rationale:
      "Both sides advertise a set and negotiate; one shared codec is enough, so this is an intersection.",
  },
  {
    id: "R5",
    name: "Expected concurrent calls within PBX capacity",
    description:
      "The number of simultaneous calls the site expects must fit the PBX's concurrent-call ceiling. Extensions are not the constraint — a hundred extensions on a thirty-call PBX is normal and fine; a hundred simultaneous calls is not.",
    kind: "sum_budget",
    comparator: "lte",
    severity: "block",
    headroomPercent: 90,
    consumer: { type: "variable", key: "expected-concurrent-calls" },
    provider: { type: "spec", key: "max-concurrent-calls" },
    rationale:
      "The demand side is a project decision that no product carries, which is exactly what project variables are for.",
  },
  {
    id: "R6",
    name: "Speaker load matches the amplifier's output mode",
    description:
      "70V/100V line speakers and low-impedance (4/8Ω) speakers cannot share an amplifier output. A low-Z speaker on a 70V tap, or the reverse, damages one or the other.",
    kind: "spec_match",
    comparator: "in",
    severity: "block",
    consumer: { type: "spec", key: "speaker-output-mode" },
    provider: { type: "spec", key: "amplifier-output-modes" },
    rationale:
      "An amplifier may support both modes, but a given speaker is one of them — membership, not overlap.",
  },
  {
    id: "R7",
    name: "Device count within the panel's ceiling (expanders don't raise it)",
    description:
      "The alarm devices in the design must fit the control panel's maximum supported device count. An expander adds physical ports but not panel capacity, so it must never be counted as extra ceiling.",
    kind: "count_limit",
    comparator: "lte",
    severity: "block",
    headroomPercent: 100,
    consumer: { type: "spec", key: "alarm-device" },
    provider: { type: "spec", key: "panel-max-devices" },
    rationale:
      "The ceiling is a property of the panel alone. Model the expander's ports under a DIFFERENT attribute than panel-max-devices — if an expander carries the same capacity attribute, it silently raises a limit it cannot actually raise.",
  },
  {
    id: "R8",
    name: "Copper run length within its grade and speed limit",
    description:
      "Maximum run length depends on the cable's own grade and the link speed it carries — Cat6 runs 10G for 55 m but 1G for 100 m, while Cat6a runs 10G the full 100 m.",
    kind: "conditional",
    comparator: "lte",
    severity: "warn",
    headroomPercent: 100,
    consumer: { type: "spec", key: "run-length" },
    provider: { type: "lookup" },
    lookup: {
      inputs: ["cable-grade", "link-speed"],
      rows: [
        { when: { "cable-grade": "Cat5e", "link-speed": "1G" }, limit: 100 },
        { when: { "cable-grade": "Cat6", "link-speed": "1G" }, limit: 100 },
        { when: { "cable-grade": "Cat6", "link-speed": "10G" }, limit: 55 },
        { when: { "cable-grade": "Cat6a", "link-speed": "10G" }, limit: 100 },
        { when: { "cable-grade": "Cat7", "link-speed": "10G" }, limit: 100 },
      ],
    },
    rationale:
      "The limit comes from a table, not from another product — the case the Conditional family exists for.",
  },
];
