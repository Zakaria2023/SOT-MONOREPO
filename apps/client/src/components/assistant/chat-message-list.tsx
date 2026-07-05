import { Clock } from "lucide-react";
import Image from "next/image";
import type { AssistantReply } from "@/app/assistant/validation";
import type { ChatTurn } from "@/app/assistant/actions";

type ChatMessageListProps = {
  history: ChatTurn[];
  error?: string;
};

type UserMessageProps = {
  content: string;
  images?: string[];
};

type AssistantMessageProps = {
  reply: AssistantReply;
};

type ValuePointGroupProps = {
  title: string;
  items: string[];
};

const ValuePointGroup = ({ title, items }: ValuePointGroupProps) => {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

const UserMessage = ({ content, images }: UserMessageProps) => (
  <div className="ml-auto flex max-w-[85%] flex-col gap-1.5">
    {images && images.length > 0 ? (
      <div className="flex flex-wrap justify-end gap-1.5">
        {images.map((src, index) => (
          <Image
            key={index}
            src={src}
            alt="Attached photo"
            width={96}
            height={96}
            className="h-24 w-24 rounded-card border border-hairline object-cover"
          />
        ))}
      </div>
    ) : null}
    {content ? (
      <div className="rounded-card bg-primary px-4 py-2 text-sm text-white">
        {content}
      </div>
    ) : null}
  </div>
);

const AssistantMessage = ({ reply }: AssistantMessageProps) => (
  <div className="max-w-[85%] rounded-card border border-hairline bg-surface px-4 py-3 text-sm text-ink">
    <p>{reply.answer}</p>

    {reply.valuePoints ? (
      <div className="mt-3 space-y-2">
        <ValuePointGroup title="Benefits" items={reply.valuePoints.benefits} />
        <ValuePointGroup title="Features" items={reply.valuePoints.features} />
        <ValuePointGroup title="Use cases" items={reply.valuePoints.useCases} />
      </div>
    ) : null}

    {reply.recommendation ? (
      <p className="mt-3 text-secondary">{reply.recommendation}</p>
    ) : null}

    {reply.salesLead ? (
      <div className="mt-3 flex items-center gap-2 rounded-control bg-warning-tint px-3 py-2 text-xs text-warning">
        <Clock size={14} />
        <span>Sent to our sales team for review — awaiting confirmation.</span>
      </div>
    ) : null}
  </div>
);

export const ChatMessageList = ({ history, error }: ChatMessageListProps) => (
  <div className="flex-1 space-y-3 overflow-y-auto bg-page p-4">
    {history.length === 0 ? (
      <p className="text-sm text-muted">
        Hi! Ask me about our products and I can help you find the right fit.
      </p>
    ) : null}
    {history.map((turn, index) =>
      turn.role === "user" ? (
        <UserMessage key={index} content={turn.content} images={turn.images} />
      ) : (
        <AssistantMessage key={index} reply={turn.content} />
      ),
    )}
    {error ? <p className="text-sm text-danger">{error}</p> : null}
  </div>
);
