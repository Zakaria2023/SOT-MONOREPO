import { z } from "zod";

// Whole-number percentage, 0–100. Fields use valueAsNumber, so the value is
// already a number by the time it reaches the resolver — only numbers pass.
const percentField = z
  .number()
  .int("Whole numbers only")
  .min(0, "Min 0")
  .max(100, "Max 100");

export const partnerDiscountsSchema = z.object({
  system_integrator: percentField,
  stock: percentField,
  install_program: percentField,
  install_only: percentField,
  pre_sell: percentField,
  post_sell: percentField,
});

export type PartnerDiscountsFormValues = z.infer<typeof partnerDiscountsSchema>;
