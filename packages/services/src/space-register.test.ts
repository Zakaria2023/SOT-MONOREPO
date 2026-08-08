import { describe, expect, it } from "vitest";
import type { SelectSpaceItems } from "../../../db/schema/spaces";
import {
  checkItemIdentity,
  isIdentifiedDevice,
  summariseRegister,
} from "./space-register";

const identity = (over: Partial<Parameters<typeof checkItemIdentity>[0]> = {}) => ({
  quantity: 1,
  serial: null,
  firmwareVersion: null,
  macAddress: null,
  ...over,
});

// Only the fields the summary reads. Typed through the table's Select type so the
// day a column is renamed this stops compiling rather than quietly summing the
// wrong thing.
const item = (over: Partial<SelectSpaceItems> = {}): SelectSpaceItems =>
  ({
    quantity: 1,
    retiredAt: null,
    productUuid: "product",
    firmwareVersion: null,
    firmwareVerified: false,
    ...over,
  }) as SelectSpaceItems;

describe("a row is a batch or a device, never both", () => {
  it("accepts a counted batch with no per-device detail", () => {
    expect(checkItemIdentity(identity({ quantity: 20 })).ok).toBe(true);
  });

  it("accepts one device with its serial and firmware", () => {
    expect(
      checkItemIdentity(
        identity({ serial: "SN-1", firmwareVersion: "2.15.4" }),
      ).ok,
    ).toBe(true);
  });

  it("refuses a batch carrying a fact about one device", () => {
    // A register claiming one firmware version for five units can be right about
    // at most one of them, and a rule reading that value would judge the other
    // four on a number from somewhere else.
    for (const over of [
      { serial: "SN-1" },
      { firmwareVersion: "2.15.4" },
      { macAddress: "AA:BB:CC:DD:EE:FF" },
    ]) {
      const check = checkItemIdentity(identity({ quantity: 5, ...over }));
      expect(check.ok, JSON.stringify(over)).toBe(false);
    }
  });

  it("names what it objected to, and what to do instead", () => {
    const check = checkItemIdentity(
      identity({ quantity: 5, firmwareVersion: "2.15.4" }),
    );
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toContain("firmware version");
      expect(check.reason).toContain("separate items");
    }
  });

  it("ignores blank per-device fields rather than treating them as present", () => {
    // An empty string arrives from every form on earth. Reading it as "has a
    // serial" would refuse an ordinary batch.
    expect(
      checkItemIdentity(identity({ quantity: 5, serial: "  ", firmwareVersion: "" }))
        .ok,
    ).toBe(true);
  });

  it("refuses a quantity that is not a whole count", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(checkItemIdentity(identity({ quantity })).ok, `${quantity}`).toBe(
        false,
      );
    }
  });

  it("knows a device from a batch", () => {
    expect(isIdentifiedDevice(identity({ serial: "SN-1" }))).toBe(true);
    expect(isIdentifiedDevice(identity({ quantity: 20 }))).toBe(false);
    // One unit with nothing identifying it is still just a count of one.
    expect(isIdentifiedDevice(identity())).toBe(false);
  });
});

describe("what the register adds up to", () => {
  it("counts units, not rows", () => {
    // A batch of twenty detectors is twenty things in the building.
    const summary = summariseRegister([item({ quantity: 20 }), item()]);
    expect(summary.units).toBe(21);
    expect(summary.rows).toBe(2);
  });

  it("leaves retired items out of the live counts", () => {
    const summary = summariseRegister([
      item({ quantity: 3 }),
      item({ quantity: 5, retiredAt: new Date("2026-01-01") }),
    ]);
    expect(summary.units).toBe(3);
    expect(summary.retired).toBe(1);
  });

  it("surfaces rows whose product left the catalogue", () => {
    // Nothing about them can be checked any more, and a register that hides it
    // looks complete.
    expect(summariseRegister([item({ productUuid: null })]).orphaned).toBe(1);
  });

  it("separates declared firmware from verified firmware", () => {
    // The count that decides whether a firmware verdict can be trusted.
    const summary = summariseRegister([
      item({ firmwareVersion: "2.9", firmwareVerified: false }),
      item({ firmwareVersion: "2.16", firmwareVerified: true }),
      item(),
    ]);
    expect(summary.firmwareDeclared).toBe(1);
    expect(summary.firmwareVerified).toBe(1);
  });
});
