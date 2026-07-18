"use client";

import { Sparkles } from "lucide-react";
import { useSalesAssistantChat } from "@/app/assistant/use-sales-assistant-chat";
import { ChatInputForm } from "./chat-input-form";
import { ChatMessageList } from "./chat-message-list";

export const ChatPage = () => {
  const { form, state, isPending, onSubmit, attachments } =
    useSalesAssistantChat();

  return (
    <div className="mx-auto flex h-[calc(100dvh-4.5rem)] w-full max-w-3xl flex-col border-x border-hairline bg-surface">
      <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary text-white">
          <Sparkles size={18} />
        </span>
        <div>
          <p className="font-heading text-lg font-bold text-ink">chatbot</p>
          <p className="text-sm text-muted">Ask about our products</p>
        </div>
      </div>
      <ChatMessageList history={state.history} error={state.error} />
      <ChatInputForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        attachments={attachments}
      />
    </div>
  );
};
