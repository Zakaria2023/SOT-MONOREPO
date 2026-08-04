import { StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { colors, fonts, spacing, tabular, tracking, type } from "@/lib/theme";
import type { Order } from "@/lib/types";

type OrderCardProps = {
  order: Order;
  // The order just placed, marked so the buyer lands on something they recognise
  // rather than on a list where their order looks like every other row.
  highlighted?: boolean;
  /** Last in the list — no rule beneath. */
  last?: boolean;
};

// The buyer's own words for each state. The API sends the stored value, and
// showing "awaiting_payment" to a customer is showing them our column.
//
// These four ARE the `orderStatuses` enum — kept in step with db/label.ts by hand,
// because the app cannot import from `db`. Inventing a fifth would be worse than
// useless: it would never render, while the real state it was meant to cover fell
// through to the raw column value.
const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_TONE: Record<string, "primary" | "success" | "danger"> = {
  paid: "success",
  cancelled: "danger",
  refunded: "danger",
};

export const OrderCard = ({
  order,
  highlighted,
  last = false,
}: OrderCardProps) => (
  <View
    style={[
      styles.row,
      last ? null : styles.divided,
      highlighted ? styles.highlighted : null,
    ]}
  >
    <View style={styles.top}>
      <Text style={styles.reference} numberOfLines={1}>
        {order.reference}
      </Text>
      <Badge
        label={STATUS_LABELS[order.status ?? ""] ?? order.status ?? "Draft"}
        tone={STATUS_TONE[order.status ?? ""] ?? "primary"}
      />
    </View>
    {order.boqReference ? (
      <Text style={styles.source}>From {order.boqReference}</Text>
    ) : null}
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>Total</Text>
      <Text style={styles.total}>
        {formatMoney(Number(order.grandTotal), order.currency ?? "SAR")}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  // A gold rule down the left edge, indented from the page. A gold box around the
  // whole entry would have been a second border competing with the hairlines.
  highlighted: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.md,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  reference: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.title.size,
    lineHeight: type.title.line,
    ...tabular,
  },
  source: {
    color: colors.faint,
    fontFamily: fonts.bodyItalic,
    fontSize: type.caption.size,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  totalLabel: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
  },
  total: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.heading.size,
    lineHeight: type.heading.line,
    ...tabular,
  },
});
