"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { sendChatMessage } from "./actions";
import type { ChatState } from "./actions";
import { useAttachedImages } from "./use-attached-images";
import { chatMessageSchema } from "./validation";
import type { ChatMessageFormValues } from "./validation";

const initialState: ChatState = { history: [] };

export const useSalesAssistantChat = () => {
  const [state, dispatch, isPending] = useActionState(
    sendChatMessage,
    initialState,
  );

  const attachments = useAttachedImages();

  const form = useForm<ChatMessageFormValues>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { message: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!values.message.trim() && attachments.images.length === 0) {
      form.setError("message", { message: "Type a message or attach a photo" });
      return;
    }

    const images = attachments.images.map((image) => image.dataUrl);
    startTransition(() => {
      dispatch({ message: values.message, images });
    });
    form.reset();
    attachments.clear();
  });

  return { form, state, isPending, onSubmit, attachments };
};
