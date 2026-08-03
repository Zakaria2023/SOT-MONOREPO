import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, type } from "@/lib/theme";

type BadgeProps = {
  label: string;
  tone?: "primary" | "neutral" | "success" | "danger" | "warning";
};

// A small tinted label. Squarer than a full pill — at this size a pill reads
// as decoration, a soft rectangle reads as data.
export const Badge = ({ label, tone = "neutral" }: BadgeProps) => (
  <View style={[styles.badge, TONES[tone].box]}>
    <Text style={[styles.text, TONES[tone].text]}>{label}</Text>
  </View>
);

const TONES = {
  primary: {
    box: {
      backgroundColor: colors.primaryTint,
      borderColor: colors.primaryBorder,
    },
    text: { color: colors.primary },
  },
  neutral: {
    box: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
    text: { color: colors.muted },
  },
  success: {
    box: { backgroundColor: colors.successTint, borderColor: "transparent" },
    text: { color: colors.success },
  },
  danger: {
    box: { backgroundColor: colors.dangerTint, borderColor: "transparent" },
    text: { color: colors.danger },
  },
  warning: {
    box: { backgroundColor: colors.warningTint, borderColor: "transparent" },
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
    fontFamily: fonts.semibold,
    fontSize: type.micro.size,
    lineHeight: type.micro.line,
    letterSpacing: 0.2,
  },
});
