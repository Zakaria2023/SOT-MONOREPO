import { describe, expect, it } from "vitest";
import { productStatuses, type ProductStatus } from "../../../db/enum";
import {
  assessSupply,
  classifySupply,
  describeSupply,
  type SupplyLine,
} from "./supply";

const line = (
  name: string,
  status: ProductStatus | null,
  isAvailable = true,
  quantity = 1,
): SupplyLine => ({
  productUuid: name.toLowerCase(),
  name,
  status,
  isAvailable,
  quantity,
});

describe("what each status means for selling", () => {
  it("covers every status in the enum", () => {
    // The point of the total map. A status added without deciding what it means
    // for supply would otherwise default to sellable, which is how a
    // discontinued line goes on being sold.
    for (const status of productStatuses) {
      expect(classifySupply({ status, isAvailable: true }).state, status).toMatch(
        /available|delayed|unavailable/,
      );
    }
  });

  it("refuses what cannot be got at all", () => {
    for (const status of ["out_of_stock", "end_of_sale", "end_of_life"] as const) {
      expect(classifySupply({ status, isAvailable: true }).state, status).toBe(
        "unavailable",
      );
    }
  });

  it("does not refuse what is merely late", () => {
    // Refusing a pre-order would make pre-order a status that cannot be ordered.
    for (const status of ["pre_order", "in_order"] as const) {
      expect(classifySupply({ status, isAvailable: true }).state, status).toBe(
        "delayed",
      );
    }
  });

  it("treats limited stock as available, with something to say", () => {
    // Nothing records HOW limited, so a caution is the most this flag supports.
    const verdict = classifySupply({
      status: "limited_stock",
      isAvailable: true,
    });
    expect(verdict.state).toBe("available");
    expect(verdict.note).toBeTruthy();
  });

  it("lets the manual switch talk over any status", () => {
    // A switch a descriptive column can override is not a switch.
    expect(
      classifySupply({ status: "in_stock", isAvailable: false }).state,
    ).toBe("unavailable");
  });

  it("does not refuse a product nobody has said anything about", () => {
    // Null is the absence of a statement, not evidence of a shortage. Refusing
    // on it would take the whole catalogue off sale.
    expect(classifySupply({ status: null, isAvailable: true }).state).toBe(
      "available",
    );
  });
});

describe("assessing a basket", () => {
  it("is sellable when nothing is unavailable, delays and all", () => {
    const assessment = assessSupply([
      line("Dome camera", "in_stock"),
      line("PTZ camera", "pre_order"),
      line("Switch", "limited_stock"),
    ]);
    expect(assessment.sellable).toBe(true);
    expect(assessment.blocking).toEqual([]);
    expect(assessment.waiting.map((item) => item.name)).toEqual(["PTZ camera"]);
  });

  it("refuses on one unavailable line among many good ones", () => {
    const assessment = assessSupply([
      line("Dome camera", "in_stock"),
      line("Old NVR", "end_of_life"),
    ]);
    expect(assessment.sellable).toBe(false);
    expect(assessment.blocking.map((item) => item.name)).toEqual(["Old NVR"]);
  });

  it("is sellable when there is nothing in it", () => {
    // An empty basket is refused earlier, for being empty. It must not be
    // refused HERE for a supply problem it does not have — a refusal that names
    // the wrong reason sends somebody looking in the wrong place.
    expect(assessSupply([]).sellable).toBe(true);
  });

  it("keeps every line, not only the failing ones", () => {
    // The cart screen renders from this, so a passing line still has to come
    // back or it disappears from the basket it is in.
    const assessment = assessSupply([
      line("Dome camera", "in_stock"),
      line("Old NVR", "end_of_life"),
    ]);
    expect(assessment.lines).toHaveLength(2);
  });
});

describe("what the refusal says", () => {
  it("names the product and the reason when there is one", () => {
    const { blocking } = assessSupply([line("Old NVR", "end_of_life")]);
    const sentence = describeSupply(blocking);
    expect(sentence).toContain("Old NVR");
    expect(sentence).toContain("end of life");
  });

  it("names them all rather than counting them", () => {
    const { blocking } = assessSupply([
      line("Old NVR", "end_of_life"),
      line("Old switch", "out_of_stock"),
    ]);
    const sentence = describeSupply(blocking);
    expect(sentence).toContain("Old NVR");
    expect(sentence).toContain("Old switch");
  });

  it("says nothing when nothing is blocking", () => {
    expect(describeSupply([])).toBe("");
  });
});
