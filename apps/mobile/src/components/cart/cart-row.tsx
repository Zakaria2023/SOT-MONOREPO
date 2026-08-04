import { documentUrl } from "@/lib/api";
import { Image } from "expo-image";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Price } from "@/components/ui/editorial";
import { formatMoney, formatPrice } from "@/lib/format";
import {
  colors,
  fonts,
  radius,
  spacing,
  tabular,
  tracking,
  type,
} from "@/lib/theme";
import type { CartLineItem } from "@/lib/types";

type CartRowProps = {
  item: CartLineItem;
  busy: boolean;
  /** Last line in the list — no rule beneath, so the cart does not end on one. */
  last?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

/**
 * A line of the cart: plate, caption, stepper, line total — divided by a hairline.
 *
 * It was a bordered card on a tinted fill with a shadow, which made every line
 * read as its own screen. A cart is a list of entries in a ledger, and a ledger
 * rules its rows.
 */
export const CartRow = ({
  item,
  busy,
  last = false,
  onIncrement,
  onDecrement,
  onRemove,
}: CartRowProps) => {
  const lineTotal = Number(item.unitPrice ?? 0) * item.quantity;

  return (
    <View style={[styles.row, last ? null : styles.divided]}>
      <View style={styles.top}>
        {/* The same 6px paper mat the catalogue plates use, at row scale. */}
        <View style={styles.mat}>
          <View style={styles.plate}>
            {item.image ? (
              <Image
                source={documentUrl(item.image)}
                style={styles.plateImage}
                contentFit="contain"
              />
            ) : (
              <Text style={styles.plateEmpty}>—</Text>
            )}
          </View>
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
          style={({ pressed }) => [
            styles.remove,
            pressed ? styles.removePressed : null,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name} from cart`}
        >
          <Trash2 color={colors.faint} size={17} strokeWidth={1.6} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        {/* Two outlined squares with the count between them. The pill on a grey
            fill was the last capsule shape left in the app. */}
        <View style={styles.stepper}>
          <Pressable
            onPress={onDecrement}
            disabled={busy || item.quantity <= 1}
            style={({ pressed }) => [
              styles.step,
              pressed ? styles.stepPressed : null,
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity of ${item.name}`}
          >
            <Minus
              color={item.quantity <= 1 ? colors.faint : colors.text}
              size={15}
              strokeWidth={1.6}
            />
          </Pressable>
          {busy ? (
            <ActivityIndicator color={colors.muted} style={styles.spinner} />
          ) : (
            <Text style={styles.quantity}>{item.quantity}</Text>
          )}
          <Pressable
            onPress={onIncrement}
            disabled={busy}
            style={({ pressed }) => [
              styles.step,
              pressed ? styles.stepPressed : null,
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity of ${item.name}`}
          >
            <Plus color={colors.text} size={15} strokeWidth={1.6} />
          </Pressable>
        </View>
        <Price>{formatMoney(lineTotal, item.currency ?? "SAR")}</Price>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  top: {
    flexDirection: "row",
    gap: spacing.md,
  },
  mat: {
    width: 64,
    height: 64,
    padding: 6,
    backgroundColor: colors.surface,
  },
  plate: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  plateImage: { width: "100%", height: "100%" },
  plateEmpty: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.body.size,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  category: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
  },
  name: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.lead.size,
    lineHeight: 21,
  },
  unit: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
  },
  remove: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -spacing.sm,
    marginRight: -spacing.sm,
  },
  removePressed: { backgroundColor: colors.pressed },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  step: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepPressed: { backgroundColor: colors.pressed },
  // Same width as the count so the row does not jump while a change is in flight.
  spinner: { minWidth: 40 },
  quantity: {
    minWidth: 40,
    textAlign: "center",
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    ...tabular,
  },
});
