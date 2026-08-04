import { StyleSheet, Text, View } from "react-native";
import type { ProductSpec } from "@/lib/types";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";

type SpecTableProps = {
  specs: ProductSpec[];
  /** Omit the section heading where the screen already announced the table. */
  heading?: string | null;
};

type Group = {
  name: string | null;
  rows: { label: string; value: string }[];
};

// Values arrive already formatted, by the same renderer the engine uses to
// explain a finding — so a spec row and a design message can never describe the
// same value two different ways, and the app carries no copy of the option
// labels or units.
//
// Sectioned by library group, groups in first-seen order so the table reads the
// way the library is organised. Ungrouped attributes trail behind.
const groupSpecs = (specs: ProductSpec[]): Group[] =>
  specs.reduce<Group[]>((groups, spec) => {
    if (!spec.value) {
      return groups;
    }
    const row = { label: spec.label, value: spec.value };
    const existing = groups.find((group) => group.name === spec.groupName);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ name: spec.groupName, rows: [row] });
    }
    return groups;
  }, []);

/**
 * The specification table: a group heading, then label/value rows on hairlines.
 *
 * Each group was a bordered card with a fill, which turned a five-group product
 * into five stacked panels. A specification table is the most table-like thing in
 * the app and it wants ruled rows, the way a datasheet prints them.
 */
export const SpecTable = ({
  specs,
  heading = "Specifications",
}: SpecTableProps) => {
  const groups = groupSpecs(specs);
  if (groups.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      {groups.map((group) => (
        <View key={group.name ?? "ungrouped"} style={styles.group}>
          {group.name ? (
            <Text style={styles.groupName}>{group.name}</Text>
          ) : null}
          <View style={styles.rows}>
            {group.rows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.row,
                  index === group.rows.length - 1 ? null : styles.divided,
                ]}
              >
                <Text style={styles.label} numberOfLines={2}>
                  {row.label}
                </Text>
                <Text style={styles.value} numberOfLines={3}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  heading: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.heading.size,
    lineHeight: type.heading.line,
  },
  group: { gap: spacing.sm },
  groupName: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  rows: { borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: {
    flex: 1,
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
  },
  value: {
    flexShrink: 0,
    maxWidth: "58%",
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
    textAlign: "right",
  },
});
