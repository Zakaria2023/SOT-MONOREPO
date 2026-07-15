"use server";

import { openai, OPENAI_MODEL } from "@/lib/server/openai-client";
import { SALES_ASSISTANT_SYSTEM_PROMPT } from "@/lib/server/sales-assistant-prompt";
import { assistantReplyJsonSchema, assistantReplySchema } from "./validation";
import type { AssistantReply, ChatMessageInput } from "./validation";

const MAX_HISTORY_TURNS = 10;
const MAX_IMAGES_PER_MESSAGE = 4;

export type ChatTurn =
  | { role: "user"; content: string; images?: string[] }
  | { role: "assistant"; content: AssistantReply };

export type ChatState = {
  history: ChatTurn[];
  error?: string;
};

const toOpenAiMessages = (history: ChatTurn[]) =>
  history.map((turn) => {
    if (turn.role === "assistant") {
      return { role: "assistant" as const, content: JSON.stringify(turn.content) };
    }

    const attachmentNote = turn.images?.length
      ? ` [attached ${turn.images.length} photo${turn.images.length > 1 ? "s" : ""}]`
      : "";
    return { role: "user" as const, content: `${turn.content}${attachmentNote}` };
  });

const buildUserContent = (message: string, images: string[]) => {
  if (images.length === 0) return message;

  return [
    { type: "text" as const, text: message },
    ...images
      .slice(0, MAX_IMAGES_PER_MESSAGE)
      .map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
};

export const sendChatMessage = async (
  prevState: ChatState,
  data: ChatMessageInput,
): Promise<ChatState> => {
  const images = data.images.slice(0, MAX_IMAGES_PER_MESSAGE);
  if (!data.message.trim() && images.length === 0) {
    return prevState;
  }

  const recentHistory = prevState.history.slice(-MAX_HISTORY_TURNS);
  const userTurn: ChatTurn = { role: "user", content: data.message, images };
  const historyWithUserTurn = [...recentHistory, userTurn].slice(
    -MAX_HISTORY_TURNS,
  );

  let rawReply: string | null;
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SALES_ASSISTANT_SYSTEM_PROMPT },
        ...toOpenAiMessages(recentHistory),
        { role: "user", content: buildUserContent(data.message, images) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "assistant_reply",
          schema: assistantReplyJsonSchema,
          strict: true,
        },
      },
    });
    rawReply = completion.choices[0]?.message.content ?? null;
  } catch {
    return {
      history: historyWithUserTurn,
      error: "The assistant is unavailable right now. Please try again.",
    };
  }

  if (!rawReply) {
    return {
      history: historyWithUserTurn,
      error: "The assistant didn't return a response. Please try again.",
    };
  }

  let parsedReply: unknown;
  try {
    parsedReply = JSON.parse(rawReply);
  } catch {
    return {
      history: historyWithUserTurn,
      error: "The assistant returned an invalid response. Please try again.",
    };
  }

  const result = assistantReplySchema.safeParse(parsedReply);
  if (!result.success) {
    return {
      history: historyWithUserTurn,
      error: "The assistant returned an invalid response. Please try again.",
    };
  }

  const assistantTurn: ChatTurn = { role: "assistant", content: result.data };

  return {
    history: [...historyWithUserTurn, assistantTurn].slice(
      -MAX_HISTORY_TURNS,
    ),
  };
};
