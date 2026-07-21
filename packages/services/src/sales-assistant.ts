import { z } from "zod";
import type OpenAI from "openai";
import { openai, OPENAI_MODEL } from "./openai-client";
import { SALES_ASSISTANT_SYSTEM_PROMPT } from "./sales-assistant-prompt";
import {
  fetchVendorProductInfo,
  vendorArgsSchema,
  vendorLookupToolDefinition,
} from "./vendor-lookup";

type ChatMessage = OpenAI.ChatCompletionMessageParam;

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

// valuePoints/recommendation stay nullable — a past bug made them required,
// which forced the model to invent product-shaped filler on off-topic
// messages (there was no legitimate way to leave them empty). Do not
// tighten this back up.
export const assistantReplySchema = z.object({
  answer: z.string(),
  valuePoints: z.nullable(valuePointsSchema),
  recommendation: z.nullable(z.string()),
  salesLead: z.nullable(salesLeadSchema),
});

export type AssistantReply = z.infer<typeof assistantReplySchema>;
export type SalesLead = z.infer<typeof salesLeadSchema>;

export const assistantReplyJsonSchema = z.toJSONSchema(assistantReplySchema);

export type SalesAssistantHistoryTurn =
  | { role: "user"; content: string; imageCount?: number }
  | { role: "assistant"; content: AssistantReply };

export type SalesAssistantTurnInput = {
  history: SalesAssistantHistoryTurn[];
  message: string;
  images: string[];
};

const MAX_TOOL_ITERATIONS = 4;
const MAX_IMAGES_PER_MESSAGE = 4;

const toOpenAiMessages = (history: SalesAssistantHistoryTurn[]): ChatMessage[] =>
  history.map((turn) => {
    if (turn.role === "assistant") {
      return { role: "assistant", content: JSON.stringify(turn.content) };
    }

    const attachmentNote = turn.imageCount
      ? ` [attached ${turn.imageCount} photo${turn.imageCount > 1 ? "s" : ""}]`
      : "";
    return { role: "user", content: `${turn.content}${attachmentNote}` };
  });

const buildUserContent = (
  message: string,
  images: string[],
): OpenAI.ChatCompletionUserMessageParam["content"] => {
  if (images.length === 0) {
    return message;
  }

  return [
    { type: "text", text: message },
    ...images
      .slice(0, MAX_IMAGES_PER_MESSAGE)
      .map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
};

const runVendorLookupToolCall = async (
  toolCall: OpenAI.ChatCompletionMessageToolCall,
): Promise<string> => {
  if (toolCall.type !== "function") {
    return "Unsupported tool call type.";
  }

  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch {
    return "Invalid tool arguments — could not parse.";
  }

  const parsedVendor = vendorArgsSchema.safeParse(parsedArgs);
  if (!parsedVendor.success) {
    return "Invalid tool arguments — unknown vendor.";
  }

  const lookup = await fetchVendorProductInfo(parsedVendor.data.vendor);
  return lookup.text;
};

// Agentic RAG entry point. Mirrors the router → RAG_LOOKUP → "Judge:
// Sufficient?" → WEB_SEARCH (loop) → ANSWER / GREETING design, but as a
// single bounded OpenAI tool-calling loop rather than a literal multi-node
// graph — see the LangGraph scaffold at the bottom of this file for why.
export const runSalesAssistantTurn = async (
  input: SalesAssistantTurnInput,
): Promise<AssistantReply> => {
  const messages: ChatMessage[] = [
    { role: "system", content: SALES_ASSISTANT_SYSTEM_PROMPT },
    ...toOpenAiMessages(input.history),
    { role: "user", content: buildUserContent(input.message, input.images) },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    let completion: OpenAI.ChatCompletion;
    try {
      completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        tools: [vendorLookupToolDefinition],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "assistant_reply",
            schema: assistantReplyJsonSchema,
            strict: true,
          },
        },
      });
    } catch {
      throw new Error(
        "The assistant is unavailable right now. Please try again.",
      );
    }

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      throw new Error(
        "The assistant didn't return a response. Please try again.",
      );
    }

    // ROUTER + "Judge: Sufficient?" — whether the model emits tool_calls at
    // all (greeting/direct-answer vs needs-KB), and whether it calls the
    // tool again after seeing a result, is the model's own judgment call
    // each iteration. No separate classifier call is needed.
    const toolCalls = responseMessage.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      messages.push(responseMessage);

      // RAG_LOOKUP / WEB_SEARCH — the same action today, since there's no
      // product database yet: the vendor-site fetch *is* the knowledge
      // base. See vendor-lookup.ts's commented scaffold for where a real
      // DB-backed RAG_LOOKUP would eventually split off from this.
      for (const toolCall of toolCalls) {
        const resultText = await runVendorLookupToolCall(toolCall);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultText,
        });
      }

      continue;
    }

    // ANSWER / GREETING — no more tool calls requested, this is the final
    // turn. A greeting or an already-answerable question lands here on the
    // first iteration; a product question lands here only after the tool
    // loop above ran.
    if (!responseMessage.content) {
      throw new Error(
        "The assistant didn't return a response. Please try again.",
      );
    }

    let parsedReply: unknown;
    try {
      parsedReply = JSON.parse(responseMessage.content);
    } catch {
      throw new Error(
        "The assistant returned an invalid response. Please try again.",
      );
    }

    const result = assistantReplySchema.safeParse(parsedReply);
    if (!result.success) {
      throw new Error(
        "The assistant returned an invalid response. Please try again.",
      );
    }

    return result.data;
  }

  throw new Error(
    "The assistant needs more information than it could gather right now — please try rephrasing your question.",
  );
};

