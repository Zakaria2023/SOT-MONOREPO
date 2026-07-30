import { describe, expect, it } from "vitest";
import type { SpecOption } from "../../../db/types";
import {
  looksLikeSameOption,
  mergeOptions,
  similarOptions,
} from "./library-options";

// ---------------------------------------------------------------------------
// THE SECOND SPELLING.
//
// `mergeOptions` guards value identity: two options can never end up sharing the
// string a product stores. That is the mechanical collision and it was solved.
//
// This is the semantic one, and it is the one that actually happens. An author who
// cannot find "802.3at" adds "PoE+ (802.3at)". Both are valid, both survive, and
// from then on every rule keyed on the first quietly stops matching the products
// holding the second — which looks exactly like a rule nothing violated.
//
// Nothing here refuses. There is no way to be certain two labels mean the same
// thing, so the job is to SURFACE it and let the author decide — the same call the
// model already makes for a value outside a category's slice.
// ---------------------------------------------------------------------------

const option = (value: string, label: string, retired = false): SpecOption => ({
  value,
  label,
  rank: null,
  retired,
});

describe("looksLikeSameOption", () => {
  it("catches the real case: a standard wrapped in a friendly name", () => {
    expect(looksLikeSameOption("PoE+ (802.3at)", "802.3at")).toBe(true);
    expect(looksLikeSameOption("802.3at", "PoE+ (802.3at)")).toBe(true);
  });

  it("ignores punctuation and spacing entirely", () => {
    expect(looksLikeSameOption("802.3at", "802-3AT")).toBe(true);
    expect(looksLikeSameOption("802.3at", "802 3 at")).toBe(true);
  });

  it("keeps two genuinely different standards apart", () => {
    // THE case that rules out edit distance. These differ by one character and
    // are different standards; "802.3at" and "PoE+ (802.3at)" differ by eleven and
    // are the same thing. Edit distance rates both backwards, and being wrong in
    // that direction merges two real values.
    expect(looksLikeSameOption("802.3at", "802.3af")).toBe(false);
    expect(looksLikeSameOption("802.3at", "802.3bt")).toBe(false);
  });

  it("does not let a very short label match everything", () => {
    // "at" is a substring of "802.3at" and means nothing of the sort.
    expect(looksLikeSameOption("at", "802.3at")).toBe(false);
    expect(looksLikeSameOption("A", "802.3at")).toBe(false);
  });

  it("catches a spelled-out unit against its short form", () => {
    expect(looksLikeSameOption("10 Gbps", "10Gbps")).toBe(true);
    expect(looksLikeSameOption("Fibre", "Fiber")).toBe(false);
  });
});

describe("similarOptions", () => {
  const existing = [
    option("af", "802.3af"),
    option("at", "802.3at"),
    option("bt", "802.3bt"),
  ];

  it("names what the new label might be a second name for", () => {
    expect(similarOptions("PoE+ (802.3at)", existing)).toEqual([
      option("at", "802.3at"),
    ]);
  });

  it("finds nothing for a genuinely new value", () => {
    expect(similarOptions("Passive 24V", existing)).toEqual([]);
  });

  it("includes a RETIRED option", () => {
    // The worst version of this mistake. A retired option still owns its value and
    // products still hold it, so re-adding it under a new name leaves the catalog
    // with two live spellings and the older products falling out of every rule.
    const withRetired = [...existing, option("passive", "Passive PoE", true)];
    expect(similarOptions("Passive PoE 24V", withRetired)).toHaveLength(1);
  });
});

describe("mergeOptions still owns value identity", () => {
  it("does not let a near-duplicate steal an existing option's value", () => {
    // The two guards are independent, and this is why both are needed: the labels
    // are near-duplicates AND both derive to "8023at". `mergeOptions` keeps the
    // stored one, so products holding "8023at" keep meaning what they meant.
    const merged = mergeOptions(
      [option("8023at", "802.3at")],
      [
        { value: "8023at", label: "802.3at", rank: null },
        { label: "802.3AT", rank: null },
      ],
      false,
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]?.value).toBe("8023at");
    expect(merged[1]?.value).not.toBe("8023at");
  });
});
