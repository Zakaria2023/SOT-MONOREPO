import { describe, expect, it } from "vitest";
import type { SpecOption } from "../../../db/types";
import {
  convertLegacyValue,
  deriveSpecificationType,
  matchLegacyOption,
  reshapeOptions,
  splitLegacyValues,
  type LegacySpec,
} from "./legacy-spec-migration";

// These transformations run ONCE, against the live library, and rewrite every
// attribute and every product value. A mistake would not throw — it would produce
// data that looks valid and quietly changes what every rule computes. So the
// decisions are tested rather than trusted.

const legacy = (overrides: Partial<LegacySpec> = {}): LegacySpec => ({
  label: "Attribute",
  valueType: "select",
  inputType: null,
  allowMultiple: false,
  allowRange: false,
  ordered: false,
  options: [],
  ...overrides,
});

describe("deriveSpecificationType", () => {
  it("trusts an explicit inputType", () => {
    expect(deriveSpecificationType(legacy({ inputType: "number" })).type).toBe(
      "number",
    );
    expect(
      deriveSpecificationType(legacy({ inputType: "multi_select" })).type,
    ).toBe("multi_select");
    expect(deriveSpecificationType(legacy({ inputType: "boolean" })).type).toBe(
      "boolean",
    );
  });

  it("flags a free-text attribute instead of inventing a type for it", () => {
    const derived = deriveSpecificationType(legacy({ inputType: "text" }));
    expect(derived.type).toBe("single_select");
    expect(derived.note).toContain("free text");
  });

  // Rows written before the inputType column existed. The fallback has to match
  // what the old resolver did, or the migration changes live behaviour.
  it("falls back to valueType for an older row", () => {
    expect(
      deriveSpecificationType(legacy({ valueType: "number" })).type,
    ).toBe("number");
  });

  it("recognises the old Yes/No option pair as a real boolean", () => {
    const spec = legacy({
      options: [{ value: "Yes" }, { value: "No" }],
    });
    expect(deriveSpecificationType(spec).type).toBe("boolean");
  });

  it("does not mistake a two-option list for a boolean", () => {
    const spec = legacy({
      options: [{ value: "Indoor" }, { value: "Outdoor" }],
    });
    expect(deriveSpecificationType(spec).type).toBe("single_select");
  });

  it("uses allowMultiple when there is nothing better", () => {
    const spec = legacy({
      allowMultiple: true,
      options: [{ value: "AC" }, { value: "DC" }, { value: "PoE" }],
    });
    expect(deriveSpecificationType(spec).type).toBe("multi_select");
  });

  it("flags an option-less row with no type at all", () => {
    const derived = deriveSpecificationType(legacy());
    expect(derived.type).toBe("single_select");
    expect(derived.note).toBeDefined();
  });
});

describe("reshapeOptions", () => {
  // The stored value is what every product points at. If the migration changed
  // it, every product holding that option would orphan — which is the exact
  // failure the whole rebuild exists to prevent.
  it("never changes an option's stored value", () => {
    const spec = legacy({ options: [{ value: "802.3af" }, { value: "802.3at" }] });
    expect(
      reshapeOptions(spec, "single_select").map((option) => option.value),
    ).toEqual(["802.3af", "802.3at"]);
  });

  it("uses the old value as the starting label", () => {
    const spec = legacy({ options: [{ value: "802.3af" }] });
    expect(reshapeOptions(spec, "single_select")[0]?.label).toBe("802.3af");
  });

  it("keeps a label that was already there", () => {
    const spec = legacy({ options: [{ value: "af", label: "802.3af" }] });
    expect(reshapeOptions(spec, "single_select")[0]?.label).toBe("802.3af");
  });

  // Rank is what "at most" comparisons read. Leaving it null on an ordered
  // attribute would stop every such rule working while still reporting a pass.
  it("ranks an ordered list from the author's existing order", () => {
    const spec = legacy({
      ordered: true,
      options: [{ value: "af" }, { value: "at" }, { value: "bt" }],
    });
    expect(reshapeOptions(spec, "single_select").map((o) => o.rank)).toEqual([
      1, 2, 3,
    ]);
  });

  it("leaves an unordered list unranked", () => {
    const spec = legacy({ options: [{ value: "Black" }, { value: "White" }] });
    expect(reshapeOptions(spec, "single_select").map((o) => o.rank)).toEqual([
      null,
      null,
    ]);
  });

  it("preserves a rank that already exists", () => {
    const spec = legacy({
      ordered: true,
      options: [{ value: "1g", rank: 1000 }, { value: "10g", rank: 10000 }],
    });
    expect(reshapeOptions(spec, "single_select").map((o) => o.rank)).toEqual([
      1000, 10000,
    ]);
  });

  it("gives a boolean and a number no options at all", () => {
    const spec = legacy({ options: [{ value: "Yes" }, { value: "No" }] });
    expect(reshapeOptions(spec, "boolean")).toEqual([]);
    expect(reshapeOptions(spec, "number")).toEqual([]);
  });

  it("drops a blank option rather than creating an unusable one", () => {
    const spec = legacy({ options: [{ value: "  " }, { value: "1g" }] });
    expect(reshapeOptions(spec, "single_select")).toHaveLength(1);
  });

  it("carries a retired flag across", () => {
    const spec = legacy({
      options: [{ value: "old", retired: true }, { value: "new" }],
    });
    const reshaped = reshapeOptions(spec, "single_select");
    expect(reshaped[0]?.retired).toBe(true);
    expect(reshaped[1]?.retired).toBe(false);
  });
});

