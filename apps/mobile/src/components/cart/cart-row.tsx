import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { formatPrice } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { CartLineItem } from "@/lib/types";

type CartRowProps = {
  item: CartLineItem;
};

export const CartRow = ({ item }: CartRowProps) => (
  <View style={styles.row}>
    <Image source={item.image} style={styles.image} contentFit="cover" />
    <View style={styles.body}>
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      {item.categoryName ? (
        <Text style={styles.category}>{item.categoryName}</Text>
      ) : null}
      <Text style={styles.meta}>
        {formatPrice(item.unitPrice, item.currency)} × {item.quantity}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  category: {
    color: colors.muted,
    fontSize: 12,
  },
  meta: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
    marginTop: spacing.xs,
  },
});
