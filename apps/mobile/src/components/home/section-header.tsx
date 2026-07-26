import { ArrowRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Eyebrow } from "@/components/ui/eyebrow";
import { colors, fonts, spacing } from "@/lib/theme";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  onSeeAll?: () => void;
};

export const SectionHeader = ({
  eyebrow,
  title,
  onSeeAll,
}: SectionHeaderProps) => (
  <View style={styles.wrap}>
    <View style={styles.row}>
      <View style={styles.headings}>
        <Eyebrow label={eyebrow} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {onSeeAll ? (
        <Pressable style={styles.link} onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.linkText}>All</Text>
          <ArrowRight color={colors.primary} size={15} />
        </Pressable>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headings: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 30,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 4,
  },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
