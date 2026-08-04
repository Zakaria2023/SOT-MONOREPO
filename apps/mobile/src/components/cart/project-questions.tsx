import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Kicker } from "@/components/ui/editorial";
import { colors, fonts, radius, spacing, tabular, type } from "@/lib/theme";
import type { DesignQuestion, ProjectAnswers } from "@/lib/types";

type ProjectQuestionsProps = {
  questions: DesignQuestion[];
  answers: ProjectAnswers;
  onChange: (answers: ProjectAnswers) => void;
};

type QuestionRowProps = {
  question: DesignQuestion;
  answer: number | boolean | undefined;
  onAnswer: (value: number | boolean | undefined) => void;
  last?: boolean;
};

const QuestionRow = ({
  question,
  answer,
  onAnswer,
  last = false,
}: QuestionRowProps) => (
  <View style={[styles.question, last ? null : styles.divided]}>
    <Text style={styles.label}>
      {question.label}
      {question.unit ? (
        <Text style={styles.unit}> ({question.unit})</Text>
      ) : null}
    </Text>

    {question.kind === "toggle" ? (
      // Yes/No as two buttons rather than a switch: unanswered, yes and no are
      // three different states, and a switch starting off would record "no" for a
      // buyer who has not read the question.
      <View style={styles.choices}>
        {[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ].map((option) => {
          const active = answer === option.value;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onAnswer(active ? undefined : option.value)}
              style={({ pressed }) => [
                styles.choice,
                active ? styles.choiceActive : null,
                pressed ? styles.choicePressed : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceLabel,
                  active ? styles.choiceLabelActive : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ) : (
      <TextInput
        keyboardType="number-pad"
        value={typeof answer === "number" ? String(answer) : ""}
        placeholder="—"
        placeholderTextColor={colors.placeholder}
        // An emptied field un-answers the question rather than answering zero,
        // which is a real number a rule would happily compare against.
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, "");
          onAnswer(digits === "" ? undefined : Number(digits));
        }}
        style={styles.input}
        accessibilityLabel={question.label}
      />
    )}
  </View>
);

/**
 * The project questions this basket needs answered — the same ones the web cart
 * asks, from the same check.
 *
 * Only what a rule touching THIS cart reads: the library may hold a dozen inputs,
 * and asking a buyer with three cameras about PBX capacity teaches them to skip
 * the block. Each answer re-runs the check, so a finding clears in front of them.
 *
 * The gold-tinted card is gone. It was the only filled panel left on the screen,
 * and a block asking for input does not need a highlight to be found — it needs
 * the ruled rows that make it obvious there are fields here.
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
    <View style={styles.block}>
      <Kicker
        label={
          questions.length === 1
            ? "One question about your project"
            : `${questions.length} questions about your project`
        }
      />
      <Text style={styles.hint}>
        About the site, not the products. Answering lets us finish the checks.
      </Text>
      <View style={styles.rows}>
        {questions.map((question, index) => (
          <QuestionRow
            key={question.uuid}
            question={question}
            answer={answers[question.uuid]}
            onAnswer={(value) => answer(question.uuid, value)}
            last={index === questions.length - 1}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  hint: {
    color: colors.faint,
    fontFamily: fonts.bodyItalic,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
  },
  rows: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  question: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.line,
  },
  unit: { color: colors.faint, fontFamily: fonts.bodyItalic },
  choices: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  // Outlines at 4px, and the chosen one is gold hairline plus gold label — a
  // filled gold Yes was the loudest thing in the cart.
  choice: {
    minWidth: 52,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceActive: { borderColor: colors.primaryBorder },
  choicePressed: { backgroundColor: colors.pressed },
  choiceLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
  },
  choiceLabelActive: { color: colors.primary, fontFamily: fonts.medium },
  // A ruled line to write on, like the catalogue search field.
  input: {
    width: 96,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    textAlign: "right",
    ...tabular,
  },
});
