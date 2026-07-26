import { StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { colors, fonts, radius, shadow, spacing } from "@/lib/theme";
import type { Offer } from "@/lib/types";

type OfferCardProps = {
  offer: Offer;
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  selected: "Selected",
};

export const OfferCard = ({ offer }: OfferCardProps) => {
  const total =
    Number(offer.productPrice ?? 0) + Number(offer.installPrice ?? 0);

  return (
    <View style={styles.card}>
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
      <View style={styles.divider} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatMoney(total)}</Text>
      </View>
    </View>
  );
};

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
  description: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
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
