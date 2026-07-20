import { LinearGradient } from "expo-linear-gradient";
import type { ComponentType } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fonts, gradient, radius, shadow, spacing } from "@/lib/theme";

type IconType = ComponentType<{ color: string; size: number }>;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
  icon?: IconType;
};

// Primary buttons use the signature accent gradient with dark ink on top and a
// soft colored glow — matching the client's hero/CTA treatment.
export const Button = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  icon: Icon,
}: ButtonProps) => {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const isDisabled = disabled || loading;
  const contentColor = isPrimary
    ? colors.onGradient
    : isGhost
      ? colors.muted
      : colors.text;

  const inner = loading ? (
    <ActivityIndicator color={contentColor} />
  ) : (
    <View style={styles.content}>
      {Icon ? <Icon color={contentColor} size={18} /> : null}
      <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
    </View>
  );

  if (isPrimary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.glowWrap,
          !isDisabled ? shadow.glow : null,
          pressed && !isDisabled ? styles.pressed : null,
          isDisabled ? styles.disabled : null,
        ]}
      >
        <LinearGradient
          colors={gradient.accent}
          start={gradient.start}
          end={gradient.end}
          style={styles.base}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isGhost ? styles.ghost : styles.outline,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      {inner}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  glowWrap: {
    borderRadius: radius.control,
  },
  base: {
    height: 52,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
