import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";

type ListStateProps = {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyLabel: string;
  onRetry: () => void;
};

/**
 * The loading / error / empty placeholder for a data screen, or null when there is
 * data to show.
 *
 * The 64px circled icon is gone. A crossed-out box in a ring is app furniture, and
 * on a page made of type and rules it was the only illustration in the product — a
 * short gold rule over one line of type says the same thing in the page's voice.
 */
export const ListState = ({
  loading,
  error,
  empty,
  emptyLabel,
  onRetry,
}: ListStateProps) => {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <View style={[styles.rule, styles.ruleBad]} />
        <Text style={styles.kickerBad}>Something went wrong</Text>
        <Text style={styles.error}>{error}</Text>
        <Button
          label="Try again"
          variant="outline"
          full={false}
          onPress={onRetry}
        />
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <View style={styles.rule} />
        <Text style={styles.muted}>{emptyLabel}</Text>
      </View>
    );
  }
  return null;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  rule: { width: 22, height: 1, backgroundColor: colors.primary },
  ruleBad: { backgroundColor: colors.danger },
  kickerBad: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: type.kicker.size,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  error: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    textAlign: "center",
  },
  // Italic, because an empty list is an aside rather than a statement.
  muted: {
    color: colors.muted,
    fontFamily: fonts.bodyItalic,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    textAlign: "center",
  },
});
