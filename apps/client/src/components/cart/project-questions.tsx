"use client";

import type { DesignQuestion } from "@/app/cart/actions";
import { MessageCircleQuestion } from "lucide-react";
import type { ProjectAnswersInput } from "validators";

type ProjectQuestionsProps = {
  questions: DesignQuestion[];
  answers: ProjectAnswersInput;
  onChange: (answers: ProjectAnswersInput) => void;
};

type QuestionRowProps = {
  question: DesignQuestion;
  answer: number | boolean | undefined;
  onAnswer: (value: number | boolean | undefined) => void;
};

const QuestionRow = ({ question, answer, onAnswer }: QuestionRowProps) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <label
      htmlFor={`question-${question.uuid}`}
      className="font-grotesk text-sm text-indigo-900"
    >
      {question.label}
      {question.unit && (
        <span className="text-indigo-700 opacity-80"> ({question.unit})</span>
      )}
    </label>

    {question.kind === "toggle" ? (
      // Three states, not a checkbox: unanswered, yes and no are genuinely
      // different, and a checkbox starting empty would record "no" for a buyer
      // who has not read the question yet.
      <div className="flex items-center gap-2" id={`question-${question.uuid}`}>
        {[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={answer === option.value}
            onClick={() =>
              onAnswer(answer === option.value ? undefined : option.value)
            }
            className={
              answer === option.value
                ? "font-grotesk rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white"
                : "font-grotesk rounded-full border border-indigo-200 bg-white px-4 py-1.5 text-xs font-medium text-indigo-800 transition-colors hover:border-indigo-400"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    ) : (
      <input
        id={`question-${question.uuid}`}
        type="number"
        min={0}
        inputMode="numeric"
        value={typeof answer === "number" ? answer : ""}
        // An emptied field un-answers the question rather than answering it
        // zero — zero is a real number a rule would happily compare against.
        onChange={(event) =>
          onAnswer(
            event.target.value === "" ? undefined : Number(event.target.value),
          )
        }
        className="font-grotesk w-28 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-right text-sm tabular-nums text-ink outline-none focus:border-indigo-400"
      />
    )}
  </div>
);

/**
 * The project questions this basket needs answered.
 *
 * Only the ones a rule that engaged with THIS cart actually reads — the library
 * may hold a dozen, and asking a buyer with three cameras about PBX capacity
 * teaches them to skip the whole block. Each answer re-runs the check, so a
 * finding clears in front of them.
 */
export const ProjectQuestions = ({
  questions,
  answers,
  onChange,
}: ProjectQuestionsProps) => {
  if (questions.length === 0) {
    return null;
  }

  const answer = (uuid: string, value: number | boolean | undefined) => {
    const next = { ...answers };
    if (value === undefined) {
      delete next[uuid];
    } else {
      next[uuid] = value;
    }
    onChange(next);
  };

  return (
    <section className="rounded-[18px] border border-indigo-200 bg-indigo-50 p-5">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion size={18} className="text-indigo-600" />
        <h2 className="font-heading text-base text-indigo-900">
          {questions.length === 1
            ? "One question about your project"
            : `${questions.length} questions about your project`}
        </h2>
      </div>
      <p className="font-grotesk mt-1 text-xs text-indigo-700">
        These are not on the products — they are about the site. Answering them
        lets us finish the checks above.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {questions.map((question) => (
          <QuestionRow
            key={question.uuid}
            question={question}
            answer={answers[question.uuid]}
            onAnswer={(value) => answer(question.uuid, value)}
          />
        ))}
      </div>
    </section>
  );
};
