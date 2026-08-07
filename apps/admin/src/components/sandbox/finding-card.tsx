"use client";

import type { DesignFinding, DesignQuestion } from "services";
import { QuestionField } from "@/components/sandbox/question-field";
import type { ProjectAnswers } from "@/db/types";
import { CircleHelp, TriangleAlert, Wrench } from "lucide-react";

// ---------------------------------------------------------------------------
// One finding, as the buyer would meet it, with the questions that would change
// it sitting inside it rather than in a block of their own.
//
// That placement is the whole point of `DesignQuestion.affects`. A list of
// questions detached from the findings they clear reads as a form to fill in;
// beside the finding, it reads as "answer this and this verdict may change",
// which is the only reason the buyer would bother.
// ---------------------------------------------------------------------------

type FindingCardProps = {
  finding: DesignFinding;
  // Resolved against the basket on screen — the finding carries uuids, because
  // the engine has no business duplicating names the caller already has.
  nameOf: (uuid: string) => string;
  questions: DesignQuestion[];
  answers: ProjectAnswers;
  onAnswer: (uuid: string, value: number | boolean | null) => void;
};

const TONE_STYLE: Record<DesignFinding["tone"], string> = {
  block: "border-red-500/30 bg-red-500/10 text-red-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  unknown: "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

const TONE_LABEL: Record<DesignFinding["tone"], string> = {
  block: "Blocks the order",
  warn: "Warns the buyer",
  unknown: "Could not be judged",
};

export const FindingCard = ({
  finding,
  nameOf,
  questions,
  answers,
  onAnswer,
}: FindingCardProps) => (
  <div
    className={`flex flex-col gap-2.5 rounded-card border px-3 py-2.5 ${TONE_STYLE[finding.tone]}`}
  >
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-medium">{finding.title}</span>
      <span className="shrink-0 text-[10px] font-semibold tracking-wide uppercase">
        {TONE_LABEL[finding.tone]}
      </span>
    </div>

    {/* The buyer's own words, verbatim. If this sentence does not make sense
        here, it will not make sense at checkout either. */}
    <p className="text-xs">{finding.message}</p>

    {finding.failingProductUuids.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {finding.failingProductUuids.map((uuid) => (
          <span
            key={uuid}
            className="rounded-control bg-black/10 px-2 py-0.5 text-[11px]"
          >
            {nameOf(uuid)}
          </span>
        ))}
      </div>
    )}

    {/* Never swallowed: an item the rule matched but could not read is the one
        failure mode that otherwise looks exactly like approval. */}
    {finding.skipped.length > 0 && (
      <div className="flex flex-col gap-0.5 rounded-control border border-hairline px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium">
          <TriangleAlert size={12} />
          Matched but missing values
        </span>
        {finding.skipped.map((item) => (
          <p key={item.productUuid} className="text-[11px]">
            {item.name} — no {item.missing.join(", ")}
          </p>
        ))}
      </div>
    )}

    {finding.corrections.length > 0 && (
      <div className="flex flex-col gap-1 rounded-control border border-hairline px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium">
          <Wrench size={12} />
          What would fix it
        </span>
        {finding.corrections.map((correction) => (
          <div key={correction.message} className="flex flex-col gap-0.5">
            <p className="text-[11px]">{correction.message}</p>
            {correction.products.map((product) => (
              <p key={product.productUuid} className="pl-3 text-[11px] opacity-80">
                {product.name}
              </p>
            ))}
          </div>
        ))}
      </div>
    )}

    {questions.length > 0 && (
      <div className="flex flex-col gap-2 rounded-control border border-hairline px-2.5 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium">
          <CircleHelp size={12} />
          Answering this could change the verdict
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {questions.map((question) => (
            <QuestionField
              key={question.uuid}
              question={question}
              answers={answers}
              onAnswer={onAnswer}
            />
          ))}
        </div>
      </div>
    )}
  </div>
);
