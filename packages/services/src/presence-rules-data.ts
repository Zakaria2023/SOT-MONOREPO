import type {
  PresenceAlternative,
  PresencePredicate,
  PresenceRule,
} from "./presence-engine";

// The canonical 18 requires-companion rules as data. This is the source of
// truth that seeds the PresenceRules table; getPresenceRules() prefers the
// table (admin-edited) and falls back to these. Predicates read a projected
// item's attributes (see itemToPresenceAttributes in presence-rules.ts):
//   kind             string[]  device classes (camera, recorder, poe_source, …)
//   power_supply_mode string[] AC · DC · PoE · Battery · Bus-powered
//   rack_mount / used_outdoors / outdoor_rated / solid_door / active_gear  bools
// Project choices (the escape hatches) are matched via boq_flag.

const hasKind = (kind: string): PresencePredicate => ({
  op: "includes",
  attr: "kind",
  value: kind,
});

const itemWithKind = (kind: string): PresenceAlternative => ({
  type: "item_exists",
  predicate: hasKind(kind),
});

const flag = (name: string): PresenceAlternative => ({
  type: "boq_flag",
  flag: name,
});

export const PRESENCE_RULES: PresenceRule[] = [
  {
    id: "P1",
    name: "Detector → hub",
    severity: "hard",
    trigger: hasKind("alarm_device"),
    requires: [
      { description: "a control panel (hub)", satisfiedBy: [itemWithKind("control_panel")] },
    ],
    message:
      "This alarm/automation device needs a control panel (hub) to connect to. Add a hub.",
    suggestedFix: "add:control_panel",
  },
  {
    id: "P2",
    name: "Wired detector → bus hub",
    severity: "hard",
    trigger: {
      op: "all",
      value: [hasKind("alarm_device"), { op: "includes", attr: "connection", value: "wired_bus" }],
    },
    requires: [
      {
        description: "a hub with a wired bus (not wireless-only)",
        satisfiedBy: [itemWithKind("wired_bus_hub")],
      },
    ],
    message:
      "A wired-bus detector needs a hybrid hub that has a wired bus — a wireless-only hub can't connect it.",
    suggestedFix: "add:wired_bus_hub",
  },
  {
    id: "P3",
    name: "Camera → recorder",
    severity: "hard",
    trigger: hasKind("camera"),
    requires: [
      {
        description: "a recorder, or a cloud-recording choice",
        satisfiedBy: [itemWithKind("recorder"), flag("cloud_recording")],
      },
    ],
    message:
      "A camera needs somewhere to record. Add a recorder (NVR/DVR) or choose cloud recording.",
    suggestedFix: "add:recorder",
  },
  {
    id: "P4",
    name: "PoE camera → PoE source",
    severity: "hard",
    trigger: hasKind("poe_camera"),
    requires: [
      {
        description: "a PoE switch, injector, or PoE-port recorder",
        satisfiedBy: [itemWithKind("poe_source")],
      },
    ],
    message:
      "A PoE camera needs a PoE power source — add a PoE switch, a PoE injector, or a recorder with PoE ports.",
    suggestedFix: "add:poe_source",
  },
  {
    id: "P5",
    name: "SIP phone → PBX",
    severity: "hard",
    trigger: hasKind("sip_phone"),
    requires: [
      {
        description: "a PBX, or a SIP-trunk / cloud choice",
        satisfiedBy: [itemWithKind("pbx"), flag("sip_trunk_or_cloud")],
      },
    ],
    message:
      "A SIP phone needs a call platform. Add a PBX or choose a hosted SIP-trunk / cloud platform.",
    suggestedFix: "add:pbx",
  },
  {
    id: "P6",
    name: "Analog phone → FXS",
    severity: "hard",
    trigger: hasKind("analog_phone"),
    requires: [
      {
        description: "a gateway with FXS ports",
        satisfiedBy: [itemWithKind("fxs_gateway")],
      },
    ],
    message:
      "An analog phone needs an FXS gateway to reach the network. Add a gateway with FXS ports.",
    suggestedFix: "add:fxs_gateway",
  },
  {
    id: "P7",
    name: "PSTN → FXO",
    severity: "hard",
    trigger: { op: "equals", attr: "uses_pstn_lines", value: true },
    requires: [
      {
        description: "a gateway with FXO ports",
        satisfiedBy: [itemWithKind("fxo_gateway")],
      },
    ],
    message:
      "Using PSTN lines requires an FXO gateway to terminate them. Add a gateway with FXO ports.",
    suggestedFix: "add:fxo_gateway",
  },
  {
    id: "P8",
    name: "Speaker → amp",
    severity: "hard",
    trigger: hasKind("passive_speaker"),
    requires: [
      {
        description: "an amplifier with a power stage",
        satisfiedBy: [itemWithKind("amplifier")],
      },
    ],
    message:
      "A passive speaker needs an amplifier to drive it. Add an amplifier with a power stage.",
    suggestedFix: "add:amplifier",
  },
  {
    id: "P9",
    name: "Pre-amp → amp + speaker",
    severity: "hard",
    trigger: hasKind("preamp"),
    requires: [
      { description: "a power amplifier", satisfiedBy: [itemWithKind("power_amp")] },
      { description: "a speaker", satisfiedBy: [itemWithKind("speaker")] },
    ],
    message:
      "A streamer / bare pre-amp has no power stage — it needs both a power amplifier and speakers.",
    suggestedFix: "add:power_amp",
  },
  {
    id: "P10",
    name: "PoE-only → source",
    severity: "hard",
    trigger: { op: "only", attr: "power_supply_mode", value: ["poe"] },
    requires: [
      {
        description: "a PoE switch or injector",
        satisfiedBy: [itemWithKind("poe_source")],
      },
    ],
    message:
      "This device is powered only by PoE and has no other power input — add a PoE switch or injector.",
    suggestedFix: "add:poe_source",
  },
  {
    id: "P11",
    name: "DC-only → PSU",
    severity: "hard",
    trigger: { op: "only", attr: "power_supply_mode", value: ["dc"] },
    requires: [
      {
        description: "a power supply, or a bundled-PSU choice",
        satisfiedBy: [itemWithKind("psu"), flag("psu_bundled")],
      },
    ],
    message:
      "This device needs external DC power. Add a power supply, or confirm its adapter is bundled.",
    suggestedFix: "add:psu",
  },
  {
    id: "P12",
    name: "Fibre → optics + patch",
    severity: "hard",
    trigger: hasKind("fibre_link"),
    requires: [
      { description: "SFP modules", satisfiedBy: [itemWithKind("sfp_module")] },
      { description: "fibre cable", satisfiedBy: [itemWithKind("fibre_cable")] },
    ],
    message:
      "A fibre link needs SFP modules on each end and the fibre cable itself. Add both.",
    suggestedFix: "add:sfp_module",
  },
  {
    id: "P13",
    name: "Wired → cabling",
    severity: "soft",
    trigger: hasKind("wired_device"),
    requires: [
      {
        description: "structured cabling",
        satisfiedBy: [itemWithKind("cabling"), flag("cabling_by_others")],
      },
    ],
    message:
      "Wired devices need structured cabling. Add a cabling line, or confirm cabling is by others.",
    suggestedFix: "add:cabling",
  },
  {
    id: "P14",
    name: "Access door → bundle",
    severity: "hard",
    trigger: hasKind("access_controller"),
    requires: [
      { description: "a reader", satisfiedBy: [itemWithKind("reader")] },
      { description: "a lock", satisfiedBy: [itemWithKind("lock")] },
      {
        description: "an exit device (or reader-as-exit)",
        satisfiedBy: [itemWithKind("exit_device"), flag("exit_by_reader")],
      },
      { description: "a power supply", satisfiedBy: [itemWithKind("psu")] },
    ],
    message:
      "A controlled door needs the full set: reader, lock, exit device, and a power supply.",
    suggestedFix: "add:reader",
  },
  {
    id: "P15",
    name: "Rack device → rack",
    severity: "hard",
    trigger: { op: "equals", attr: "rack_mount", value: true },
    requires: [
      { description: "a rack / enclosure", satisfiedBy: [itemWithKind("rack")] },
    ],
    message:
      "A rack-mount device needs a rack or enclosure to mount into. Add a rack.",
    suggestedFix: "add:rack",
  },
  {
    id: "P16",
    name: "Outdoor → housing",
    severity: "hard",
    trigger: {
      op: "all",
      value: [
        { op: "equals", attr: "used_outdoors", value: true },
        { op: "equals", attr: "outdoor_rated", value: false },
      ],
    },
    requires: [
      {
        description: "a weatherproof enclosure (≥ IP65)",
        satisfiedBy: [itemWithKind("weatherproof_housing")],
      },
    ],
    message:
      "An indoor-rated device used outdoors needs a weatherproof enclosure (IP65 or better).",
    suggestedFix: "add:weatherproof_housing",
  },
  {
    id: "P17",
    name: "Sealed enclosure → cooling",
    severity: "soft",
    trigger: {
      op: "all",
      value: [
        { op: "equals", attr: "solid_door", value: true },
        { op: "equals", attr: "active_gear", value: true },
      ],
    },
    requires: [
      {
        description: "cooling, or a cooling-provided choice",
        satisfiedBy: [itemWithKind("cooling"), flag("cooling_provided")],
      },
    ],
    message:
      "A solid-door enclosure with active gear needs cooling. Add a fan/AC kit, or confirm cooling is provided.",
    suggestedFix: "add:cooling",
  },
  {
    id: "P18",
    name: "UPS SNMP → card",
    severity: "soft",
    trigger: { op: "equals", attr: "ups_remote_monitoring", value: true },
    requires: [
      {
        description: "a UPS network / SNMP card",
        satisfiedBy: [itemWithKind("ups_snmp_card")],
      },
    ],
    message:
      "Remote UPS monitoring needs a network / SNMP card. Add the card for the UPS.",
    suggestedFix: "add:ups_snmp_card",
  },
];
