import { describe, expect, it } from "vitest";
import {
  includedParts,
  indexComposition,
  missingParts,
  requiresSeparateParts,
  type CompositionPart,
} from "./product-composition";

// ---------------------------------------------------------------------------
// WHAT IS IN THE BOX, AND WHAT IS NOT.
//
// §2.9's `sys.complete_set` — `[{item, qty, included}]` where `item` is another
// PRODUCT. That is why it could not be a specification attribute: a spec value is
// a number, a pick, or a row of those, and none of them is a foreign key.
//
// The cases are the ones the document names: DoubleButton needs its Holder,
// GlandBox needs its red glands, the EN54 CIE needs an Internal Battery. Each is
// a product that arrives and does not work.
// ---------------------------------------------------------------------------

const part = (
  parentUuid: string,
  childUuid: string,
  childName: string,
  overrides: Partial<CompositionPart> = {},
): CompositionPart => ({
  parentUuid,
  childUuid,
  childName,
  quantity: 1,
  included: true,
  note: null,
  ...overrides,
});

describe("sys.accessory_completeness, derived rather than stored", () => {
  const index = indexComposition([
    part("doublebutton", "holder", "Holder", {
      included: false,
      note: "The Holder is what fixes the button to a wall.",
    }),
    part("starterkit", "hub2", "Hub 2"),
    part("starterkit", "motionprotect", "MotionProtect", { quantity: 3 }),
  ]);

  it("says a product needing a separately-sold part needs one", () => {
    expect(requiresSeparateParts(index, "doublebutton")).toBe(true);
  });

  it("says a bundle whose contents are all in the box does not", () => {
    expect(requiresSeparateParts(index, "starterkit")).toBe(false);
  });

  it("says a product with no composition at all does not", () => {
    // Complete for a different reason, and the buyer does not need the two told
    // apart.
    expect(requiresSeparateParts(index, "motionprotect")).toBe(false);
  });

  it("lists what a bundle actually contains", () => {
    const contents = includedParts(index, "starterkit");
    expect(contents.map((entry) => entry.childName).sort()).toEqual([
      "Hub 2",
      "MotionProtect",
    ]);
    expect(contents.find((entry) => entry.childName === "MotionProtect")?.quantity).toBe(3);
  });
});

describe("what a basket is short of", () => {
  const index = indexComposition([
    part("doublebutton", "holder", "Holder", { included: false }),
    part("en54-cie", "battery-24h", "EN54 Internal Battery (24h)", {
      included: false,
    }),
    part("starterkit", "hub2", "Hub 2"),
  ]);

  it("names the part when it is absent", () => {
    const missing = missingParts(index, [
      { productUuid: "doublebutton", quantity: 1 },
    ]);
    expect(missing).toEqual([
      {
        parentUuid: "doublebutton",
        childUuid: "holder",
        childName: "Holder",
        shortBy: 1,
        note: null,
      },
    ]);
  });

  it("says nothing when the part is in the basket", () => {
    expect(
      missingParts(index, [
        { productUuid: "doublebutton", quantity: 1 },
        { productUuid: "holder", quantity: 1 },
      ]),
    ).toEqual([]);
  });

  it("counts units, not presence", () => {
    // Two buttons need two holders. A presence-only check waves the second one
    // through, which is the same failure as a presence rule with no
    // per-trigger quantity — and it looks exactly like a passing check.
    const missing = missingParts(index, [
      { productUuid: "doublebutton", quantity: 2 },
      { productUuid: "holder", quantity: 1 },
    ]);
    expect(missing[0]?.shortBy).toBe(1);
  });

  it("never asks a buyer to add what is already in the box", () => {
    // Demanding a StarterKit's own hub be added separately would ask them to buy
    // it twice and then block them for not having.
    expect(
      missingParts(index, [{ productUuid: "starterkit", quantity: 1 }]),
    ).toEqual([]);
  });

  it("treats one product on two lines as one product", () => {
    // A basket holding the same product twice is holding it twice, not holding
    // two different products — reported per line, this would both duplicate the
    // finding and check each line against the full stock as if the other did not
    // exist.
    const missing = missingParts(index, [
      { productUuid: "doublebutton", quantity: 1 },
      { productUuid: "doublebutton", quantity: 1 },
      { productUuid: "holder", quantity: 2 },
    ]);
    expect(missing).toEqual([]);
  });

  it("reports several short parts across several products", () => {
    const missing = missingParts(index, [
      { productUuid: "doublebutton", quantity: 1 },
      { productUuid: "en54-cie", quantity: 1 },
    ]);
    expect(missing).toHaveLength(2);
  });

  it("stays quiet for a basket that needs nothing", () => {
    expect(
      missingParts(index, [{ productUuid: "some-camera", quantity: 4 }]),
    ).toEqual([]);
  });
});
