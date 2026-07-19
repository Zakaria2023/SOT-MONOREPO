import {
  type KeyboardTypeOptions,
  StyleSheet,
  TextInput,
} from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

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
}: TextFieldProps) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={colors.muted}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    editable={editable}
    style={styles.input}
  />
);

const styles = StyleSheet.create({
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
  },
});
