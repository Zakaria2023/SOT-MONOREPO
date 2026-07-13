import { z } from "zod";

// A user signs up with exactly one identifier — email or phone — so Clerk knows
// where to send the verification code.
export const signUpMethods = ["email", "phone"] as const;
export type SignUpMethod = (typeof signUpMethods)[number];

export const registerSchema = z
  .object({
    method: z.enum(signUpMethods),
    fullName: z.string().min(1, "Full name is required").max(255),
    email: z.string().max(255).optional(),
    phone: z.string().max(30).optional(),
    companyName: z.string().max(255).optional(),
    location: z.string().max(255).optional(),
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
    if (data.method === "email") {
      if (!z.string().email().safeParse(data.email ?? "").success) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid email address",
          path: ["email"],
        });
      }
    } else if (!data.phone || data.phone.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Phone number is required",
        path: ["phone"],
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  // Email or phone — matched against whichever identifier the user signed up with.
  identifier: z.string().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Password is required"),
  keepSignedIn: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
