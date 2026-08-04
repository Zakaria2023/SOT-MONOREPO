import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, tracking, type } from "@/lib/theme";

type BadgeProps = {
  label: string;
  tone?: "primary" | "neutral" | "success" | "danger" | "warning";
};

/**
 * A state, set in letterspaced caps inside a hairline.
 *
 * It was a tinted block, and a screen listing eight orders showed eight coloured
 * chips — which made the state the loudest thing in every row rather than the
 * reference the buyer was looking for. The tint is gone; the hairline and the
 * label carry the colour.
 */
export const Badge = ({ label, tone = "neutral" }: BadgeProps) => (
  <View style={[styles.badge, TONES[tone].box]}>
    <Text style={[styles.text, TONES[tone].text]}>{label}</Text>
  </View>
);

const TONES = {
  primary: {
    box: { borderColor: colors.primaryBorder },
    text: { color: colors.primary },
  },
  neutral: {
    box: { borderColor: colors.border },
    text: { color: colors.muted },
  },
  success: {
    box: { borderColor: colors.success },
    text: { color: colors.success },
  },
  danger: {
    box: { borderColor: colors.danger },
    text: { color: colors.danger },
  },
  warning: {
    box: { borderColor: colors.warning },
    text: { color: colors.warning },
  },
} as const;

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: type.kicker.size,
    lineHeight: type.kicker.line,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
  },
});
