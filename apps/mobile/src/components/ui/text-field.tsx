import { useState } from "react";
import { type KeyboardTypeOptions, StyleSheet, TextInput } from "react-native";
import { colors, fonts, spacing, type } from "@/lib/theme";

type TextFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
};

/**
 * A ruled line to write on.
 *
 * The filled box with a 1px border was the only inset control in the app, and on
 * focus it turned gold-tinted — a field that changes colour when you touch it reads
 * as a validation state. Now the rule under it thickens to gold instead.
 */
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
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.body.size,
  },
  focused: { borderBottomColor: colors.primary },
});
