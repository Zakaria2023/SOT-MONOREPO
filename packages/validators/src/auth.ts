import { z } from "zod";

// A user verifies with exactly one identifier — email or phone — so Clerk knows
// where to send the code.
export const signUpMethods = ["email", "phone"] as const;
export type SignUpMethod = (typeof signUpMethods)[number];

// Types that self-serve a Clerk account at sign-up. "government" is a separate
// request flow (see government schema) and never reaches this form.
export const signUpAccountTypes = ["individual", "facility"] as const;
export type SignUpAccountType = (typeof signUpAccountTypes)[number];

const digits = (value: string | undefined) => (value ?? "").replace(/\D/g, "");

export const signUpSchema = z
  .object({
    type: z.enum(signUpAccountTypes),
    method: z.enum(signUpMethods),

    // Individual identity + name.
    firstName: z.string().max(255).optional(),
    middleName: z.string().max(255).optional(),
    lastName: z.string().max(255).optional(),
    email: z.string().max(255).optional(),
    phone: z.string().max(30).optional(),
    // City + country, captured for every account type.
    location: z.string().max(255).optional(),

    // Facility business fields.
    unifiedNumber: z.string().max(30).optional(),
    crNumber: z.string().max(30).optional(),
    vatNumber: z.string().max(30).optional(),
    nationalAddress: z.string().max(1000).optional(),
    crCertificate: z.string().max(64).optional(),
    vatCertificate: z.string().max(64).optional(),
    representativeName: z.string().max(255).optional(),
    representativeMobile: z.string().max(30).optional(),
    representativeEmail: z.string().max(255).optional(),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(255),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    const requireEmail = (value: string | undefined, path: string) => {
      if (!z.string().email().safeParse(value ?? "").success) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid email address",
          path: [path],
        });
      }
    };
    const requirePhone = (value: string | undefined, path: string) => {
      if (!value || value.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Phone number is required",
          path: [path],
        });
      }
    };
    const requireText = (value: string | undefined, path: string) => {
      if (!value || value.trim().length === 0) {
        ctx.addIssue({ code: "custom", message: "Required", path: [path] });
      }
    };

    if (data.type === "individual") {
      requireText(data.firstName, "firstName");
      requireText(data.lastName, "lastName");
      requireText(data.location, "location");
      if (data.method === "email") {
        requireEmail(data.email, "email");
      } else {
        requirePhone(data.phone, "phone");
      }
      return;
    }

    // Facility — the representative's email/phone is the login identity.
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
    if (data.method === "email") {
      requireEmail(data.representativeEmail, "representativeEmail");
    } else {
      requirePhone(data.representativeMobile, "representativeMobile");
    }
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  // Email or phone — matched against whichever identifier the user signed up with.
  identifier: z.string().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Password is required"),
  keepSignedIn: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