// =============================================================================
// FUTURE REFERENCE — NOT INSTALLED, NOT EXECUTED, NOT WIRED IN.
// =============================================================================
//
// The literal LangGraph version of the diagram this feature is based on,
// mirroring each node 1:1. Worth adopting once there are genuinely 3+
// distinct retrieval/decision node types (today RAG_LOOKUP and WEB_SEARCH
// are the same action — see vendor-lookup.ts) or once LangSmith-style
// per-node tracing is worth more than the extra dependency/latency of a
// real graph walk for every turn, including plain greetings.
//
// import { ChatOpenAI } from "@langchain/openai";
// import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
// import { tool } from "@langchain/core/tools";
//
// const AgentState = Annotation.Root({
//   messages: Annotation<BaseMessage[]>({ reducer: (a, b) => a.concat(b) }),
//   route: Annotation<"greeting" | "direct_answer" | "needs_kb">(),
//   retrieved: Annotation<string | null>(),
//   sufficient: Annotation<boolean>(),
// });
//
// const model = new ChatOpenAI({ model: OPENAI_MODEL });
//
// const lookupVendorTool = tool(
//   async ({ vendor }) => (await fetchVendorProductInfo(vendor)).text,
//   { name: "lookup_vendor_products", schema: vendorArgsSchema },
// );
//
// const routerNode = async (state: typeof AgentState.State) => {
//   // classify: greeting | direct_answer | needs_kb
// };
// const ragLookupNode = async (state: typeof AgentState.State) => {
//   // today: same as webSearchNode. Once a real DB/vector store exists,
//   // this becomes searchProductKnowledgeBase() from vendor-lookup.ts.
// };
// const judgeNode = async (state: typeof AgentState.State) => {
//   // score `retrieved` against the question; set `sufficient`
// };
// const webSearchNode = async (state: typeof AgentState.State) => {
//   // wraps the real fetchVendorProductInfo() from vendor-lookup.ts
// };
// const answerNode = async (state: typeof AgentState.State) => {
//   // final structured reply, same assistantReplySchema as today
// };
// const greetingNode = async (state: typeof AgentState.State) => {
//   // lightweight canned-style reply, skips retrieval entirely
// };
//
// const graph = new StateGraph(AgentState)
//   .addNode("router", routerNode)
//   .addNode("rag_lookup", ragLookupNode)
//   .addNode("judge", judgeNode)
//   .addNode("web_search", webSearchNode)
//   .addNode("answer", answerNode)
//   .addNode("greeting", greetingNode)
//   .addEdge(START, "router")
//   .addConditionalEdges("router", (s) =>
//     s.route === "greeting" ? "greeting" : s.route === "direct_answer" ? "answer" : "rag_lookup",
//   )
//   .addEdge("rag_lookup", "judge")
//   .addConditionalEdges("judge", (s) => (s.sufficient ? "answer" : "web_search"))
//   .addEdge("web_search", "judge")
//   .addEdge("answer", END)
//   .addEdge("greeting", END)
//   .compile();
//
// export const runSalesAssistantTurnViaLangGraph = (input: SalesAssistantTurnInput) =>
//   graph.invoke({ messages: [...] });
//
// =============================================================================
// END FUTURE REFERENCE
// =============================================================================

// =============================================================================
// FUTURE REFERENCE — NOT INSTALLED, NOT EXECUTED, NOT WIRED IN.
// =============================================================================
//
// BOQ drafting. Deliberately not a live field on assistantReplySchema yet —
// the assistant has no way to resolve a free-text product mention to a real
// productUuid without a catalog lookup, and a wrong resolution here is worse
// than no BOQ at all. Sketch of the eventual shape and orchestration:
//
// const boqLineSchema = z.object({
//   product: z.string(),
//   productUuid: z.string(), // resolved, not model-invented
//   quantity: z.number().int().positive(),
//   role: z.enum(["anchor", "peripheral", "accessory"]),
//   unitPrice: z.number(), // from the catalog, never the model
//   lineTotal: z.number(),
// });
// const boqDraftSchema = z.object({
//   sections: z.array(z.object({
//     system: z.string(),
//     lines: z.array(boqLineSchema),
//     subtotal: z.number(),
//   })),
//   grandTotal: z.number(),
// });
//
// // If adopted: boqDraft: z.nullable(boqDraftSchema) on assistantReplySchema,
// // following the same "nullable, never fabricate" discipline as
// // valuePoints/recommendation above.
//
// // Orchestration sketch:
// // 1. Model mentions products in free text during the conversation.
// // 2. Resolve each mention against the real catalog — getProducts({ search })
// //    / getProductDetailBySlug() from ./products — never trust the model for
// //    SKUs or prices. Flag unresolved mentions rather than guessing a match.
// // 3. Once the user confirms a resolved set of lines, call into the real
// //    packages/services/src/boq.ts (see createBoqFromCart) — likely needs a
// //    new sibling function there, since createBoqFromCart's precondition is
// //    an existing cart, which an AI-drafted BOQ doesn't have yet.
// //
// // Open question, not solved here: how confident does a fuzzy product-name
// // match need to be before it's shown to the user as "resolved" vs flagged
// // for manual disambiguation?
//
// =============================================================================
// END FUTURE REFERENCE
// =============================================================================
