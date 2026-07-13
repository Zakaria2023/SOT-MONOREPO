import { z } from "zod";

// Social sign-ups can complete as an individual or a facility (government is a
// separate, admin-approved flow).
export const completeProfileTypes = ["individual", "facility"] as const;

const digits = (value: string | undefined) => (value ?? "").replace(/\D/g, "");

export const completeProfileSchema = z
  .object({
    type: z.enum(completeProfileTypes),

    firstName: z.string().max(255).optional(),
    middleName: z.string().max(255).optional(),
    lastName: z.string().max(255).optional(),

    unifiedNumber: z.string().max(30).optional(),
    crNumber: z.string().max(30).optional(),
    vatNumber: z.string().max(30).optional(),
    nationalAddress: z.string().max(1000).optional(),
    crCertificate: z.string().max(64).optional(),
    vatCertificate: z.string().max(64).optional(),
    representativeName: z.string().max(255).optional(),
    representativeMobile: z.string().max(30).optional(),
    representativeEmail: z.string().max(255).optional(),

    // Where to send the user once their profile is complete.
    next: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const req = (value: string | undefined, path: string) => {
      if (!value || value.trim().length === 0) {
        ctx.addIssue({ code: "custom", message: "Required", path: [path] });
      }
    };

    if (data.type === "individual") {
      req(data.firstName, "firstName");
      req(data.lastName, "lastName");
      return;
    }

    req(data.representativeName, "representativeName");
    req(data.nationalAddress, "nationalAddress");
    req(data.crCertificate, "crCertificate");
    req(data.vatCertificate, "vatCertificate");
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

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
