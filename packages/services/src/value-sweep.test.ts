import { describe, expect, it } from "vitest";
import {
  normaliseForComparison,
  sweepProblems,
  sweepValues,
  type SweepInput,
} from "./value-sweep";

const input = (over: Partial<SweepInput> = {}): SweepInput => ({
  attributes: [
    {
      specUuid: "poe",
      label: "PoE Input Type",
      options: [
        { value: "af", label: "802.3af", rank: null, retired: false },
        { value: "at", label: "802.3at", rank: null, retired: false },
        { value: "bt", label: "802.3bt", rank: null, retired: false },
      ],
    },
  ],
  values: [
    { specUuid: "poe", value: "af" },
    { specUuid: "poe", value: "at" },
  ],
  ...over,
});

describe("sweepValues", () => {
  it("is quiet when every value is in the list and every option is used", () => {
    const [sweep] = sweepValues(
      input({
        values: [
          { specUuid: "poe", value: "af" },
          { specUuid: "poe", value: "at" },
          { specUuid: "poe", value: "bt" },
        ],
      }),
    );
    expect(sweep.offVocabulary).toEqual([]);
    expect(sweep.unusedOptions).toEqual([]);
    expect(sweep.nearDuplicates).toEqual([]);
  });

  it("catches a value nothing offers — the one a set comparator misses", () => {
    const [sweep] = sweepValues(
      input({
        values: [
          { specUuid: "poe", value: "af" },
          { specUuid: "poe", value: "802.3af" },
          { specUuid: "poe", value: "802.3af" },
        ],
      }),
    );
    expect(sweep.offVocabulary).toEqual([{ value: "802.3af", products: 2 }]);
  });

  it("puts the most-used off-vocabulary value first", () => {
    const [sweep] = sweepValues(
      input({
        values: [
          { specUuid: "poe", value: "rare" },
          { specUuid: "poe", value: "common" },
          { specUuid: "poe", value: "common" },
        ],
      }),
    );
    expect(sweep.offVocabulary.map((use) => use.value)).toEqual([
      "common",
      "rare",
    ]);
  });

  it("reports options nothing uses", () => {
    const [sweep] = sweepValues(input());
    expect(sweep.unusedOptions.map((option) => option.value)).toEqual(["bt"]);
  });

  it("catches two spellings of the same value", () => {
    const [sweep] = sweepValues(
      input({
        attributes: [
          {
            specUuid: "grade",
            label: "Cable Category",
            options: [{ value: "Cat6a", label: "Cat6a", rank: null, retired: false }],
          },
        ],
        values: [
          { specUuid: "grade", value: "Cat6a" },
          { specUuid: "grade", value: "CAT-6A" },
          { specUuid: "grade", value: "CAT-6A" },
        ],
      }),
    );
    expect(sweep.nearDuplicates).toHaveLength(1);
    expect(sweep.nearDuplicates[0].values.map((use) => use.value).sort()).toEqual(
      ["CAT-6A", "Cat6a"],
    );
  });

  it("does not pair two values that are merely similar", () => {
    // No edit distance on purpose. "at" and "af" differ by one character and are
    // entirely different things, and a checker that flags them is one nobody
    // reads twice.
    const [sweep] = sweepValues(input());
    expect(sweep.nearDuplicates).toEqual([]);
  });

  it("leaves a free-text attribute alone", () => {
    // No option list means no vocabulary to be off. Every answer is legitimate.
    const [sweep] = sweepValues({
      attributes: [{ specUuid: "note", label: "Notes", options: [] }],
      values: [
        { specUuid: "note", value: "anything at all" },
        { specUuid: "note", value: "something else" },
      ],
    });
    expect(sweep.offVocabulary).toEqual([]);
    expect(sweep.unusedOptions).toEqual([]);
  });

  it("counts every ticked value of a multi-select, not every product", () => {
    const [sweep] = sweepValues(
      input({
        values: [
          { specUuid: "poe", value: "af" },
          { specUuid: "poe", value: "at" },
          { specUuid: "poe", value: "bt" },
        ],
      }),
    );
    expect(sweep.productsAnswering).toBe(3);
  });

  it("reports an attribute nothing answers without inventing problems", () => {
    const [sweep] = sweepValues(input({ values: [] }));
    expect(sweep.productsAnswering).toBe(0);
    expect(sweep.offVocabulary).toEqual([]);
    expect(sweep.unusedOptions).toHaveLength(3);
  });
});

describe("normaliseForComparison", () => {
  it("folds case, spaces, hyphens, underscores and dots", () => {
    expect(normaliseForComparison("CAT-6A")).toBe("cat6a");
    expect(normaliseForComparison("Cat 6a")).toBe("cat6a");
    expect(normaliseForComparison("cat_6.a")).toBe("cat6a");
  });

  it("keeps genuinely different values apart", () => {
    expect(normaliseForComparison("Cat6")).not.toBe(
      normaliseForComparison("Cat6a"),
    );
  });
});

describe("sweepProblems", () => {
  it("does not call every option of an unanswered attribute unused", () => {
    // Trivially true and useless: nobody has tried. Against a catalogue of eight
    // products it buries the findings that mean something under forty that do not.
    const sweeps = sweepValues(input({ values: [] }));
    expect(sweeps[0].unusedOptions).toHaveLength(3);
    expect(sweepProblems(sweeps)).toEqual([]);
  });

  it("still reports an off-vocabulary value on an otherwise quiet attribute", () => {
    const sweeps = sweepValues(
      input({ values: [{ specUuid: "poe", value: "802.3af" }] }),
    );
    expect(sweepProblems(sweeps)).toHaveLength(1);
  });

  it("drops the attributes with nothing to answer for", () => {
    const sweeps = sweepValues(
      input({
        values: [
          { specUuid: "poe", value: "af" },
          { specUuid: "poe", value: "at" },
          { specUuid: "poe", value: "bt" },
        ],
      }),
    );
    expect(sweepProblems(sweeps)).toEqual([]);
  });
});
