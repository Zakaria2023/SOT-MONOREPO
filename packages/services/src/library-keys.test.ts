import { describe, expect, it } from "vitest";
import { normalizeLibraryKey } from "./library-options";

// ---------------------------------------------------------------------------
// THE EXTERNAL NAME — identity outside the model.
//
// `uuid` is what values, assignments, rules and predicates key on, and that is
// what makes renaming an attribute free. `key` is what everything OUTSIDE keys
// on: an import mapping a brand column, an export, a spreadsheet somebody keeps
// by hand. None of those can hold a uuid.
//
// The whole reason it is CHECKED and not coerced: `slugify` turns
// `pwr.power_draw_w` into `pwr-power-draw-w`. An author typing the dotted id from
// the specification document would find the database holding something else, and
// the mapping keyed on what they typed would resolve to nothing — on every row,
// in silence.
// ---------------------------------------------------------------------------

describe("normalizeLibraryKey", () => {
  it.each([
    "pwr.power_draw_w",
    "phys.ip_rating",
    "id.lifecycle_status",
    "comp.security_grade",
    "net.frequency_band",
    "det.co_alarm_threshold_ppm",
  ])("keeps the dotted id %s exactly as written", (key) => {
    expect(normalizeLibraryKey(key)).toEqual({ ok: true, key });
  });

  it("allows a single segment, because the dotted prefix is filing not law", () => {
    expect(normalizeLibraryKey("sku")).toEqual({ ok: true, key: "sku" });
  });

  it("lowercases, so one written form cannot become two keys", () => {
    expect(normalizeLibraryKey("  PWR.Power_Draw_W  ")).toEqual({
      ok: true,
      key: "pwr.power_draw_w",
    });
  });

  it.each([
    ["pwr power draw", "a space"],
    ["pwr-power-draw", "a hyphen"],
    ["pwr..power", "an empty segment"],
    [".pwr", "a leading dot"],
    ["pwr.", "a trailing dot"],
    ["pwr.power$draw", "punctuation"],
    ["", "nothing at all"],
  ])("refuses %s (%s) rather than coercing it", (key) => {
    expect(normalizeLibraryKey(key).ok).toBe(false);
  });

  it("explains the shape when it refuses", () => {
    // A refusal that does not say what a valid key looks like just moves the
    // guessing from the importer to the author.
    const result = normalizeLibraryKey("PoE Budget");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("pwr.power_draw_w");
    }
  });
});
