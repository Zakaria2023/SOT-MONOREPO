import { StyleSheet, Text, View } from "react-native";
import type { ProductSpec } from "@/lib/types";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import { formatSpecValue } from "@/lib/format";

type SpecTableProps = {
  specs: ProductSpec[];
  values: Record<string, string>;
};

type Group = {
  name: string | null;
  rows: { label: string; value: string }[];
};

// Sectioned by library group, groups in first-seen order so the table reads
// the way the library is organised. Ungrouped attributes trail behind.
const groupSpecs = (
  specs: ProductSpec[],
  values: Record<string, string>,
): Group[] =>
  specs.reduce<Group[]>((groups, spec) => {
    const value = formatSpecValue(values[spec.key], spec.unit);
    if (!value) {
      return groups;
    }
    const row = { label: spec.label, value };
    const existing = groups.find((group) => group.name === spec.groupName);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ name: spec.groupName, rows: [row] });
    }
    return groups;
  }, []);

export const SpecTable = ({ specs, values }: SpecTableProps) => {
  const groups = groupSpecs(specs, values);
  if (groups.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Specifications</Text>
      {groups.map((group) => (
        <View key={group.name ?? "ungrouped"} style={styles.group}>
          {group.name ? (
            <Text style={styles.groupName}>{group.name}</Text>
          ) : null}
          <View style={styles.card}>
            {group.rows.map((row, index) => (
              <View
                key={row.label}
                style={[styles.row, index > 0 && styles.rowDivided]}
              >
                <Text style={styles.label} numberOfLines={2}>
                  {row.label}
                </Text>
                <Text style={styles.value} numberOfLines={2}>
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
  wrap: { gap: spacing.md, marginTop: spacing.xl },
  heading: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  group: { gap: spacing.sm },
  groupName: {
    color: colors.faint,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  value: {
    flexShrink: 0,
    maxWidth: "55%",
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: "right",
  },
});
