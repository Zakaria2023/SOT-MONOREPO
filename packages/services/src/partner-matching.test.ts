import { describe, expect, it } from "vitest";
import {
  locationParts,
  matchPartners,
  proximityOf,
  type PartnerCandidate,
} from "./partner-matching";

const partner = (
  name: string,
  location: string,
  capabilities: PartnerCandidate["capabilities"],
  approvedAt = "2026-01-01",
): PartnerCandidate => ({
  partnerRequestUuid: `p-${name}`,
  clerkUserId: `clerk-${name}`,
  name,
  location,
  capabilities,
  approvedAt: new Date(approvedAt),
});

describe("proximityOf", () => {
  it("calls the same first part the same city", () => {
    // People write "Riyadh, Al Olaya", not the other way round.
    expect(proximityOf("Riyadh, Al Olaya", "Riyadh, Al Malaz")).toBe(
      "same_city",
    );
  });

  it("is case and space insensitive", () => {
    expect(proximityOf("  RIYADH ", "riyadh")).toBe("same_city");
  });

  it("calls a shared later part a region match, not a city match", () => {
    expect(proximityOf("Jeddah, Makkah Province", "Taif, Makkah Province")).toBe(
      "shares_region",
    );
  });

  it("calls nothing in common elsewhere", () => {
    expect(proximityOf("Riyadh", "Jeddah")).toBe("elsewhere");
  });

  it("is unknown when either side has no location", () => {
    expect(proximityOf(null, "Riyadh")).toBe("unknown");
    expect(proximityOf("Riyadh", null)).toBe("unknown");
    expect(proximityOf("  ", "Riyadh")).toBe("unknown");
  });
});

describe("capability is a filter, never a score", () => {
  it("excludes a partner who cannot do the work, however close they are", () => {
    // The bug in the old matcher: a pre-seller in the right city sorted top of
    // an installation job purely for being nearby.
    const outcome = matchPartners(
      [
        partner("NearbyPreSeller", "Riyadh", ["pre_sell"]),
        partner("FarInstaller", "Jeddah", ["install_only"]),
      ],
      { location: "Riyadh", needsAnyOf: ["install_only", "install_program"] },
    );
    expect(outcome.eligible.map((m) => m.candidate.name)).toEqual([
      "FarInstaller",
    ]);
    expect(outcome.ineligible.map((m) => m.candidate.name)).toEqual([
      "NearbyPreSeller",
    ]);
  });

  it("returns the excluded partner WITH a reason rather than dropping them", () => {
    // A name simply missing reads as a bug in the matcher.
    const outcome = matchPartners(
      [partner("PreSeller", "Riyadh", ["pre_sell"])],
      { location: "Riyadh", needsAnyOf: ["install_program"] },
    );
    expect(outcome.ineligible[0].reason).toContain("install_program");
    expect(outcome.ineligible[0].reason).toContain("pre_sell");
  });

  it("treats the requirement as ANY, not all", () => {
    // A job needing installation is served by install_only OR install_program.
    // Requiring both would match nobody.
    const outcome = matchPartners(
      [partner("Installer", "Riyadh", ["install_only"])],
      { location: "Riyadh", needsAnyOf: ["install_only", "install_program"] },
    );
    expect(outcome.eligible).toHaveLength(1);
  });

  it("says so when a partner holds nothing at all", () => {
    const outcome = matchPartners([partner("Suspended", "Riyadh", [])], {
      location: "Riyadh",
      needsAnyOf: ["install_only"],
    });
    expect(outcome.ineligible[0].reason).toContain("holds nothing");
  });

  it("accepts everyone when the job needs no particular capability", () => {
    const outcome = matchPartners([partner("Anyone", "Riyadh", [])], {
      location: "Riyadh",
      needsAnyOf: [],
    });
    expect(outcome.eligible).toHaveLength(1);
  });
});

describe("proximity ranks the eligible", () => {
  it("puts same city first, then region, then elsewhere", () => {
    const outcome = matchPartners(
      [
        partner("Far", "Dammam", ["install_only"]),
        partner("Regional", "Taif, Makkah Province", ["install_only"]),
        partner("Local", "Jeddah, Makkah Province", ["install_only"]),
      ],
      { location: "Jeddah, Makkah Province", needsAnyOf: ["install_only"] },
    );
    expect(outcome.eligible.map((m) => m.candidate.name)).toEqual([
      "Local",
      "Regional",
      "Far",
    ]);
    expect(outcome.eligible.map((m) => m.rank)).toEqual([1, 2, 3]);
  });

  it("breaks ties toward the longer-standing partner", () => {
    const outcome = matchPartners(
      [
        partner("Newer", "Riyadh", ["install_only"], "2026-06-01"),
        partner("Older", "Riyadh", ["install_only"], "2025-01-01"),
      ],
      { location: "Riyadh", needsAnyOf: ["install_only"] },
    );
    expect(outcome.eligible.map((m) => m.candidate.name)).toEqual([
      "Older",
      "Newer",
    ]);
  });

  it("gives the ineligible no rank", () => {
    const outcome = matchPartners([partner("PreSeller", "Riyadh", ["pre_sell"])], {
      location: "Riyadh",
      needsAnyOf: ["install_only"],
    });
    expect(outcome.ineligible[0].rank).toBe(0);
  });
});

describe("a job with no location", () => {
  it("still matches on capability, and says the order is not by distance", () => {
    // Surfaced rather than hidden behind a list that looks confidently sorted.
    const outcome = matchPartners(
      [
        partner("A", "Riyadh", ["install_only"], "2025-01-01"),
        partner("B", "Jeddah", ["install_only"], "2026-01-01"),
      ],
      { location: null, needsAnyOf: ["install_only"] },
    );
    expect(outcome.unranked).toBe(true);
    expect(outcome.eligible).toHaveLength(2);
    // Falls back to standing, which is at least stable.
    expect(outcome.eligible[0].candidate.name).toBe("A");
  });

  it("is not unranked when the job has a location", () => {
    expect(
      matchPartners([], { location: "Riyadh", needsAnyOf: [] }).unranked,
    ).toBe(false);
  });
});

describe("locationParts", () => {
  it("splits on commas and slashes", () => {
    expect(locationParts("Riyadh / Al Olaya, Building 4")).toEqual([
      "riyadh",
      "al olaya",
      "building 4",
    ]);
  });

  it("is empty for nothing", () => {
    expect(locationParts(null)).toEqual([]);
    expect(locationParts("  ,  ")).toEqual([]);
  });
});

describe("an empty candidate list", () => {
  it("returns nothing without complaining", () => {
    const outcome = matchPartners([], {
      location: "Riyadh",
      needsAnyOf: ["install_only"],
    });
    expect(outcome.eligible).toEqual([]);
    expect(outcome.ineligible).toEqual([]);
  });
});
