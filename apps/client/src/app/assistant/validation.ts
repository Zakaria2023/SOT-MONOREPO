import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z.string().max(2000, "Keep it under 2000 characters"),
});

export type ChatMessageFormValues = z.infer<typeof chatMessageSchema>;

export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_SOURCE_BYTES = 8 * 1024 * 1024;

export const chatAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataUrl: z.string().startsWith("data:image/"),
});

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

export type ChatMessageInput = {
  message: string;
  images: string[];
};

const valuePointsSchema = z.object({
  benefits: z.array(z.string()),
  features: z.array(z.string()),
  useCases: z.array(z.string()),
});

const salesLeadSchema = z.object({
  intent: z.literal("purchase"),
  product: z.string(),
  confidence: z.number().min(0).max(1),
  status: z.literal("pending_sales_review"),
  next_step: z.literal("send_to_salesman"),
});

export const assistantReplySchema = z.object({
  answer: z.string(),
  valuePoints: z.nullable(valuePointsSchema),
  recommendation: z.nullable(z.string()),
  salesLead: z.nullable(salesLeadSchema),
});

export type AssistantReply = z.infer<typeof assistantReplySchema>;
export type SalesLead = z.infer<typeof salesLeadSchema>;

export const assistantReplyJsonSchema = z.toJSONSchema(assistantReplySchema);
