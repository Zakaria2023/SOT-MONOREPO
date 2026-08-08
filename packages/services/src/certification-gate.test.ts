import { describe, expect, it } from "vitest";
import { partnerCapabilities, type PartnerCapability } from "../../../db/enum";
import type { SelectCertifications } from "../../../db/schema/training";
import {
  canCertify,
  capabilityStanding,
  certificateState,
  lapsedCapabilities,
  LAPSE_NOTICE_DAYS,
  REQUIRES_CERTIFICATION,
} from "./certification-gate";

const TODAY = "2026-08-08";

const assessment = (over: Partial<Parameters<typeof canCertify>[0]> = {}) => ({
  status: "attended",
  assessmentScore: 80,
  passMark: 70,
  hasAssessment: true,
  unlocksCapability: "install_only" as PartnerCapability,
  ...over,
});

type Cert = Pick<
  SelectCertifications,
  "uuid" | "capability" | "status" | "expiresOn" | "verifiedAt"
>;

const cert = (over: Partial<Cert> = {}): Cert => ({
  uuid: "cert-1",
  capability: "install_only",
  status: "verified",
  expiresOn: "2027-01-01",
  verifiedAt: new Date("2026-01-01"),
  ...over,
});

describe("gate one — a pass, not attendance", () => {
  it("certifies a pass", () => {
    const check = canCertify(assessment());
    expect(check.allowed).toBe(true);
  });

  it("refuses attendance with no assessment recorded", () => {
    // The gate the spec states outright. Sitting in a room for a day demonstrates
    // that somebody can sit in a room.
    const check = canCertify(assessment({ assessmentScore: null }));
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toContain("Attending is not passing");
    }
  });

  it("refuses a score below the pass mark, and says both numbers", () => {
    const check = canCertify(assessment({ assessmentScore: 69 }));
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toContain("69");
      expect(check.reason).toContain("70");
    }
  });

  it("treats the pass mark as inclusive", () => {
    expect(canCertify(assessment({ assessmentScore: 70 })).allowed).toBe(true);
  });

  it("refuses a course that has no assessment at all", () => {
    const check = canCertify(assessment({ hasAssessment: false }));
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toContain("attendance alone");
    }
  });

  it("refuses a course that grants nothing", () => {
    // Not a failure — a course can be worth running for its own sake.
    expect(canCertify(assessment({ unlocksCapability: null })).allowed).toBe(
      false,
    );
  });

  it("refuses a no-show even with a score somehow attached", () => {
    expect(canCertify(assessment({ status: "no_show" })).allowed).toBe(false);
  });
});

describe("which capabilities need proof at all", () => {
  it("has decided for every capability in the enum", () => {
    // A total map, so adding a capability forces a decision instead of defaulting
    // to "no certificate needed" — the wrong default for anything safety-related.
    for (const capability of partnerCapabilities) {
      expect(typeof REQUIRES_CERTIFICATION[capability], capability).toBe(
        "boolean",
      );
    }
  });

  it("requires it for competence and not for commerce", () => {
    expect(REQUIRES_CERTIFICATION.install_only).toBe(true);
    expect(REQUIRES_CERTIFICATION.install_program).toBe(true);
    expect(REQUIRES_CERTIFICATION.system_integrator).toBe(true);
    // Holding stock is a credit arrangement. There is no exam for it, and
    // requiring one would block a distributor for no defensible reason.
    expect(REQUIRES_CERTIFICATION.stock).toBe(false);
  });

  it("lets an uncertifiable capability through with no paper", () => {
    const standing = capabilityStanding("stock", [], TODAY);
    expect(standing.allowed).toBe(true);
    expect(standing.requiresCertification).toBe(false);
  });
});

describe("gate two — a valid, verified certificate", () => {
  it("allows a verified, unexpired certificate", () => {
    expect(capabilityStanding("install_only", [cert()], TODAY).allowed).toBe(
      true,
    );
  });

  it("refuses when there is no certificate", () => {
    const standing = capabilityStanding("install_only", [], TODAY);
    expect(standing.allowed).toBe(false);
    // And names the route, so a partner knows what to do about it.
    expect(standing.reason).toContain("attend a course");
  });

  it("refuses one SOT has never looked at", () => {
    // Same reasoning as firmwareVerified: a certificate nobody checked is a claim.
    const standing = capabilityStanding(
      "install_only",
      [cert({ verifiedAt: null, status: "pending_verification" })],
      TODAY,
    );
    expect(standing.allowed).toBe(false);
    expect(standing.state?.standing).toBe("unverified");
  });

  it("refuses a revoked one", () => {
    const standing = capabilityStanding(
      "install_only",
      [cert({ status: "revoked" })],
      TODAY,
    );
    expect(standing.allowed).toBe(false);
    expect(standing.state?.standing).toBe("revoked");
  });

  it("ignores a certificate for a different capability", () => {
    const standing = capabilityStanding(
      "install_only",
      [cert({ capability: "install_program" })],
      TODAY,
    );
    expect(standing.allowed).toBe(false);
  });
});

