import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/lib/theme";

type SectionHeaderProps = {
  title: string;
  onSeeAll?: () => void;
};

export const SectionHeader = ({ title, onSeeAll }: SectionHeaderProps) => (
  <View style={styles.row}>
    <Text style={styles.title}>{title}</Text>
    {onSeeAll ? (
      <Pressable style={styles.link} onPress={onSeeAll}>
        <Text style={styles.linkText}>See all</Text>
        <ChevronRight color={colors.primary} size={16} />
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
});
