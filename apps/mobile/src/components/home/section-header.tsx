import { Pressable, StyleSheet, Text, View } from "react-native";
import { Kicker } from "@/components/ui/editorial";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  onSeeAll?: () => void;
};

/**
 * A section opener: gold kicker, serif title, and a quiet "ALL" link.
 *
 * The link lost its arrow icon and its bold. In this language a call to action is
 * an underlined uppercase word — an icon beside it competes with the gold kicker
 * two lines above for the same small amount of attention.
 */
export const SectionHeader = ({
  eyebrow,
  title,
  onSeeAll,
}: SectionHeaderProps) => (
  <View style={styles.wrap}>
    <View style={styles.row}>
      <View style={styles.headings}>
        <Kicker label={eyebrow} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {onSeeAll ? (
        <Pressable
          style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
          onPress={onSeeAll}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>All</Text>
        </Pressable>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  headings: { flex: 1, gap: spacing.sm },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.heading.size,
    lineHeight: type.heading.line,
  },
  link: {
    minHeight: 44,
    justifyContent: "flex-end",
    paddingBottom: 3,
  },
  pressed: { opacity: 0.6 },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: type.kicker.size,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
    paddingBottom: 2,
  },
});
