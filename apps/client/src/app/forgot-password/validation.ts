import { z } from "zod";

// Step 1 — the account's email, where the reset code is sent.
export const forgotPasswordRequestSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type ForgotPasswordRequestInput = z.infer<
  typeof forgotPasswordRequestSchema
>;

// Step 2 — the emailed code plus the new password.
export const forgotPasswordResetSchema = z
  .object({
    code: z.string().min(1, "Enter the code we emailed you"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ForgotPasswordResetInput = z.infer<
  typeof forgotPasswordResetSchema
>;
