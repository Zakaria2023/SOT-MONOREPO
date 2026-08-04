import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  onSeeAll?: () => void;
};

/**
 * A section opener: a grey letterspaced label, a serif title, and a quiet "ALL".
 *
 * The label is grey and ruleless, unlike the gold Kicker that opens a screen. With
 * every section leading on a gold rule, four of them stacked down the home screen
 * and the accent stopped being one — the gold that matters here is the "ALL" you
 * can actually press.
 *
 * The link has no arrow and no bold. In this language a call to action is an
 * underlined uppercase word.
 */
export const SectionHeader = ({
  eyebrow,
  title,
  onSeeAll,
}: SectionHeaderProps) => (
  <View style={styles.wrap}>
    <View style={styles.row}>
      <View style={styles.headings}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {onSeeAll ? (
        <Pressable
          style={({ pressed }) => [
            styles.link,
            pressed ? styles.pressed : null,
          ]}
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
  eyebrow: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    lineHeight: type.kicker.line,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.display.size,
    lineHeight: type.display.line,
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
