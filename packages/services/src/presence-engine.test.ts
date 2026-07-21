import { describe, expect, it } from "vitest";
import {
  evaluatePresence,
  gateDecision,
  type PresenceBoq,
  type PresenceItem,
} from "./presence-engine";
import { PRESENCE_RULES } from "./presence-rules-data";

const item = (
  name: string,
  attributes: PresenceItem["attributes"],
  quantity = 1,
): PresenceItem => ({ name, quantity, attributes });

const boq = (
  items: PresenceItem[],
  choices: Record<string, boolean> = {},
): PresenceBoq => ({ items, choices });

const poeCamera = (name: string): PresenceItem =>
  item(name, {
    kind: ["camera", "poe_camera", "wired_device"],
    power_supply_mode: ["poe"],
  });

const ids = (findings: { ruleId: string }[]): string[] =>
  findings.map((finding) => finding.ruleId).sort();

// Mirrors the brief's §6 — the same four BOQs, asserting the same findings.
describe("evaluatePresence — worked examples (§6)", () => {
  it("BOQ A: PoE cameras + PoE switch + rack, no recorder / no cabling", () => {
    const findings = evaluatePresence(
      boq([
        poeCamera("Camera 1"),
        poeCamera("Camera 2"),
        poeCamera("Camera 3"),
        poeCamera("Camera 4"),
        item("PoE switch", {
          kind: ["poe_source", "wired_device"],
          rack_mount: true,
        }),
        item("Rack", { kind: ["rack"] }),
      ]),
      PRESENCE_RULES,
    );

    // P3 (no recorder) is HARD; P13 (no cabling) is soft. P4 does NOT fire —
    // the switch supplies PoE — and P15 passes because the rack is present.
    expect(ids(findings)).toEqual(["P13", "P3"]);

    const p3 = findings.find((finding) => finding.ruleId === "P3");
    const p13 = findings.find((finding) => finding.ruleId === "P13");
    expect(p3?.severity).toBe("hard");
    expect(p3?.triggeredCount).toBe(4); // the 4 cameras
    expect(p13?.severity).toBe("soft");
    expect(p13?.triggeredCount).toBe(5); // 4 cameras + the switch

    const gate = gateDecision(findings);
    expect(gate.blocked).toBe(true);
    expect(gate.hard.map((finding) => finding.ruleId)).toEqual(["P3"]);
  });

  it("BOQ B: same cameras + NVR with PoE ports + rack + cabling → complete", () => {
    const findings = evaluatePresence(
      boq([
        poeCamera("Camera 1"),
        poeCamera("Camera 2"),
        poeCamera("Camera 3"),
        poeCamera("Camera 4"),
        item("NVR (8 PoE)", {
          kind: ["recorder", "poe_source", "wired_device"],
          rack_mount: true,
        }),
        item("Rack", { kind: ["rack"] }),
        item("Cabling", { kind: ["cabling"] }),
      ]),
      PRESENCE_RULES,
    );

    expect(findings).toEqual([]);
    expect(gateDecision(findings).blocked).toBe(false);
  });

  it("BOQ C: cameras + switch with cloud_recording + cabling_by_others → complete", () => {
    const findings = evaluatePresence(
      boq(
        [
          poeCamera("Camera 1"),
          poeCamera("Camera 2"),
          item("PoE switch", { kind: ["poe_source", "wired_device"] }),
        ],
        { cloud_recording: true, cabling_by_others: true },
      ),
      PRESENCE_RULES,
    );

    // No recorder and no cabling item, yet complete — the project choices
    // satisfy P3 and P13 through the escape hatches.
    expect(findings).toEqual([]);
    expect(gateDecision(findings).blocked).toBe(false);
  });

  it("BOQ D: orphaned passive speaker + SIP phone", () => {
    const findings = evaluatePresence(
      boq([
        item("Passive speaker", { kind: ["passive_speaker"] }),
        item("SIP phone", { kind: ["sip_phone", "wired_device"] }),
      ]),
      PRESENCE_RULES,
    );

    expect(ids(findings)).toEqual(["P13", "P5", "P8"]);
    const gate = gateDecision(findings);
    expect(gate.blocked).toBe(true);
    expect(gate.hard.map((finding) => finding.ruleId).sort()).toEqual([
      "P5",
      "P8",
    ]);
    expect(gate.soft.map((finding) => finding.ruleId)).toEqual(["P13"]);
  });
});

describe("evaluatePresence — mechanics", () => {
  it("does not fire when no trigger matches", () => {
    const findings = evaluatePresence(
      boq([item("Rack", { kind: ["rack"] })]),
      PRESENCE_RULES,
    );
    expect(findings).toEqual([]);
  });

  it("a project choice can activate a trigger (P7 PSTN → FXO)", () => {
    const findings = evaluatePresence(
      boq([item("Analog line card", { kind: ["misc"] })], {
        uses_pstn_lines: true,
      }),
      PRESENCE_RULES,
    );
    expect(ids(findings)).toContain("P7");
  });
});
