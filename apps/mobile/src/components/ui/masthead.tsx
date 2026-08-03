import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";

type MastheadProps = {
  /** The running head on the right — "Account", "Solutions", "Catalogue". */
  label?: string;
  /** A standing line beside the wordmark, used on the home screen only. */
  tagline?: string;
  /** Icon actions, which take the right side in place of the label. */
  children?: ReactNode;
};

/**
 * The running head every screen opens with: wordmark left, one quiet thing right.
 *
 * It was copied into three screens before this, which is how the home screen ended
 * up with a different baseline and letterspacing from the profile screen. The right
 * slot takes either a label or icons — never both, because a title page has one
 * running head, not two competing ones.
 */
export const Masthead = ({ label, tagline, children }: MastheadProps) => (
  <View style={styles.row}>
    <View style={styles.left}>
      <Text style={styles.wordmark}>SOT</Text>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>

    {children ? (
      <View style={styles.actions}>{children}</View>
    ) : label ? (
      <Text style={styles.label}>{label}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  left: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
    flexShrink: 1,
  },
  wordmark: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: tracking.wordmark,
    textTransform: "uppercase",
  },
  tagline: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  label: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
});