describe("expiry is derived, never read from the column", () => {
  it("refuses a lapsed certificate whose stored status still says verified", () => {
    // THE POINT. Nothing runs at midnight to update the column, so a certificate
    // that expired last month still reads `verified` in the database. Trusting it
    // is how Products.status came to say out_of_stock on things being sold.
    const standing = capabilityStanding(
      "install_only",
      [cert({ status: "verified", expiresOn: "2026-01-01" })],
      TODAY,
    );
    expect(standing.allowed).toBe(false);
    expect(standing.state?.standing).toBe("expired");
  });

  it("treats a null expiry as never lapsing", () => {
    const state = certificateState(cert({ expiresOn: null }), TODAY);
    expect(state.standing).toBe("valid");
    expect(state.daysUntilExpiry).toBeNull();
    expect(state.lapsingSoon).toBe(false);
  });

  it("does not treat an unreadable expiry as valid", () => {
    // A certificate whose expiry nobody can read is one nobody can rely on.
    const state = certificateState(cert({ expiresOn: "soon" }), TODAY);
    expect(state.standing).toBe("expired");
    expect(state.reason).toContain("could not be read");
  });

  it("flags one inside the notice window", () => {
    // Sixty days, because a partner has to book, sit and be verified before the
    // old one goes.
    const state = certificateState(cert({ expiresOn: "2026-09-01" }), TODAY);
    expect(state.standing).toBe("valid");
    expect(state.lapsingSoon).toBe(true);
    expect(state.daysUntilExpiry).toBeLessThanOrEqual(LAPSE_NOTICE_DAYS);
  });

  it("does not flag one well clear of it", () => {
    const state = certificateState(cert({ expiresOn: "2028-01-01" }), TODAY);
    expect(state.lapsingSoon).toBe(false);
  });

  it("counts the expiry day itself as still valid", () => {
    const state = certificateState(cert({ expiresOn: TODAY }), TODAY);
    expect(state.standing).toBe("valid");
    expect(state.daysUntilExpiry).toBe(0);
  });
});

describe("the best certificate wins, not the first or the newest", () => {
  it("accepts a verified renewal alongside an expired original", () => {
    // A partner holding both has to come back allowed, and picking by row order
    // would make the answer depend on which came out of the database first.
    const standing = capabilityStanding(
      "install_only",
      [
        cert({ uuid: "old", expiresOn: "2020-01-01" }),
        cert({ uuid: "new", expiresOn: "2028-01-01" }),
      ],
      TODAY,
    );
    expect(standing.allowed).toBe(true);
    expect(standing.certificateUuid).toBe("new");
  });

  it("prefers the same answer whichever order they arrive in", () => {
    const forwards = capabilityStanding(
      "install_only",
      [
        cert({ uuid: "old", expiresOn: "2020-01-01" }),
        cert({ uuid: "new", expiresOn: "2028-01-01" }),
      ],
      TODAY,
    );
    const backwards = capabilityStanding(
      "install_only",
      [
        cert({ uuid: "new", expiresOn: "2028-01-01" }),
        cert({ uuid: "old", expiresOn: "2020-01-01" }),
      ],
      TODAY,
    );
    expect(forwards.certificateUuid).toBe(backwards.certificateUuid);
  });

  it("prefers a valid one over an unverified one", () => {
    const standing = capabilityStanding(
      "install_only",
      [
        cert({ uuid: "unchecked", verifiedAt: null, expiresOn: "2030-01-01" }),
        cert({ uuid: "checked", expiresOn: "2027-01-01" }),
      ],
      TODAY,
    );
    expect(standing.certificateUuid).toBe("checked");
    expect(standing.allowed).toBe(true);
  });

  it("prefers the longest-lasting among valid ones", () => {
    const standing = capabilityStanding(
      "install_only",
      [
        cert({ uuid: "short", expiresOn: "2026-12-01" }),
        cert({ uuid: "long", expiresOn: "2029-12-01" }),
      ],
      TODAY,
    );
    expect(standing.certificateUuid).toBe("long");
  });

  it("prefers one that never expires over any dated one", () => {
    const standing = capabilityStanding(
      "install_only",
      [
        cert({ uuid: "dated", expiresOn: "2029-12-01" }),
        cert({ uuid: "forever", expiresOn: null }),
      ],
      TODAY,
    );
    expect(standing.certificateUuid).toBe("forever");
  });
});

describe("expiry has teeth", () => {
  it("names the held capabilities a partner is no longer entitled to", () => {
    // Without this, expiresOn is decoration — a column nothing reads, which is
    // exactly what Products.status was before the supply gate.
    const lapsed = lapsedCapabilities(
      ["install_only", "install_program", "stock"],
      [
        cert({ capability: "install_only", expiresOn: "2020-01-01" }),
        cert({ capability: "install_program", expiresOn: "2029-01-01" }),
      ],
      TODAY,
    );
    expect(lapsed.map((item) => item.capability)).toEqual(["install_only"]);
  });

  it("never lapses a capability that needed no certificate", () => {
    expect(lapsedCapabilities(["stock", "pre_sell"], [], TODAY)).toEqual([]);
  });

  it("lapses a certified capability with no certificate at all", () => {
    const lapsed = lapsedCapabilities(["install_only"], [], TODAY);
    expect(lapsed).toHaveLength(1);
  });
});
