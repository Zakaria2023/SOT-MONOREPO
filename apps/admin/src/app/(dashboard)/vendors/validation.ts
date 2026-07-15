import { vendorStatuses } from "@/db/enum";
import { z } from "zod";

export const vendorFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  idLabel: z.string().min(1, "ID label is required").max(100),
  status: z.enum(vendorStatuses),
  parentUuid: z.string().optional(),
  notes: z.string().optional(),
});

export type VendorFormValues = z.infer<typeof vendorFormSchema>;
