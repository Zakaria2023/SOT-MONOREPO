import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");

// Fake-payment card fields. Validated client-side only so the demo feels real —
// the card never leaves the browser; the server action only settles the order.
export const fakePaymentSchema = z.object({
  cardName: z.string().min(1, "Name on card is required").max(120),
  cardNumber: z
    .string()
    .refine(
      (value) => digits(value).length >= 15 && digits(value).length <= 19,
      "Enter a valid card number",
    ),
  expiry: z
    .string()
    .refine((value) => /^\d{2}\/\d{2}$/.test(value.trim()), "Use MM/YY"),
  cvc: z
    .string()
    .refine(
      (value) => /^\d{3,4}$/.test(value.trim()),
      "Enter the 3–4 digit CVC",
    ),
});

export type FakePaymentInput = z.infer<typeof fakePaymentSchema>;
