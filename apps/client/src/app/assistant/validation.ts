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
