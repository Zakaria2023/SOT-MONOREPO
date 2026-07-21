"use server";

import { runSalesAssistantTurn } from "services";
import type { AssistantReply, SalesAssistantHistoryTurn } from "services";
import type { ChatMessageInput } from "./validation";

const MAX_HISTORY_TURNS = 10;
const MAX_IMAGES_PER_MESSAGE = 4;

export type ChatTurn =
  | { role: "user"; content: string; images?: string[] }
  | { role: "assistant"; content: AssistantReply };

export type ChatState = {
  history: ChatTurn[];
  error?: string;
};

const toHistoryTurns = (history: ChatTurn[]): SalesAssistantHistoryTurn[] =>
  history.map((turn) =>
    turn.role === "assistant"
      ? { role: "assistant", content: turn.content }
      : { role: "user", content: turn.content, imageCount: turn.images?.length },
  );

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

  try {
    const reply = await runSalesAssistantTurn({
      history: toHistoryTurns(recentHistory),
      message: data.message,
      images,
    });

    const assistantTurn: ChatTurn = { role: "assistant", content: reply };
    return {
      history: [...historyWithUserTurn, assistantTurn].slice(
        -MAX_HISTORY_TURNS,
      ),
    };
  } catch (error) {
    return {
      history: historyWithUserTurn,
      error:
        error instanceof Error
          ? error.message
          : "The assistant is unavailable right now. Please try again.",
    };
  }
};
