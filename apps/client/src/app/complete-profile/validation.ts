import { z } from "zod";

export const completeProfileSchema = z.object({
  location: z.string().min(1, "Please select your location"),
  // Where to send the user once their profile is complete. Kept in the form so
  // the checkout flow can return them to the cart.
  next: z.string().optional(),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
