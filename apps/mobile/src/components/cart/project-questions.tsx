import { MessageCircleQuestion } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, radius, spacing } from "@/lib/theme";
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
};

const QuestionRow = ({ question, answer, onAnswer }: QuestionRowProps) => (
  <View style={styles.question}>
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
              style={[styles.choice, active ? styles.choiceActive : null]}
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
        placeholderTextColor={colors.faint}
        // An emptied field un-answers the question rather than answering zero,
        // which is a real number a rule would happily compare against.
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, "");
          onAnswer(digits === "" ? undefined : Number(digits));
        }}
        style={styles.input}
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
    <View style={styles.card}>
      <View style={styles.header}>
        <MessageCircleQuestion color={colors.primary} size={16} />
        <Text style={styles.heading}>
          {questions.length === 1
            ? "One question about your project"
            : `${questions.length} questions about your project`}
        </Text>
      </View>
      <Text style={styles.hint}>
        About the site, not the products. Answering lets us finish the checks.
      </Text>
      {questions.map((question) => (
        <QuestionRow
          key={question.uuid}
          question={question}
          answer={answers[question.uuid]}
          onAnswer={(value) => answer(question.uuid, value)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    // Tinted, so a block asking for input does not read as one more panel
    // reporting something.
    backgroundColor: colors.primaryTint,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heading: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  hint: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  question: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  label: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  unit: { color: colors.faint },
  choices: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  choice: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  choiceLabelActive: { color: colors.onAccent },
  input: {
    width: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: "right",
  },
});
