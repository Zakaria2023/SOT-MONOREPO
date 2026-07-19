import { StyleSheet, Text, View } from "react-native";
import { formatPrice } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
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
        <Text style={styles.reference}>
          {offer.boqReference ?? "BOQ offer"}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {STATUS_LABELS[offer.status] ?? offer.status}
          </Text>
        </View>
      </View>
      {offer.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {offer.description}
        </Text>
      ) : null}
      <Text style={styles.total}>{formatPrice(String(total), "SAR")}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reference: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "500",
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  total: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
