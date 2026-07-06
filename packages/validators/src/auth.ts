import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(255),
  email: z.string().email("Enter a valid email address").max(255),
  phone: z.string().min(1, "Phone number is required").max(30),
  companyName: z.string().max(255).optional(),
  location: z.string().max(255).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(255),
});

export type RegisterInput = z.infer<typeof registerSchema>;
