import { StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { colors, fonts, radius, shadow, spacing } from "@/lib/theme";
import type { Order } from "@/lib/types";

type OrderCardProps = {
  order: Order;
  // The order just placed, lifted so the buyer lands on something they recognise
  // rather than on a list where their order looks like every other row.
  highlighted?: boolean;
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

export const OrderCard = ({ order, highlighted }: OrderCardProps) => (
  <View style={[styles.card, highlighted ? styles.highlighted : null]}>
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
    <View style={styles.divider} />
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>Total</Text>
      <Text style={styles.total}>
        {formatMoney(Number(order.grandTotal), order.currency ?? "SAR")}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  highlighted: { borderColor: colors.primary },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  reference: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  source: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  total: {
    color: colors.text,
    fontFamily: fonts.monoBold,
    fontSize: 20,
  },
});