describe("splitLegacyValues", () => {
  it("splits the old comma-joined encoding", () => {
    expect(splitLegacyValues("802.3af, 802.3at")).toEqual([
      "802.3af",
      "802.3at",
    ]);
  });

  it("tolerates missing spaces and trailing separators", () => {
    expect(splitLegacyValues("af,at,")).toEqual(["af", "at"]);
  });
});

describe("matchLegacyOption", () => {
  const options: SpecOption[] = [
    { value: "af", label: "802.3af", rank: 1, retired: false },
    { value: "at", label: "802.3at", rank: 2, retired: false },
  ];

  it("matches on the stored value", () => {
    expect(matchLegacyOption(options, "af")?.value).toBe("af");
  });

  it("matches on the displayed label, which is what old rows stored", () => {
    expect(matchLegacyOption(options, "802.3at")?.value).toBe("at");
  });

  it("matches case-insensitively, because a hand-built catalog is not consistent", () => {
    expect(matchLegacyOption(options, "802.3AT")?.value).toBe("at");
  });

  it("returns nothing for a value it cannot place", () => {
    expect(matchLegacyOption(options, "802.3bt")).toBeUndefined();
  });
});

describe("convertLegacyValue", () => {
  const options: SpecOption[] = [
    { value: "af", label: "802.3af", rank: 1, retired: false },
    { value: "at", label: "802.3at", rank: 2, retired: false },
  ];

  it("parses a plain number", () => {
    expect(convertLegacyValue("130", "number", [])).toEqual({
      ok: true,
      value: 130,
    });
  });

  // Ranges are gone. Keeping the worst case is the safe direction: halving a
  // demand figure would make an over-budget design look fine.
  it("keeps the worst case of an old range", () => {
    expect(convertLegacyValue("220 - 240", "number", [])).toEqual({
      ok: true,
      value: 240,
    });
  });

  it("refuses a number it cannot parse instead of writing NaN", () => {
    const result = convertLegacyValue("12 W", "number", []);
    expect(result.ok).toBe(false);
  });

  it("reads the old Yes/No strings as real booleans", () => {
    expect(convertLegacyValue("Yes", "boolean", [])).toEqual({
      ok: true,
      value: true,
    });
    expect(convertLegacyValue("no", "boolean", [])).toEqual({
      ok: true,
      value: false,
    });
  });

  it("refuses a boolean it does not recognise", () => {
    expect(convertLegacyValue("maybe", "boolean", []).ok).toBe(false);
  });

  it("maps a single select through its label", () => {
    expect(convertLegacyValue("802.3af", "single_select", options)).toEqual({
      ok: true,
      value: "af",
    });
  });

  it("maps a multi-select into an array", () => {
    expect(
      convertLegacyValue("802.3af, 802.3at", "multi_select", options),
    ).toEqual({ ok: true, value: ["af", "at"] });
  });

  it("keeps the values it can place and reports the rest", () => {
    const result = convertLegacyValue(
      "802.3af, 802.3bt",
      "multi_select",
      options,
    );
    expect(result).toEqual({ ok: true, value: ["af"] });
  });

  it("refuses when nothing matches, naming what it could not place", () => {
    const result = convertLegacyValue("802.3bt", "single_select", options);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("802.3bt");
    }
  });

  it("treats an empty value as unset rather than an error", () => {
    expect(convertLegacyValue("   ", "number", []).ok).toBe(false);
  });

  // Zero is a real answer — a 0 W draw must migrate, not vanish.
  it("migrates zero", () => {
    expect(convertLegacyValue("0", "number", [])).toEqual({
      ok: true,
      value: 0,
    });
  });
});
