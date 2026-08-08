import { describe, expect, it } from "vitest";
import type { SelectLeads } from "../../../db/schema/leads";
import {
  distanceKm,
  qualifyLead,
  routeLead,
  type QualifiableLead,
  type RoutablePartner,
} from "./lead-qualification";

const complete = (over: Partial<QualifiableLead> = {}): QualifiableLead => ({
  systems: ["cctv"],
  sizeBand: "villa",
  city: "Riyadh",
  contactVerifiedAt: new Date("2026-08-01"),
  contactPhone: "+966500000000",
  contactEmail: null,
  ...over,
});

const partner = (over: Partial<RoutablePartner> = {}): RoutablePartner => ({
  clerkUserId: "p1",
  name: "Partner One",
  city: "Riyadh",
  latitude: 24.7136,
  longitude: 46.6753,
  capabilities: ["install_only"],
  ...over,
});

const lead = (
  over: Partial<Pick<SelectLeads, "city" | "latitude" | "longitude" | "systems">> = {},
) => ({
  city: "Riyadh",
  latitude: "24.7136",
  longitude: "46.6753",
  systems: ["cctv"],
  ...over,
});

describe("qualification is rules, never a score", () => {
  it("qualifies a lead with all four facts", () => {
    const result = qualifyLead(complete());
    expect(result.qualified).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("names what is missing rather than rating the lead", () => {
    // A number cannot be acted on. "62" does not tell whoever is qualifying which
    // question to ask next.
    const result = qualifyLead(complete({ systems: null, sizeBand: null }));
    expect(result.qualified).toBe(false);
    expect(result.missing.map((gap) => gap.field)).toEqual([
      "systems",
      "sizeBand",
    ]);
    // And each gap carries the question to go and ask.
    for (const gap of result.missing) {
      expect(gap.ask.length).toBeGreaterThan(10);
    }
  });

  it("refuses an empty systems array, not just a null one", () => {
    // A form that submitted no checkboxes gives [] and not null.
    expect(qualifyLead(complete({ systems: [] })).qualified).toBe(false);
  });

  it("refuses whitespace as a size band or a city", () => {
    expect(qualifyLead(complete({ sizeBand: "   " })).qualified).toBe(false);
    expect(qualifyLead(complete({ city: "  " })).qualified).toBe(false);
  });

  it("needs somebody to have actually spoken to them", () => {
    // The only fact here a machine cannot supply, and the one that separates a real
    // enquiry from a form fill by a bot.
    const result = qualifyLead(complete({ contactVerifiedAt: null }));
    expect(result.qualified).toBe(false);
    expect(result.missing.map((gap) => gap.field)).toContain("contact");
  });

  it("needs a way to reach them as well as a conversation", () => {
    const result = qualifyLead(
      complete({ contactPhone: null, contactEmail: null }),
    );
    expect(result.qualified).toBe(false);
  });

  it("accepts an email instead of a phone", () => {
    expect(
      qualifyLead(complete({ contactPhone: null, contactEmail: "a@b.com" }))
        .qualified,
    ).toBe(true);
  });

  it("does not require coordinates", () => {
    // Demanding a pin would strand every enquiry taken over the phone. A city is
    // enough to route by.
    expect(qualifyLead(complete()).qualified).toBe(true);
  });
});

describe("distance", () => {
  it("measures Riyadh to Jeddah at roughly 850 km", () => {
    const km = distanceKm(
      { latitude: 24.7136, longitude: 46.6753 },
      { latitude: 21.4858, longitude: 39.1925 },
    );
    expect(km).toBeGreaterThan(820);
    expect(km).toBeLessThan(880);
  });

  it("is zero for the same point", () => {
    const point = { latitude: 24.7136, longitude: 46.6753 };
    expect(distanceKm(point, point)).toBeCloseTo(0);
  });
});

describe("routing — capability filters, distance orders", () => {
  it("excludes a partner without the capability, however close", () => {
    // Being close does not make somebody able to install a fire panel. Proximity can
    // never promote a partner past the filter.
    const routed = routeLead({
      lead: lead(),
      partners: [
        partner({ clerkUserId: "near", capabilities: ["stock"] }),
        partner({
          clerkUserId: "far",
          city: "Jeddah",
          latitude: 21.4858,
          longitude: 39.1925,
        }),
      ],
      requiredCapability: "install_only",
    });
    expect(routed.map((row) => row.clerkUserId)).toEqual(["far"]);
  });

  it("puts the nearest qualifying partner first", () => {
    const routed = routeLead({
      lead: lead(),
      partners: [
        partner({
          clerkUserId: "jeddah",
          city: "Jeddah",
          latitude: 21.4858,
          longitude: 39.1925,
        }),
        partner({ clerkUserId: "riyadh" }),
      ],
      requiredCapability: "install_only",
    });
    expect(routed[0].clerkUserId).toBe("riyadh");
  });

  it("ranks a same-city partner with no pin above a distant one with a pin", () => {
    // Sorting purely on a nullable number gets this backwards, and it is the common
    // case — most partners have a city and no coordinates.
    const routed = routeLead({
      lead: lead(),
      partners: [
        partner({
          clerkUserId: "far-but-pinned",
          city: "Dammam",
          latitude: 26.4207,
          longitude: 50.0888,
        }),
        partner({
          clerkUserId: "same-city-no-pin",
          latitude: null,
          longitude: null,
        }),
      ],
      requiredCapability: "install_only",
    });
    expect(routed[0].clerkUserId).toBe("same-city-no-pin");
  });

  it("treats unknown distance as last, not as zero", () => {
    const routed = routeLead({
      lead: lead({ city: null }),
      partners: [
        partner({ clerkUserId: "unknown", city: null, latitude: null, longitude: null }),
        partner({ clerkUserId: "pinned", city: null }),
      ],
      requiredCapability: "install_only",
    });
    expect(routed[0].clerkUserId).toBe("pinned");
  });

  it("orders the same way every time, so the cascade does not shuffle", () => {
    const partners = [
      partner({ clerkUserId: "b", latitude: null, longitude: null }),
      partner({ clerkUserId: "a", latitude: null, longitude: null }),
    ];
    const first = routeLead({
      lead: lead(),
      partners,
      requiredCapability: "install_only",
    });
    const second = routeLead({
      lead: lead(),
      partners: [...partners].reverse(),
      requiredCapability: "install_only",
    });
    expect(first.map((row) => row.clerkUserId)).toEqual(
      second.map((row) => row.clerkUserId),
    );
  });

  it("returns nobody when no partner qualifies", () => {
    // An empty list is the honest answer, and the caller has to decide what to say
    // about it — offering the lead to somebody unqualified would be worse.
    expect(
      routeLead({
        lead: lead(),
        partners: [partner({ capabilities: [] })],
        requiredCapability: "install_only",
      }),
    ).toEqual([]);
  });

  it("copes with a lead whose coordinates are not numbers", () => {
    const routed = routeLead({
      lead: lead({ latitude: "not a number", longitude: "" }),
      partners: [partner()],
      requiredCapability: "install_only",
    });
    expect(routed).toHaveLength(1);
    expect(routed[0].distanceKm).toBeNull();
    // Still same-city, which is the whole reason city is kept as well as a pin.
    expect(routed[0].sameCity).toBe(true);
  });
});
