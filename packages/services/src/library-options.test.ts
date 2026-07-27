import { describe, expect, it } from "vitest";
import type { SpecOption } from "../../../db/types";
import { mergeOptions } from "./library-options";

// ---------------------------------------------------------------------------
// Option identity.
//
// An option's `value` is what a product stores and what a rule compares, so it
// has to be unique within the attribute and stable for the life of the option.
// It is DERIVED from the label as a convenience, and that derivation throws away
// everything that is not a letter or a digit — "PoE", "PoE+" and "PoE++" all
// reduce to "poe".
//
// Every test here is a way that collision used to lose an author's work.
// ---------------------------------------------------------------------------

const option = (
  value: string,
  label: string,
  rank: number | null = null,
  retired = false,
): SpecOption => ({ value, label, rank, retired });

describe("mergeOptions — deriving a value that is already taken", () => {
  it("keeps an option whose label collides with an existing one", () => {
    // The exact report: an attribute with "PoE", author adds "PoE+", saves, and
    // the new option is simply not there.
    const merged = mergeOptions(
      [option("poe", "PoE")],
      [
        { label: "PoE", value: "poe", rank: null },
        { label: "PoE+", rank: null },
      ],
      false,
    );
    expect(merged.map((entry) => entry.label)).toEqual(["PoE", "PoE+"]);
    // Distinct identities, so a product can hold one without meaning the other.
    expect(new Set(merged.map((entry) => entry.value)).size).toBe(2);
  });

  it("keeps three labels that all reduce to the same slug", () => {
    const merged = mergeOptions(
      [],
      [
        { label: "PoE", rank: null },
        { label: "PoE+", rank: null },
        { label: "PoE++", rank: null },
      ],
      false,
    );
    expect(merged.map((entry) => entry.label)).toEqual([
      "PoE",
      "PoE+",
      "PoE++",
    ]);
    expect(merged.map((entry) => entry.value)).toEqual([
      "poe",
      "poe-2",
      "poe-3",
    ]);
  });

  it("never lets a new option steal an existing option's value", () => {
    // The new one is listed FIRST, above the option that already owns "poe".
    // One pass in list order would hand "poe" to PoE+ — and every product
    // holding "poe" would silently start reading as PoE+.
    const merged = mergeOptions(
      [option("poe", "PoE")],
      [
        { label: "PoE+", rank: null },
        { label: "PoE", value: "poe", rank: null },
      ],
      false,
    );
    const poePlus = merged.find((entry) => entry.label === "PoE+");
    const poe = merged.find((entry) => entry.label === "PoE");
    expect(poe?.value).toBe("poe");
    expect(poePlus?.value).not.toBe("poe");
  });

  it("does not collide with a value that is only held by a retired option", () => {
    // A retired option still owns its value — products may still hold it.
    const merged = mergeOptions(
      [option("poe", "PoE", null, true)],
      [{ label: "PoE+", rank: null }],
      false,
    );
    expect(merged.find((entry) => entry.label === "PoE+")?.value).not.toBe(
      "poe",
    );
    // And the retired one is still there, still retired.
    expect(merged.find((entry) => entry.value === "poe")?.retired).toBe(true);
  });

  it("keeps an existing option's value when its label is edited", () => {
    // Renaming must never re-derive: the value is what products point at.
    const merged = mergeOptions(
      [option("poe", "PoE")],
      [{ label: "PoE Type A", value: "poe", rank: null }],
      false,
    );
    expect(merged[0]).toMatchObject({ value: "poe", label: "PoE Type A" });
  });

  it("still collapses the same existing option listed twice", () => {
    const merged = mergeOptions(
      [option("poe", "PoE")],
      [
        { label: "PoE", value: "poe", rank: null },
        { label: "PoE again", value: "poe", rank: null },
      ],
      false,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.label).toBe("PoE");
  });

  it("retires an option the author removed, rather than deleting it", () => {
    const merged = mergeOptions(
      [option("poe", "PoE"), option("poe-2", "PoE+")],
      [{ label: "PoE", value: "poe", rank: null }],
      false,
    );
    expect(merged.find((entry) => entry.value === "poe-2")).toMatchObject({
      retired: true,
      label: "PoE+",
    });
  });

  it("brings a retired option back with its identity intact", () => {
    const merged = mergeOptions(
      [option("poe-2", "PoE+", null, true)],
      [{ label: "PoE+", value: "poe-2", rank: null }],
      false,
    );
    expect(merged[0]).toMatchObject({ value: "poe-2", retired: false });
  });

  it("ranks an ordered scale by position when the author gave no rank", () => {
    const merged = mergeOptions(
      [],
      [
        { label: "802.3af", rank: null },
        { label: "802.3at", rank: null },
        { label: "802.3bt", rank: null },
      ],
      true,
    );
    expect(merged.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("gives a label with no letters or digits a value of its own", () => {
    // slugify("+++") is "", so both fall back — and the fallback must not
    // collide either.
    const merged = mergeOptions(
      [],
      [
        { label: "+++", rank: null },
        { label: "///", rank: null },
      ],
      false,
    );
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map((entry) => entry.value)).size).toBe(2);
  });
});
