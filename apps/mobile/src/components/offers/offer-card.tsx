import { StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { colors, fonts, spacing, tabular, tracking, type } from "@/lib/theme";
import type { Offer } from "@/lib/types";

type OfferCardProps = {
  offer: Offer;
  /** Last in the list — no rule beneath, so the list does not end on a line. */
  last?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  selected: "Selected",
};

/** A quote, as a ruled entry: reference, state, description, total. */
export const OfferCard = ({ offer, last = false }: OfferCardProps) => {
  const total =
    Number(offer.productPrice ?? 0) + Number(offer.installPrice ?? 0);

  return (
    <View style={[styles.row, last ? null : styles.divided]}>
      <View style={styles.top}>
        <Text style={styles.reference} numberOfLines={1}>
          {offer.boqReference ?? "BOQ offer"}
        </Text>
        <Badge
          label={STATUS_LABELS[offer.status] ?? offer.status}
          tone={offer.status === "selected" ? "success" : "primary"}
        />
      </View>
      {offer.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {offer.description}
        </Text>
      ) : null}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
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
  },
  description: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
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
