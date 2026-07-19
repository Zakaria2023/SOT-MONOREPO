import { Image } from "expo-image";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatPrice } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
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
}: CartRowProps) => (
  <View style={styles.row}>
    <Image source={item.image} style={styles.image} contentFit="cover" />
    <View style={styles.body}>
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.meta}>
        {formatPrice(item.unitPrice, item.currency)}
      </Text>
      <View style={styles.controls}>
        <Pressable
          onPress={onDecrement}
          disabled={busy || item.quantity <= 1}
          style={[
            styles.stepButton,
            busy || item.quantity <= 1 ? styles.stepDisabled : null,
          ]}
        >
          <Minus color={colors.text} size={16} />
        </Pressable>
        {busy ? (
          <ActivityIndicator color={colors.muted} style={styles.quantity} />
        ) : (
          <Text style={styles.quantity}>{item.quantity}</Text>
        )}
        <Pressable
          onPress={onIncrement}
          disabled={busy}
          style={[styles.stepButton, busy ? styles.stepDisabled : null]}
        >
          <Plus color={colors.text} size={16} />
        </Pressable>
        <Pressable
          onPress={onRemove}
          disabled={busy}
          style={styles.remove}
        >
          <Trash2 color={colors.danger} size={18} />
        </Pressable>
      </View>
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
  meta: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  stepDisabled: {
    opacity: 0.4,
  },
  quantity: {
    minWidth: 28,
    textAlign: "center",
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  remove: {
    marginLeft: "auto",
    padding: spacing.sm,
  },
});
