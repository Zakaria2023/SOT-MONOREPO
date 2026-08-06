import { describe, expect, it } from "vitest";
import { variantSignature } from "./variant-identity";

// ---------------------------------------------------------------------------
// A product's identity is brand + model + its SET of variants.
//
// A set, because the axes stack: `FireProtect 2 RB (CO) UL Jeweller` differs
// from its siblings on battery, sensor, certification and radio at once. A
// unique index cannot span a JSON array, so the set is flattened into one
// comparable string and the constraint binds on that.
//
// Everything below is about the flattening being TOTAL. If two authors can tick
// the same variants and produce two different signatures, the database stops
// catching the duplicate — and the failure looks like a product that was simply
// entered twice on purpose.
// ---------------------------------------------------------------------------

describe("variantSignature", () => {
  it("does not depend on the order the boxes were ticked", () => {
    // The one that matters most. Without sorting, whether a duplicate is caught
    // would depend on which checkbox each author happened to click first.
    expect(variantSignature(["ul", "rb", "jeweller"])).toBe(
      variantSignature(["jeweller", "ul", "rb"]),
    );
  });

  it("tells two different variant sets apart", () => {
    expect(variantSignature(["rb"])).not.toBe(variantSignature(["sb"]));
    expect(variantSignature(["rb"])).not.toBe(variantSignature(["rb", "ul"]));
  });

  it("treats a variant ticked twice as ticked once", () => {
    expect(variantSignature(["rb", "rb"])).toBe(variantSignature(["rb"]));
  });

  it("gives NULL for no variants, not an empty string", () => {
    // MySQL treats NULLs in a unique index as distinct, and that is what stops a
    // catalogue full of variant-less products from colliding the moment two of
    // them share a model. An empty string would make them all one product.
    expect(variantSignature([])).toBeNull();
    expect(variantSignature(["", "   "])).toBeNull();
  });

  it("is stable across whitespace, so a stray space cannot fork an identity", () => {
    expect(variantSignature([" rb ", "ul"])).toBe(variantSignature(["rb", "ul"]));
  });

  it("produces something readable in a query", () => {
    // Built from slugs rather than uuids deliberately: the column is the thing
    // somebody stares at when two products collide, and a row of uuids answers
    // nothing.
    expect(variantSignature(["ul", "rb"])).toBe("rb+ul");
  });
});
