import type { ComponentType } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fonts, radius, spacing, type } from "@/lib/theme";

type IconType = ComponentType<{ color: string; size: number }>;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "md" | "lg";
  icon?: IconType;
  /** Where the icon sits. Forward actions read better with it trailing. */
  iconSide?: "leading" | "trailing";
  full?: boolean;
};

/**
 * Every button is a 1px outline on the paper. Nothing is filled.
 *
 * `primary` is the gold outline — the only thing separating it from a secondary
 * action is which colour the hairline and the label are. A solid block of gold
 * would be the loudest thing on any screen it appeared on, which is the opposite
 * of what an accent is for, and it would be the only filled shape in a language
 * built entirely from rules.
 *
 * `danger` is likewise an outline. A filled red button in this palette reads as
 * an error state that has already happened rather than an action you may take.
 */
export const Button = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "lg",
  icon: Icon,
  iconSide = "leading",
  full = true,
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  const contentColor =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
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
        // Pressed is one ramp step darker, not an opacity fade: fading an outline
        // makes the hairline disappear rather than respond.
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} size="small" />
      ) : (
        <View style={styles.content}>
          {Icon && iconSide === "leading" ? (
            <Icon color={contentColor} size={17} />
          ) : null}
          <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
          {Icon && iconSide === "trailing" ? (
            <Icon color={contentColor} size={17} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: "transparent",
  },
  full: { alignSelf: "stretch" },
  auto: { alignSelf: "flex-start" },
  // 48/44 — the spec's 44px floor, with the larger size still comfortable.
  lg: { height: 48 },
  md: { height: 44, paddingHorizontal: spacing.lg },
  primary: { borderColor: colors.primaryBorder },
  dangerVariant: { borderColor: colors.danger },
  outline: { borderColor: colors.border },
  ghost: { borderColor: "transparent" },
  pressed: { backgroundColor: colors.pressed },
  disabled: { opacity: 0.4 },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: type.body.size,
    letterSpacing: 0.2,
  },
});
