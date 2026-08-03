import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formatPrice } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import type { ComparisonRow, ProductComparison } from "@/lib/types";

type CompareTableProps = {
  products: ProductComparison["products"];
  rows: ComparisonRow[];
};

type Section = {
  name: string | null;
  rows: ComparisonRow[];
};

// Column width is fixed so every cell in a row lines up under its header while
// the table scrolls sideways. A phone cannot fit three columns of specs, and
// wrapping the values instead would put the comparison out of alignment — which
// is the one thing a compare table has to get right.
const COLUMN_WIDTH = 132;
const LABEL_WIDTH = 148;

// Sectioned by library group in first-seen order, the same way the spec table and
// the web compare table are, so the three read alike.
const groupRows = (rows: ComparisonRow[]): Section[] =>
  rows.reduce<Section[]>((sections, row) => {
    const existing = sections.find((section) => section.name === row.groupName);
    if (existing) {
      existing.rows.push(row);
    } else {
      sections.push({ name: row.groupName, rows: [row] });
    }
    return sections;
  }, []);

export const CompareTable = ({ products, rows }: CompareTableProps) => (
  <ScrollView
    style={styles.page}
    contentContainerStyle={styles.pageContent}
    showsVerticalScrollIndicator={false}
  >
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.headerRow}>
          <View style={styles.labelCell} />
          {products.map((product) => (
            <View key={product.uuid} style={styles.headerCell}>
              <Text style={styles.headerName} numberOfLines={3}>
                {product.name}
              </Text>
              <Text style={styles.headerPrice}>
                {formatPrice(product.price, product.currency)}
              </Text>
            </View>
          ))}
        </View>

        {groupRows(rows).map((section) => (
          <View key={section.name ?? "ungrouped"} style={styles.section}>
            {section.name ? (
              <Text style={styles.sectionName}>{section.name}</Text>
            ) : null}
            {section.rows.map((row, index) => (
              <View
                key={row.uuid}
                style={[styles.row, index > 0 && styles.rowDivided]}
              >
                <Text
                  style={[styles.labelCell, styles.label]}
                  numberOfLines={3}
                >
                  {row.label}
                </Text>
                {products.map((product) => (
                  <Text
                    key={product.uuid}
                    style={styles.value}
                    numberOfLines={3}
                  >
                    {/* Absent means this product is silent on the row, or the
                        reveal hid it — a dash, decided here rather than sent as
                        one, so a gap never reads as a stored value. */}
                    {row.values[product.uuid] ?? "—"}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  </ScrollView>
);

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerCell: {
    width: COLUMN_WIDTH,
    gap: 2,
  },
  headerName: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
  headerPrice: {
    color: colors.primary,
    fontFamily: fonts.monoBold,
    fontSize: 14,
  },
  section: { marginTop: spacing.md },
  sectionName: {
    color: colors.faint,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
  },
  rowDivided: { marginTop: spacing.xs },
  labelCell: { width: LABEL_WIDTH },
  label: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  value: {
    width: COLUMN_WIDTH,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
