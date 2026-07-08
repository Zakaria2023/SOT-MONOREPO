import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required").max(255),
    email: z.string().email("Enter a valid email address").max(255),
    phone: z.string().min(1, "Phone number is required").max(30),
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
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address").max(255),
  password: z.string().min(1, "Password is required"),
  keepSignedIn: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
