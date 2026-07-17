import { z } from "zod";

export const partnerServiceScopes = [
  "installation",
  "install-program",
] as const satisfies readonly string[];

export type PartnerServiceScope = (typeof partnerServiceScopes)[number];

// What a partner can do — chosen first, before their applicant type. A partner
// picks one or more of these.
export const partnerCapabilities = [
  "system_integrator",
  "stock",
  "install_program",
  "install_only",
  "pre_sell",
  "post_sell",
] as const satisfies readonly string[];

export type PartnerCapability = (typeof partnerCapabilities)[number];

export const PARTNER_CAPABILITY_LABELS: Record<PartnerCapability, string> = {
  system_integrator: "System Integrator",
  stock: "Have stock",
  install_program: "Install & program the network",
  install_only: "Install the network only",
  pre_sell: "Pre-sell partner",
  post_sell: "Post-sell partner",
};

// Which kind of applicant is applying — mirrors the client sign-up account
// types. Every type submits a request that an admin reviews.
export const partnerApplicantTypes = [
  "individual",
  "facility",
  "government",
] as const;
export type PartnerApplicantType = (typeof partnerApplicantTypes)[number];

const digits = (value: string | undefined) => (value ?? "").replace(/\D/g, "");

export const partnerRequestSchema = z
  .object({
    // Chosen first — one or more capabilities.
    capabilities: z
      .array(z.enum(partnerCapabilities))
      .min(1, "Select at least one option"),

    type: z.enum(partnerApplicantTypes),

    // Shared contact identity. The email receives the Clerk invitation.
    email: z.string().email("Enter a valid email address").max(255),
    contactNumber: z.string().max(30).optional(),
    location: z.string().min(1, "Location is required").max(255),

    // Individual identity + name.
    firstName: z.string().max(255).optional(),
    middleName: z.string().max(255).optional(),
    lastName: z.string().max(255).optional(),

    // Government contact person (the entity name rides in companyName).
    fullName: z.string().max(255).optional(),

    // Facility business fields. companyName doubles as the government
    // entity name.
    companyName: z.string().max(255).optional(),
    unifiedNumber: z.string().max(30).optional(),
    crNumber: z.string().max(30).optional(),
    vatNumber: z.string().max(30).optional(),
    nationalAddress: z.string().max(1000).optional(),
    crCertificate: z.string().max(64).optional(),
    vatCertificate: z.string().max(64).optional(),
    representativeName: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    const requireText = (value: string | undefined, path: string) => {
      if (!value || value.trim().length === 0) {
        ctx.addIssue({ code: "custom", message: "Required", path: [path] });
      }
    };

    if (data.type === "individual") {
      requireText(data.firstName, "firstName");
      requireText(data.lastName, "lastName");
      return;
    }

    if (data.type === "government") {
      // Entity name + the contact person submitting on its behalf.
      requireText(data.companyName, "companyName");
      requireText(data.fullName, "fullName");
      return;
    }

    // Facility — the representative is the contact for the invitation.
    requireText(data.companyName, "companyName");
    requireText(data.representativeName, "representativeName");
    requireText(data.nationalAddress, "nationalAddress");
    requireText(data.crCertificate, "crCertificate");
    requireText(data.vatCertificate, "vatCertificate");

    if (digits(data.unifiedNumber).length !== 10) {
      ctx.addIssue({
        code: "custom",
        message: "Unified number must be 10 digits (700-series)",
        path: ["unifiedNumber"],
      });
    }
    if (digits(data.crNumber).length !== 10) {
      ctx.addIssue({
        code: "custom",
        message: "CR number must be 10 digits",
        path: ["crNumber"],
      });
    }
    if (digits(data.vatNumber).length !== 15) {
      ctx.addIssue({
        code: "custom",
        message: "VAT number must be 15 digits",
        path: ["vatNumber"],
      });
    }
  });

export type PartnerRequestInput = z.infer<typeof partnerRequestSchema>;

export const partnerRejectionSchema = z.object({
  rejectionReason: z
    .string()
    .min(1, "Reject reason is required")
    .max(2000),
});

export type PartnerRejectionInput = z.infer<typeof partnerRejectionSchema>;
