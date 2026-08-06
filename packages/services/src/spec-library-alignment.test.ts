import { describe, expect, it } from "vitest";
import { measurementUnits } from "../../../db/enum";
import type { SpecGroupField, SpecOption } from "../../../db/types";
import { audienceAdmits } from "./assignment-resolver";
import {
  aliasConflicts,
  labelAliasConflicts,
  mergeOptions,
  normalizeLibraryKey,
  resolveAttributeByText,
  resolveOptionByText,
  type NameableAttribute,
} from "./library-options";
import {
  incompatiblePairs,
  indexCompatibility,
  isBrandApproved,
} from "./product-compatibility";
import {
  columnTotal,
  convert,
  groupRowIssues,
  unitFactor,
  type AttributeMeta,
} from "./spec-values";
import { variantSignature } from "./variant-identity";

// ---------------------------------------------------------------------------
// EVERYTHING THIS BRANCH ADDED, ON ONE PRODUCT.
//
// The per-feature files prove each piece in isolation. This one proves they
// compose, by walking a real Ajax product from a source sheet to a shopper's
// basket and asserting the whole chain — because every gap this branch closed
// was found at a JOIN between two pieces, not inside one:
//
//   the source writes `||` where the library says Class II          → aliases
//   the source writes "Sensitive element" where we say "Sensing"    → label aliases
//   the sheet quotes 25 mW, 36 s and 50 ppm                         → units
//   power draw is three numbers under three conditions              → group + distinct
//   RB and SB are one page and two products                         → variant identity
//   Superior is sold to installers only                             → product audience
//   the antenna fits six hubs and its datasheet says one            → exception list
//
// Nothing here touches a database. Every module below is pure on purpose — that
// is what lets the rules that decide what a stored value MEANS be checked without
// a connection, and it is why they live apart from the services that load them.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The library, built the way an importer would build it
// ---------------------------------------------------------------------------

// EN 50131 environmental class. Ajax renders the roman numerals as pipes on 68
// products — the single most common alias in the whole harvest.
const environmentalClass = mergeOptions(
  [],
  [
    { label: "Class I", rank: 1, aliases: ["|"] },
    { label: "Class II", rank: 2, aliases: ["||", "2"] },
    { label: "Class III", rank: 3, aliases: ["|||"] },
    { label: "Class IV", rank: 4, aliases: ["IV"] },
  ],
  true,
);

// The sub-Ghz bands, where the same value is written two spaces apart on 82
// products and 31.
const frequencyBand = mergeOptions(
  [],
  [{ label: "866.0–866.5 MHz", rank: null }],
  false,
);

const whenField: SpecGroupField = {
  key: "when",
  label: "When",
  kind: "select",
  unit: null,
  ordered: false,
  // The flag that stops two "maximum" rows being summed.
  distinct: true,
  options: mergeOptions(
    [],
    [
      { label: "12 V DC", rank: null, aliases: ["12V DC"] },
      { label: "PoE", rank: null },
      { label: "maximum", rank: null, aliases: ["max"] },
    ],
    false,
  ),
};

const wattsField: SpecGroupField = {
  key: "watts",
  label: "Watts",
  kind: "number",
  unit: "W",
  ordered: false,
  options: [],
};

const powerDraw: AttributeMeta = {
  uuid: "pwr-uuid",
  label: "Power draw",
  type: "group",
  unit: null,
  ordered: false,
  options: [],
  groupFields: [whenField, wattsField],
};

const library: NameableAttribute[] = [
  {
    uuid: "det-uuid",
    key: "det.sensing_elements",
    label: "Sensing elements",
    labelAliases: ["Sensitive element", "Sensitive elements"],
  },
  {
    uuid: "pwr-uuid",
    key: "pwr.power_draw_w",
    label: "Power draw",
    labelAliases: ["Power consumption", "12 V DC power consumption"],
  },
  {
    uuid: "comp-uuid",
    key: "comp.environmental_class",
    label: "Environmental class",
    labelAliases: null,
  },
];

// ---------------------------------------------------------------------------
// 1 — a source sheet lands on the attributes we already have
// ---------------------------------------------------------------------------

