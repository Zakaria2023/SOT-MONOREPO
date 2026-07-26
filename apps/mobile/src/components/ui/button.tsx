import type { ComponentType } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fonts, radius, shadow, spacing, type } from "@/lib/theme";

type IconType = ComponentType<{ color: string; size: number }>;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "md" | "lg";
  icon?: IconType;
  full?: boolean;
};

// A flat, solid primary. The old one was a three-stop gradient carrying a
// coloured glow, which drew more attention than whatever it sat beside — on a
// light UI one confident block of accent reads louder than a gradient, not
// quieter.
export const Button = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "lg",
  icon: Icon,
  full = true,
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  const contentColor =
    variant === "primary" || variant === "danger"
      ? colors.onAccent
      : variant === "ghost"
        ? colors.muted
        : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === "lg" ? styles.lg : styles.md,
        full ? styles.full : styles.auto,
        variant === "primary" ? styles.primary : null,
        variant === "danger" ? styles.dangerVariant : null,
        variant === "outline" ? styles.outline : null,
        variant === "ghost" ? styles.ghost : null,
        variant === "primary" && !isDisabled ? shadow.glow : null,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} size="small" />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon color={contentColor} size={18} /> : null}
          <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  full: { alignSelf: "stretch" },
  auto: { alignSelf: "flex-start" },
  lg: { height: 52 },
  md: { height: 42, paddingHorizontal: spacing.lg },
  primary: { backgroundColor: colors.primary },
  dangerVariant: { backgroundColor: colors.danger },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: { backgroundColor: "transparent" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  // Flat when disabled — a shadow under something you cannot press reads as a
  // rendering bug.
  disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: type.body.size,
    letterSpacing: 0.1,
  },
});
