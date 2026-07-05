"use client";

import { MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";

export const SalesAssistantWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen ? <ChatPanel /> : null}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close chatbot" : "Open chatbot"}
        className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
};
