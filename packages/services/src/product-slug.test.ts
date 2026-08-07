import { describe, expect, it } from "vitest";
import { chooseProductSlug, isInSlugFamily } from "./product-slug";

// ---------------------------------------------------------------------------
// `slug` is NOT NULL UNIQUE, but a NAME is not an identity — a product is brand
// + model + its variants. So two rows sharing a name are legitimate, and common:
// 86 of Ajax's 290 products are a sibling's name with the difference living in
// another column.
//
// Before this, the second of those two hit a driver-level duplicate-key error.
// Mid-import that is worse than it sounds: the run dies partway, and the reason
// is a constraint name rather than a product name.
//
// Two rules are being defended here.
//   1. A NEW product never steals a slug that is already answering to someone.
//   2. An EXISTING product never loses the slug it already answers to — because
//      `-2` goes by arrival order, so re-deriving on every save would shuffle
//      the suffix onto a sibling and break a URL on a row nobody edited.
// ---------------------------------------------------------------------------

describe("isInSlugFamily", () => {
  it("accepts the bare base and its numbered siblings", () => {
    expect(isInSlugFamily("bulletcam-hl", "bulletcam-hl")).toBe(true);
    expect(isInSlugFamily("bulletcam-hl-2", "bulletcam-hl")).toBe(true);
    expect(isInSlugFamily("bulletcam-hl-17", "bulletcam-hl")).toBe(true);
  });

  it("rejects a neighbour whose name merely starts the same", () => {
    // The case that makes this function exist. The gathering query uses
    // `LIKE base-%`, which cannot tell `-2` from `-extra`. Treating the
    // neighbour as family would let a renamed product keep its old slug, and
    // nothing anywhere would report it.
    expect(isInSlugFamily("bulletcam-hl-extra", "bulletcam-hl")).toBe(false);
    expect(isInSlugFamily("bulletcam-hl-2-pro", "bulletcam-hl")).toBe(false);
    expect(isInSlugFamily("bulletcam-hlx", "bulletcam-hl")).toBe(false);
  });
});

describe("chooseProductSlug — creating", () => {
  it("takes the bare slug when nothing holds it", () => {
    expect(chooseProductSlug("DomeCam Mini", [])).toBe("domecam-mini");
  });

  it("numbers the second product sharing a name instead of failing", () => {
    // This is the 86. Both rows are real products; the difference is a variant.
    const family = [{ uuid: "a", slug: "domecam-mini" }];
    expect(chooseProductSlug("DomeCam Mini", family)).toBe("domecam-mini-2");
  });

  it("keeps counting past an arbitrary number of siblings", () => {
    const family = ["", "-2", "-3", "-4"].map((s, i) => ({
      uuid: String(i),
      slug: `batteries${s}`,
    }));
    expect(chooseProductSlug("Batteries", family)).toBe("batteries-5");
  });

  it("does not treat a same-prefixed neighbour as a taken number", () => {
    const family = [{ uuid: "a", slug: "case-fibra" }];
    expect(chooseProductSlug("Case", family)).toBe("case");
  });

  it("returns null for a name with nothing to slugify", () => {
    // Refused rather than defaulted. A product slugged "" or "product-7" is a
    // dead URL either way, and the importer should queue it for a human.
    expect(chooseProductSlug("!!!", [])).toBeNull();
    expect(chooseProductSlug("   ", [])).toBeNull();
  });
});

describe("chooseProductSlug — updating", () => {
  const family = [
    { uuid: "first", slug: "domecam-mini" },
    { uuid: "second", slug: "domecam-mini-2" },
  ];

  it("leaves an unchanged name on the slug it already has", () => {
    expect(chooseProductSlug("DomeCam Mini", family, "second")).toBe(
      "domecam-mini-2",
    );
  });

  it("does not promote a sibling to the bare slug on an unrelated edit", () => {
    // If `-2` were re-derived every save, editing `second` while `first` was
    // briefly absent would hand it `domecam-mini` — and `first` would take
    // `-2` on ITS next save. Two products silently swapping URLs.
    expect(chooseProductSlug("DomeCam Mini", family, "first")).toBe(
      "domecam-mini",
    );
  });

  it("moves to the new base when the name actually changes", () => {
    expect(chooseProductSlug("BulletCam HL", family, "second")).toBe(
      "bulletcam-hl",
    );
  });

  it("gives up its old slug when a rename shortens into a neighbour's prefix", () => {
    // Renaming "Bulletcam HL Extra" to "Bulletcam HL": the old slug survives the
    // `LIKE` gather, but it is not this base's family, so it must not be kept.
    const rows = [{ uuid: "self", slug: "bulletcam-hl-extra" }];
    expect(chooseProductSlug("Bulletcam HL", rows, "self")).toBe(
      "bulletcam-hl",
    );
  });

  it("still avoids a collision when the new base is already taken", () => {
    const rows = [
      { uuid: "other", slug: "hub-hybrid" },
      { uuid: "self", slug: "case-d" },
    ];
    expect(chooseProductSlug("Hub Hybrid", rows, "self")).toBe("hub-hybrid-2");
  });
});
