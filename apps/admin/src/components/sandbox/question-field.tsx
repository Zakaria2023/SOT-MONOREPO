"use client";

import type { DesignQuestion } from "services";
import { Field } from "@/components/shared/field";
import type { ProjectAnswers } from "@/db/types";
import { Dropdown, Input } from "ui";

// One project input, rendered from how a rule USES it rather than from how it
// was declared — a `magnitude` wants a number, a `toggle` wants yes or no. That
// distinction is already made for us in `DesignQuestion.kind`.

type QuestionFieldProps = {
  question: DesignQuestion;
  answers: ProjectAnswers;
  onAnswer: (uuid: string, value: number | boolean | null) => void;
};

export const QuestionField = ({
  question,
  answers,
  onAnswer,
}: QuestionFieldProps) => {
  const current = answers[question.uuid];

  // Blank means "unanswered", which is not the same as zero — an unanswered
  // input falls back to its default, and with no default the rule does not run.
  // So clearing a box has to remove the key, not set it to 0.
  if (question.kind === "toggle") {
    return (
      <Field label={question.label}>
        <Dropdown
          value={current === undefined ? "" : current ? "true" : "false"}
          onChange={(next) =>
            onAnswer(question.uuid, next === "" ? null : next === "true")
          }
          options={[
            { value: "", label: "Not answered" },
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          placeholder="Not answered"
        />
      </Field>
    );
  }

  return (
    <Input
      label={question.label}
      type="number"
      value={current === undefined ? "" : String(current)}
      onChange={(event) =>
        onAnswer(
          question.uuid,
          event.target.value === "" ? null : Number(event.target.value),
        )
      }
      rightSlot={
        question.unit ? (
          <span className="text-xs text-faint">{question.unit}</span>
        ) : undefined
      }
    />
  );
};