describe("reading a source sheet's column headings", () => {
  it("collapses the three-way label fork onto one attribute", () => {
    // 74 products say "Sensitive element", 41 say "Sensitive elements", 5 say
    // "Sensing element". One attribute, three headings.
    for (const heading of [
      "Sensitive element",
      "Sensitive elements",
      "Sensing elements",
    ]) {
      expect(resolveAttributeByText(heading, library)?.uuid).toBe("det-uuid");
    }
  });

  it("lands Ajax's four power-consumption headings on one attribute", () => {
    for (const heading of ["Power consumption", "12 V DC power consumption"]) {
      expect(resolveAttributeByText(heading, library)?.uuid).toBe("pwr-uuid");
    }
  });

  it("resolves by the dotted id a mapping file would use", () => {
    expect(resolveAttributeByText("pwr.power_draw_w", library)?.uuid).toBe(
      "pwr-uuid",
    );
  });

  it("queues an unrecognised heading instead of guessing", () => {
    // Null is the review queue, not a failure. §0.3: unknown values queue for
    // review, never auto-create.
    expect(resolveAttributeByText("Supported protocols", library)).toBeNull();
  });

  it("keeps every dotted id exactly as the document writes it", () => {
    for (const attribute of library) {
      expect(normalizeLibraryKey(attribute.key)).toEqual({
        ok: true,
        key: attribute.key,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// 2 — the values on that sheet land on the options we already have
// ---------------------------------------------------------------------------

describe("reading a source sheet's values", () => {
  it("reads the pipes as the roman numeral", () => {
    // The 68-product case. Without this the master list forks into six values
    // for four classes, and every rule keyed on one half stops matching.
    expect(resolveOptionByText("||", environmentalClass)?.label).toBe(
      "Class II",
    );
    expect(resolveOptionByText("|||", environmentalClass)?.label).toBe(
      "Class III",
    );
  });

  it("reads the bare grade digit the certificate block leaves behind", () => {
    // §4.5: the value sits two lines below the label, and it is a lone "2".
    expect(resolveOptionByText("2", environmentalClass)?.label).toBe("Class II");
  });

  it("sees one band through two spellings two spaces apart", () => {
    for (const written of [
      "866.0–866.5 MHz",
      "866.0 – 866.5 MHz",
      "866.0-866.5 MHz",
    ]) {
      expect(resolveOptionByText(written, frequencyBand)?.label).toBe(
        "866.0–866.5 MHz",
      );
    }
  });

  it("refuses to let the library hold an alias two options answer to", () => {
    // Checked at save time, so this state never reaches a resolver.
    expect(aliasConflicts(environmentalClass)).toEqual([]);

    const forked: SpecOption[] = [
      ...environmentalClass,
      { value: "cls-2-again", label: "Class 2", rank: 5, retired: false, aliases: ["||"] },
    ];
    expect(aliasConflicts(forked)).toHaveLength(1);
  });

  it("refuses two attributes claiming one source heading", () => {
    // §2.6: Ajax's "Resolution" is a camera's video resolution AND a keypad's
    // screen. Both claiming it means an import has to guess, and a shopper
    // filtering cameras is handed a keypad.
    const clash = labelAliasConflicts(
      {
        uuid: "av-video",
        key: "av.video_resolution",
        label: "Video resolution",
        labelAliases: ["Resolution"],
      },
      [
        {
          uuid: "av-display",
          key: "av.display_resolution",
          label: "Display resolution",
          labelAliases: ["Resolution"],
        },
      ],
    );
    expect(clash).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3 — the quantities on that sheet are writable at all
// ---------------------------------------------------------------------------

describe("the units the sheet quotes", () => {
  it("offers every one the library needs", () => {
    for (const unit of ["mW", "s", "ms", "ppm", "m²"]) {
      expect(measurementUnits).toContain(unit);
    }
  });

  it("keeps a polling interval and a detection speed comparable", () => {
    // 36 s against 300 ms. Before this branch neither was writable, and the
    // nearest available unit turned the interval into 0.6.
    expect(convert(36, "s", "ms")).toBe(36000);
    expect(unitFactor("h", "s")).toEqual({ ok: true, factor: 3600 });
  });

  it("keeps a CO threshold away from a percentage", () => {
    // Both look like dimensionless ratios and neither converts to the other.
    expect(unitFactor("ppm", "%").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4 — one fact under three conditions, and the arithmetic that depends on it
// ---------------------------------------------------------------------------

describe("power draw as one attribute with three cases", () => {
  const asAuthored = [
    { when: "12-v-dc", watts: 9 },
    { when: "poe", watts: 8.5 },
    { when: "maximum", watts: 12 },
  ];

  it("resolves each case heading the sheet writes", () => {
    // The sheet says "12V DC" and "max"; the list says "12 V DC" and "maximum".
    expect(resolveOptionByText("12V DC", whenField.options)?.value).toBe(
      "12-v-dc",
    );
    expect(resolveOptionByText("max", whenField.options)?.value).toBe("maximum");
  });

  it("accepts the sheet's three rows", () => {
    expect(groupRowIssues(asAuthored, powerDraw)).toEqual([]);
  });

  it("lets a rule read the case it needs", () => {
    // A power cascade uses full load, never idle — §2.3.
    const atMaximum = asAuthored.filter((row) => row.when === "maximum");
    expect(columnTotal(atMaximum, powerDraw, "watts")).toBe(12);
  });

  it("catches the case answered twice, before it doubles the number", () => {
    // The whole reason the discriminator exists. Both rows are well-formed, an
    // operand totals the column, and a 12 W camera measures 24 W with nothing
    // to trace it back to.
    const doubled = [...asAuthored, { when: "maximum", watts: 12 }];
    expect(columnTotal(doubled, powerDraw, "watts")).toBe(41.5);
    const issues = groupRowIssues(doubled, powerDraw);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ problem: "duplicate", value: "maximum" });
  });
});

// ---------------------------------------------------------------------------
// 5 — the same page is two products
// ---------------------------------------------------------------------------

describe("a variant family that used to collapse into one row", () => {
  // `FireProtect 2 RB (CO) UL Jeweller` and `FireProtect 2 SB (CO) Jeweller`
  // share a page and a slug. Keyed on the slug, one overwrote the other — which
  // is how 290 harvested products came back as 204.
  const rb = variantSignature(["rb", "co", "ul", "jeweller"]);
  const sb = variantSignature(["sb", "co", "jeweller"]);

  it("tells the two apart", () => {
    expect(rb).not.toBe(sb);
  });

  it("gives the same answer whichever order the variants were ticked", () => {
    expect(variantSignature(["jeweller", "ul", "co", "rb"])).toBe(rb);
  });

  it("keeps two variant-less products from colliding on a shared model", () => {
    // NULL, not "" — MySQL treats NULLs in a unique index as distinct, which is
    // what stops every un-varianted product being a duplicate of the others.
    expect(variantSignature([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6 — who may see it
// ---------------------------------------------------------------------------

describe("a trade-only product line", () => {
  it("hides Superior from a retail shopper and shows it to a partner", () => {
    expect(audienceAdmits("partner", "user")).toBe(false);
    expect(audienceAdmits("partner", "partner")).toBe(true);
  });

  it("treats everyone as the union, not as a rung above the two", () => {
    // A ladder would let a partner inherit every retail-only listing, which is
    // the opposite of what the field is for.
    expect(audienceAdmits("everyone", "user")).toBe(true);
    expect(audienceAdmits("everyone", "partner")).toBe(true);
    expect(audienceAdmits("user", "partner")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7 — the pairs no attribute explains
// ---------------------------------------------------------------------------

describe("the exception list beside the derived rules", () => {
  // The ExternalAntenna: its datasheet lists one hub and the matrix shows six,
  // and nothing about either hub records which mouldings the antenna fits.
  const index = indexCompatibility([
    {
      productUuidA: "external-antenna",
      productUuidB: "hub-bp",
      verdict: "compatible",
      note: null,
      source: "Ajax device compatibility PDF 2026-08-06",
    },
    {
      productUuidA: "external-antenna",
      productUuidB: "hub-2-plus",
      verdict: "incompatible",
      note: "The antenna does not fit this hub's casing.",
      source: "Ajax device compatibility PDF 2026-08-06",
    },
  ]);

  it("records the permission the derived rules would have refused", () => {
    expect(isBrandApproved(index, "external-antenna", "hub-bp")).toBe(true);
  });

  it("blocks the pair the manufacturer ruled out, with a reason", () => {
    const [finding] = incompatiblePairs(index, [
      "external-antenna",
      "hub-2-plus",
    ]);
    expect(finding?.note).toContain("casing");
    expect(finding?.source).toContain("Ajax");
  });

  it("says nothing about the 1,141 pairs it was never given", () => {
    // The property that keeps this an exception list rather than a whitelist.
    // Almost every Ajax pair is implied by `net.link_technology` already, and
    // silence here has to mean "no exception", never "incompatible".
    expect(
      incompatiblePairs(index, ["motionprotect-jeweller", "hub-2-2g"]),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8 — the whole chain, on one product
// ---------------------------------------------------------------------------

describe("one source row, end to end", () => {
  // Exactly what a spec page gives, in the spellings it gives them in.
  const sourceRow: Record<string, string> = {
    "Sensitive element": "1 × PIR sensor",
    "Power consumption": "max",
    "Environmental class": "||",
    "Radio communication range": "up to 5,550 ft",
  };

  it("resolves every heading and every value it can, and flags the rest", () => {
    const resolved: Record<string, string> = {};
    const queued: string[] = [];

    for (const [heading, raw] of Object.entries(sourceRow)) {
      const attribute = resolveAttributeByText(heading, library);
      if (!attribute) {
        queued.push(heading);
        continue;
      }
      resolved[attribute.key] = raw;
    }

    // Three of the four headings are ours; the fourth has no attribute yet and
    // goes to review rather than being dropped or guessed at.
    expect(Object.keys(resolved).sort()).toEqual([
      "comp.environmental_class",
      "det.sensing_elements",
      "pwr.power_draw_w",
    ]);
    expect(queued).toEqual(["Radio communication range"]);

    // And the value under the heading we care most about resolves too.
    expect(
      resolveOptionByText(
        resolved["comp.environmental_class"] ?? "",
        environmentalClass,
      )?.label,
    ).toBe("Class II");
  });

  it("produces a product that is distinguishable, visible and checkable", () => {
    const product = {
      model: "FireProtect 2",
      variantKey: variantSignature(["rb", "co", "ul", "jeweller"]),
      audience: "partner" as const,
      powerRows: [{ when: "maximum", watts: 12 }],
    };

    // Identity: its SB sibling is a different product.
    expect(product.variantKey).not.toBe(variantSignature(["sb", "co", "jeweller"]));
    // Visibility: trade-only, so a retail shopper never sees it.
    expect(audienceAdmits(product.audience, "user")).toBe(false);
    // Readability: the engine can total the case a budget rule asks for.
    expect(groupRowIssues(product.powerRows, powerDraw)).toEqual([]);
    expect(columnTotal(product.powerRows, powerDraw, "watts")).toBe(12);
  });
});
