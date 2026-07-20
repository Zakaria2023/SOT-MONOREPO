import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type BadgeProps = {
  label: string;
  tone?: "primary" | "neutral" | "success";
};

// Tinted rounded-full pill, matching the client's count/status badges.
export const Badge = ({ label, tone = "primary" }: BadgeProps) => (
  <View style={[styles.badge, styles[`${tone}Bg`]]}>
    <Text style={[styles.text, styles[`${tone}Text`]]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  primaryBg: {
    backgroundColor: colors.primaryTint,
  },
  primaryText: {
    color: colors.primary,
  },
  neutralBg: {
    backgroundColor: colors.surfaceGlass,
  },
  neutralText: {
    color: colors.muted,
  },
  successBg: {
    backgroundColor: "rgba(52,226,155,0.14)",
  },
  successText: {
    color: colors.success,
  },
});
