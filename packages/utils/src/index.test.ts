import type { SelectOffers } from "services";
import { describe, expect, it } from "vitest";
import {
  capitalize,
  formatMoney,
  formatPrice,
  formatSar,
  getInitials,
  getReviewerName,
  offerTotal,
  slugify,
  splitFullName,
} from "./index";

// offerTotal only reads the three price fields; cast a minimal object to the row.
const asOffer = (
  prices: Pick<
    SelectOffers,
    "productPrice" | "installPrice" | "programmingPrice"
  >,
): SelectOffers => prices as SelectOffers;

describe("formatMoney", () => {
  it("formats whole amounts with thousands separators", () => {
    expect(formatMoney(17768, "SAR")).toBe("SAR 17,768");
  });

  it("rounds to whole units", () => {
    expect(formatMoney(1234.56, "USD")).toBe("USD 1,235");
  });

  it("defaults to SAR when currency is null", () => {
    expect(formatMoney(1000, null)).toBe("SAR 1,000");
  });
});

describe("formatSar", () => {
  it("prefixes SAR and rounds", () => {
    expect(formatSar(84200)).toBe("SAR 84,200");
    expect(formatSar(1234.5)).toBe("SAR 1,235");
  });
});

describe("formatPrice", () => {
  it("keeps the fractional part of a decimal string", () => {
    expect(formatPrice("4200.5", "SAR")).toBe("SAR 4,200.5");
  });

  it("defaults currency to SAR", () => {
    expect(formatPrice("4200", null)).toBe("SAR 4,200");
  });
});

describe("offerTotal", () => {
  it("sums product, install, and programming prices", () => {
    expect(
      offerTotal(
        asOffer({
          productPrice: "1000",
          installPrice: "200",
          programmingPrice: "50",
        }),
      ),
    ).toBe(1250);
  });

  it("treats a null programming price as zero", () => {
    expect(
      offerTotal(
        asOffer({
          productPrice: "1000",
          installPrice: "200",
          programmingPrice: null,
        }),
      ),
    ).toBe(1200);
  });
});

describe("capitalize", () => {
  it("uppercases the first letter", () => {
    expect(capitalize("published")).toBe("Published");
  });

  it("leaves an empty string unchanged", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("getInitials", () => {
  it("takes the first and last initials", () => {
    expect(getInitials("Zakaria Asad")).toBe("ZA");
  });

  it("handles a single name", () => {
    expect(getInitials("madonna")).toBe("M");
  });

  it("falls back to ? for blank input", () => {
    expect(getInitials("   ")).toBe("?");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Product Name")).toBe("product-name");
  });

  it("collapses non-alphanumerics and trims stray hyphens", () => {
    expect(slugify("  Wi-Fi & Routers!! ")).toBe("wi-fi-routers");
  });
});

describe("splitFullName", () => {
  it("splits into first and last", () => {
    expect(splitFullName("Abdullah Al Mutairi")).toEqual({
      firstName: "Abdullah",
      lastName: "Al Mutairi",
    });
  });

  it("leaves lastName undefined for a single token", () => {
    expect(splitFullName("Madonna")).toEqual({
      firstName: "Madonna",
      lastName: undefined,
    });
  });
});

describe("getReviewerName", () => {
  it("prefers the full name", () => {
    expect(
      getReviewerName({
        id: "u1",
        fullName: "Jane Doe",
        primaryEmailAddress: { emailAddress: "j@x.com" },
      }),
    ).toBe("Jane Doe");
  });

  it("falls back to email, then id", () => {
    expect(
      getReviewerName({
        id: "u1",
        fullName: "   ",
        primaryEmailAddress: { emailAddress: "j@x.com" },
      }),
    ).toBe("j@x.com");
    expect(
      getReviewerName({ id: "u1", fullName: null, primaryEmailAddress: null }),
    ).toBe("u1");
    expect(getReviewerName(null)).toBeUndefined();
  });
});
