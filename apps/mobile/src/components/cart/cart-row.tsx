import { Image } from "expo-image";
import { Minus, Package, Plus, Trash2 } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatMoney, formatPrice } from "@/lib/format";
import { colors, fonts, radius, shadow, spacing } from "@/lib/theme";
import type { CartLineItem } from "@/lib/types";

type CartRowProps = {
  item: CartLineItem;
  busy: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

export const CartRow = ({
  item,
  busy,
  onIncrement,
  onDecrement,
  onRemove,
}: CartRowProps) => {
  const lineTotal = Number(item.unitPrice ?? 0) * item.quantity;

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.thumb}>
          {item.image ? (
            <Image
              source={item.image}
              style={styles.thumbImage}
              contentFit="contain"
            />
          ) : (
            <Package color={colors.primary} size={22} />
          )}
        </View>
        <View style={styles.body}>
          {item.categoryName ? (
            <Text style={styles.category} numberOfLines={1}>
              {item.categoryName}
            </Text>
          ) : null}
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.unit}>
            {formatPrice(item.unitPrice, item.currency)} each
          </Text>
        </View>
        <Pressable
          onPress={onRemove}
          disabled={busy}
          style={styles.remove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name} from cart`}
        >
          <Trash2 color={colors.faint} size={18} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={styles.stepper}>
          <Pressable
            onPress={onDecrement}
            disabled={busy || item.quantity <= 1}
            style={styles.step}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity of ${item.name}`}
          >
            <Minus
              color={item.quantity <= 1 ? colors.faint : colors.text}
              size={16}
            />
          </Pressable>
          {busy ? (
            <ActivityIndicator color={colors.muted} style={styles.quantity} />
          ) : (
            <Text style={styles.quantity}>{item.quantity}</Text>
          )}
          <Pressable
            onPress={onIncrement}
            disabled={busy}
            style={styles.step}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity of ${item.name}`}
          >
            <Plus color={colors.text} size={16} />
          </Pressable>
        </View>
        <Text style={styles.lineTotal}>
          {formatMoney(lineTotal, item.currency ?? "SAR")}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  top: {
    flexDirection: "row",
    gap: spacing.md,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.control,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  body: {
    flex: 1,
    gap: 3,
  },
  category: {
    color: colors.faint,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 19,
  },
  unit: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  remove: {
    padding: spacing.xs,
    height: 30,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
  },
  step: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  quantity: {
    minWidth: 32,
    textAlign: "center",
    color: colors.text,
    fontFamily: fonts.monoBold,
    fontSize: 15,
  },
  lineTotal: {
    color: colors.text,
    fontFamily: fonts.monoBold,
    fontSize: 17,
  },
});
