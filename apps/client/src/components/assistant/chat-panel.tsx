"use client";

import { useSalesAssistantChat } from "@/app/assistant/use-sales-assistant-chat";
import { ChatInputForm } from "./chat-input-form";
import { ChatMessageList } from "./chat-message-list";

export const ChatPanel = () => {
  const { form, state, isPending, onSubmit, attachments } = useSalesAssistantChat();

  return (
    <div className="flex h-96 w-80 flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-lg">
      <div className="border-b border-hairline px-4 py-3">
        <p className="font-heading text-base font-bold text-ink">chatbot</p>
        <p className="text-xs text-muted">Ask about our products</p>
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
