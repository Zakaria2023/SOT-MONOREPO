import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { generateUuid } from "utils";
import { db } from "../../../db";
import type { ExpertQueue, ExpertRequestStatus } from "../../../db/enum";
import {
  ExpertRequests,
  type SelectExpertRequests,
} from "../../../db/schema/expert-requests";
import type { ProjectAnswers, ScenarioLine } from "../../../db/types";
import { ConflictError, ValidationError } from "./errors";

export type { SelectExpertRequests };

// ---------------------------------------------------------------------------
// A12 — THE EXPERT DESK.
//
// Where a question goes when the system cannot answer it. Two queues, one
// lifecycle:
//
//   design_help      a buyer stuck on a design, carrying the exact basket and
//                    answers they were looking at.
//   document_review  a datasheet the importer could not read. This is the
//                    deterministic stand-in for automated document
//                    interpretation — a person reads it, and what they decide is
//                    recorded rather than inferred.
//
// CLAIMING IS THE POINT OF THE STATUS MODEL. Without it two experts open the
// same question, both answer, and a customer gets two replies that disagree. So
// answering requires holding the claim, and a claim can only be taken from an
// unclaimed request.
// ---------------------------------------------------------------------------

export type AskInput = {
  queue: ExpertQueue;
  subject: string;
  body: string;
  asker: { clerkUserId: string | null; name: string | null };
  // design_help: what they were looking at when they got stuck.
  selection?: ScenarioLine[];
  variables?: ProjectAnswers;
  // document_review: what they want read.
  documentId?: string;
};

export type QueueCounts = Record<ExpertQueue, number>;

const REFERENCE_PREFIX: Record<ExpertQueue, string> = {
  design_help: "ASK",
  document_review: "DOC",
};

/**
 * Raise a question.
 *
 * A design question with no selection is accepted rather than refused: somebody
 * may be asking before they have built anything, and turning them away at the
 * one moment they admitted they were stuck is the wrong trade. The queue shows
 * the absence instead.
 */
export const askExpert = async (input: AskInput): Promise<string> => {
  if (input.subject.trim() === "" || input.body.trim() === "") {
    throw new ValidationError("A question needs a subject and a description.");
  }
  if (input.queue === "document_review" && !input.documentId) {
    throw new ValidationError("A document review needs a document.");
  }

  const uuid = generateUuid();
  await db.insert(ExpertRequests).values({
    uuid,
    reference: `${REFERENCE_PREFIX[input.queue]}-${uuid.slice(0, 8).toUpperCase()}`,
    queue: input.queue,
    subject: input.subject.trim(),
    body: input.body.trim(),
    askedByClerkUserId: input.asker.clerkUserId,
    askedByName: input.asker.name,
    selection: input.selection ?? null,
    variables: input.variables ?? null,
    documentId: input.documentId ?? null,
  });
  return uuid;
};

/** One queue, oldest first — the person waiting longest is served first. */
export const listQueue = async (
  queue: ExpertQueue,
  status?: ExpertRequestStatus,
): Promise<SelectExpertRequests[]> =>
  db
    .select()
    .from(ExpertRequests)
    .where(
      status
        ? and(eq(ExpertRequests.queue, queue), eq(ExpertRequests.status, status))
        : eq(ExpertRequests.queue, queue),
    )
    .orderBy(asc(ExpertRequests.createdAt));

/** How many are still waiting in each queue. */
export const openCounts = async (): Promise<QueueCounts> => {
  const rows = await db
    .select({
      queue: ExpertRequests.queue,
      waiting: sql<number>`COUNT(*)`,
    })
    .from(ExpertRequests)
    .where(eq(ExpertRequests.status, "open"))
    .groupBy(ExpertRequests.queue);

  const counts: QueueCounts = { design_help: 0, document_review: 0 };
  for (const row of rows) {
    counts[row.queue] = Number(row.waiting);
  }
  return counts;
};

export const getExpertRequest = async (
  uuid: string,
): Promise<SelectExpertRequests | null> => {
  const [row] = await db
    .select()
    .from(ExpertRequests)
    .where(eq(ExpertRequests.uuid, uuid));
  return row ?? null;
};

/**
 * Take a question.
 *
 * The claim and the check are one statement: `WHERE status = 'open' AND
 * claimed_by IS NULL`. Reading first and then writing would let two experts both
 * see it unclaimed and both take it, which is the exact failure the status
 * exists to prevent — and the affected-row count is what says whether this
 * caller won.
 */
export const claimExpertRequest = async (
  uuid: string,
  expert: { name: string },
): Promise<void> => {
  const result = await db
    .update(ExpertRequests)
    .set({
      status: "claimed",
      claimedBy: expert.name,
      claimedAt: new Date(),
    })
    .where(
      and(
        eq(ExpertRequests.uuid, uuid),
        eq(ExpertRequests.status, "open"),
        isNull(ExpertRequests.claimedBy),
      ),
    );

  // drizzle/mysql2 reports affected rows here. Zero means somebody else has it.
  const affected = (result as unknown as { affectedRows?: number }[])[0]
    ?.affectedRows;
  if (affected === 0) {
    throw new ConflictError(
      "Somebody else is already looking at this one.",
    );
  }
};

/** Hand it back, so it returns to the queue rather than sitting on a desk. */
export const releaseExpertRequest = async (uuid: string): Promise<void> => {
  await db
    .update(ExpertRequests)
    .set({ status: "open", claimedBy: null, claimedAt: null })
    .where(
      and(eq(ExpertRequests.uuid, uuid), eq(ExpertRequests.status, "claimed")),
    );
};

/**
 * Answer it.
 *
 * Only the holder of the claim may. An answer from somebody who never took the
 * question is how two replies end up on one thread, and the person who did take
 * it never finds out theirs was not the only one.
 */
export const answerExpertRequest = async (
  uuid: string,
  expert: { name: string },
  answer: string,
): Promise<void> => {
  if (answer.trim() === "") {
    throw new ValidationError("An answer cannot be empty.");
  }

  const request = await getExpertRequest(uuid);
  if (!request) {
    throw new ValidationError("That question no longer exists.");
  }
  if (request.status !== "claimed") {
    throw new ConflictError(
      "Take this question first — that is what stops two people answering it.",
    );
  }
  if (request.claimedBy !== expert.name) {
    throw new ConflictError(
      `${request.claimedBy} is looking at this one.`,
    );
  }

  await db
    .update(ExpertRequests)
    .set({
      status: "answered",
      answer: answer.trim(),
      answeredBy: expert.name,
      answeredAt: new Date(),
    })
    .where(eq(ExpertRequests.uuid, uuid));
};

/** Everything this person has asked, newest first. */
export const listMyQuestions = async (
  clerkUserId: string,
): Promise<SelectExpertRequests[]> =>
  db
    .select()
    .from(ExpertRequests)
    .where(eq(ExpertRequests.askedByClerkUserId, clerkUserId))
    .orderBy(desc(ExpertRequests.createdAt));
