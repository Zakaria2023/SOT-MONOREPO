import type { SelectSpaceItems } from "../../../db/schema/spaces";

// ---------------------------------------------------------------------------
// THE RULES OF THE REGISTER.
//
// A Space's item list has to answer two different questions with one table: "how
// many smoke detectors are in this building" and "which unit is the one that keeps
// failing". Those pull in opposite directions, and the spec's schema — `qty INT
// NOT NULL DEFAULT 1` sitting beside `serial` and `firmware_version` — lets a row
// try to do both and mean neither.
//
// A row reading five units at one serial number is not a record of anything. So
// the rule is drawn here rather than copied into each caller: a row is either a
// COUNTED BATCH of interchangeable units, or ONE IDENTIFIED DEVICE. Never both.
//
// Pure, because the interesting part is the rule and not the write.
// ---------------------------------------------------------------------------

export type ItemIdentity = {
  quantity: number;
  serial: string | null;
  firmwareVersion: string | null;
  macAddress: string | null;
};

export type IdentityCheck =
  | { ok: true }
  | { ok: false; reason: string };

const named = (facts: ItemIdentity): string[] => {
  const fields: string[] = [];
  if (facts.serial?.trim()) {
    fields.push("a serial number");
  }
  if (facts.macAddress?.trim()) {
    fields.push("a MAC address");
  }
  if (facts.firmwareVersion?.trim()) {
    fields.push("a firmware version");
  }
  return fields;
};

/**
 * Whether this row is coherent.
 *
 * A serial, a MAC and a firmware version are all facts about ONE device. Carrying
 * any of them commits the row to being one device, because the alternative is a
 * register that appears to know a firmware version for five units and can only be
 * right about at most one of them — and a rule reading that value would then be
 * judging four devices on a number that came from somewhere else.
 */
export const checkItemIdentity = (facts: ItemIdentity): IdentityCheck => {
  if (!Number.isInteger(facts.quantity) || facts.quantity < 1) {
    return { ok: false, reason: "An item needs a whole quantity of at least 1." };
  }

  const perDevice = named(facts);
  if (facts.quantity > 1 && perDevice.length > 0) {
    return {
      ok: false,
      reason: `This row records ${facts.quantity} units and also ${perDevice.join(
        " and ",
      )}, which describes a single device. Record them as separate items, or drop the per-device detail and keep the count.`,
    };
  }

  return { ok: true };
};

/** True when this row stands for one identified device rather than a batch. */
export const isIdentifiedDevice = (facts: ItemIdentity): boolean =>
  facts.quantity === 1 && named(facts).length > 0;

export type RegisterSummary = {
  // Units, not rows. A batch of twenty detectors is twenty things in the
  // building, and a count of rows would say one.
  units: number;
  rows: number;
  // Rows whose product left the catalogue. Worth surfacing: nothing about them
  // can be checked any more, and a register that hides it looks complete.
  orphaned: number;
  // Firmware nobody has verified, which is the count that decides whether a
  // firmware-dependent verdict can be trusted.
  firmwareDeclared: number;
  firmwareVerified: number;
  retired: number;
};

/** What the register adds up to. */
export const summariseRegister = (
  items: SelectSpaceItems[],
): RegisterSummary => {
  const live = items.filter((item) => item.retiredAt === null);

  return {
    units: live.reduce((sum, item) => sum + item.quantity, 0),
    rows: live.length,
    orphaned: live.filter((item) => item.productUuid === null).length,
    firmwareDeclared: live.filter(
      (item) => item.firmwareVersion !== null && !item.firmwareVerified,
    ).length,
    firmwareVerified: live.filter((item) => item.firmwareVerified).length,
    retired: items.length - live.length,
  };
};
