import { useState } from "react";
import { type KeyboardTypeOptions, StyleSheet, TextInput } from "react-native";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type TextFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
};

export const TextField = ({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "none",
  editable = true,
}: TextFieldProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      editable={editable}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.input, focused ? styles.focused : null]}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
});
