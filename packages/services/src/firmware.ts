// ---------------------------------------------------------------------------
// FIRMWARE VERSIONS, AND WHY A CHECK ON ONE CANNOT BLOCK.
//
// `docs/specification-conventions.md` §8 rules `net.min_firmware_version` out of
// phase 1 and names exactly two things that were missing. This file is both.
//
//   1. THERE WAS NO COMPARATOR. `2.15.4` is not a number, and the string
//      comparison the engine would otherwise fall back on ranks `2.9` above
//      `2.15` — so a rule requiring 2.15.4 or later would have PASSED a device on
//      2.9 and failed one on 2.100. A check that is wrong in the direction of
//      approval is worse than no check.
//
//   2. THE FACT BELONGS TO AN INSTALLED DEVICE. Nothing in a BOQ line carries a
//      firmware version, because a line is a product somebody intends to buy and
//      firmware is a property of a unit already on a wall. The Space object is
//      what finally carries it, per item.
//
// AND SOT CANNOT VERIFY IT. Nobody here can read the firmware off a panel in a
// building three cities away. The number came from a person typing what they
// believed, which is why `SpaceItems.firmwareVerified` defaults to false and why
// this file's central rule is that an UNVERIFIED version can only ever produce a
// warning.
//
// That is not caution for its own sake. A rule that silently trusts a
// self-declared number looks like verification and is not, and a fire system
// signed off on that basis has been approved by nobody. Better to say "we believe
// this is 2.9, which is too old, but we have not checked" than to either block on
// hearsay or stay quiet.
//
// All pure. The comparator is the day's work §8 predicted; the honest declaration
// of where the number came from is the actual feature.
// ---------------------------------------------------------------------------

export type FirmwareOutcome =
  // Checked, and the device is new enough.
  | "pass"
  // Too old, and the version was verified. This one may gate.
  | "block"
  // Too old, but nobody verified the version. Never gates — see above.
  | "warn"
  // Could not be compared: no version declared, or one nobody can parse.
  | "unknown";

export type FirmwareAssessment = {
  outcome: FirmwareOutcome;
  // One sentence with both numbers in it. "Firmware too old" sends somebody to
  // find out which version they have and which they need; this says both.
  message: string;
};

export type ParsedVersion = {
  parts: number[];
  // Anything after the numbers — "2.15.4-beta" keeps `beta`. Recorded so it can
  // be shown, never used to rank: pre-release ordering is a convention this
  // codebase has no need to adopt and adopting it silently would be a guess.
  suffix: string | null;
};

/**
 * Parse a dotted version into comparable parts.
 *
 * Returns null for anything that is not at least one number, which is how "I do
 * not know" stays distinguishable from "it is old". A blank string, a word, a
 * date somebody typed into the wrong box — all null, all `unknown` downstream.
 */
export const parseVersion = (raw: string | null): ParsedVersion | null => {
  if (raw === null) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  // A leading `v` is how half the world writes a version and carries no meaning.
  const withoutPrefix = trimmed.replace(/^[vV]/, "");

  // Split the numeric head from whatever trails it. `2.15.4-beta` → `2.15.4` and
  // `beta`; `OS Malevich 2.15.4` fails here rather than guessing, because a
  // product name in the field means nobody was asked for a version and pretending
  // to read one out of it would invent data.
  const match = withoutPrefix.match(/^(\d+(?:\.\d+)*)(.*)$/);
  if (!match) {
    return null;
  }

  const parts = match[1].split(".").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const suffix = match[2].replace(/^[-_.+\s]+/, "").trim();
  return { parts, suffix: suffix === "" ? null : suffix };
};

/**
 * Compare two versions numerically, part by part.
 *
 * Returns a negative number when `a` is older, 0 when they are equal, positive
 * when `a` is newer. Null when either is unparseable — an unanswerable comparison
 * must not come back as a number, because every number here means something.
 *
 * A MISSING PART COUNTS AS ZERO, so `3.42` and `3.42.0` are the same release.
 * They are the same release. Treating the shorter string as smaller would fail a
 * device for having a tidier version number than the rule was written with.
 */
export const compareVersions = (
  a: string | null,
  b: string | null,
): number | null => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    return null;
  }

  const length = Math.max(left.parts.length, right.parts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left.parts[index] ?? 0) - (right.parts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  // Equal numerically. The suffix is deliberately not consulted: ranking `beta`
  // against a release means adopting a pre-release convention, and guessing at
  // one would put a device on the wrong side of a fire-safety rule.
  return 0;
};

/** Whether `declared` is at least `required`. Null when either cannot be read. */
export const meetsMinimum = (
  declared: string | null,
  required: string | null,
): boolean | null => {
  const comparison = compareVersions(declared, required);
  return comparison === null ? null : comparison >= 0;
};

export type FirmwareFacts = {
  // What somebody told us is on the device.
  declared: string | null;
  // Whether anybody checked. False is the honest default.
  verified: boolean;
  // What the rule wants.
  required: string | null;
  // For the sentence.
  deviceName: string;
};

/**
 * What a firmware-dependent check may conclude.
 *
 * The whole point is the third branch. An unverified version that falls short
 * produces a WARNING and never a block, however far short it falls — because the
 * only evidence is somebody's word, and gating a customer's system on hearsay is
 * a different failure from letting it through with a note.
 */
export const assessFirmware = ({
  declared,
  verified,
  required,
  deviceName,
}: FirmwareFacts): FirmwareAssessment => {
  if (required === null || parseVersion(required) === null) {
    // The RULE is unreadable, not the device. Distinguished in the message
    // because one of these is the customer's problem and the other is ours.
    return {
      outcome: "unknown",
      message: `The firmware requirement for ${deviceName} could not be read, so it was not checked.`,
    };
  }

  if (declared === null || declared.trim() === "") {
    return {
      outcome: "unknown",
      message: `${deviceName} needs firmware ${required} or later. Nobody has recorded which version it is running, so this was not checked.`,
    };
  }

  const satisfied = meetsMinimum(declared, required);
  if (satisfied === null) {
    return {
      outcome: "unknown",
      message: `${deviceName} is recorded as running "${declared}", which is not a version number this can compare against ${required}.`,
    };
  }

  if (satisfied) {
    // Nothing to report either way. An unverified version that is new ENOUGH
    // raises no warning: there is no problem to warn about, and warning anyway
    // would train people to ignore the warnings that matter.
    return {
      outcome: "pass",
      message: `${deviceName} is running ${declared}, which meets the ${required} minimum.`,
    };
  }

  if (!verified) {
    return {
      outcome: "warn",
      message: `${deviceName} is recorded as running ${declared}, below the ${required} minimum — but that version was self-declared and SOT has not verified it. Check the device before relying on this.`,
    };
  }

  return {
    outcome: "block",
    message: `${deviceName} is running ${declared}, below the ${required} minimum this requires.`,
  };
};
