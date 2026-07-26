import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing } from "@/lib/theme";

type EyebrowProps = {
  label: string;
};

// The client's signature section label: a glowing accent dot + an uppercase,
// wide-tracked, primary-colored micro-heading above every section.
export const Eyebrow = ({ label }: EyebrowProps) => (
  <View style={styles.row}>
    <View style={styles.dot} />
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  label: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
