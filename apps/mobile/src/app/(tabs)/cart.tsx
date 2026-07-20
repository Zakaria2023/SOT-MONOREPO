import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { CartRow } from "@/components/cart/cart-row";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import { fetchCart, removeCartItem, updateCartItem } from "@/lib/api";
import { formatMoney, summarizeCart } from "@/lib/format";
import { colors, fonts, radius, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import type { CartLineItem } from "@/lib/types";

type SummaryRowProps = {
  label: string;
  value: string;
  emphasis?: boolean;
};

const SummaryRow = ({ label, value, emphasis }: SummaryRowProps) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, emphasis ? styles.summaryStrong : null]}>
      {label}
    </Text>
    <Text style={[styles.summaryValue, emphasis ? styles.totalValue : null]}>
      {value}
    </Text>
  </View>
);

const CartScreen = () => {
  const { getToken } = useAuth();
  const [busyUuid, setBusyUuid] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Please sign in to view your cart.");
    }
    return fetchCart(token);
  }, [getToken]);

  const { data, error, loading, reload } = useAsync(load);

  const mutate = useCallback(
    async (item: CartLineItem, action: "inc" | "dec" | "remove") => {
      setBusyUuid(item.uuid);
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Please sign in.");
        }
        if (action === "remove") {
          await removeCartItem(item.uuid, token);
        } else {
          const next = action === "inc" ? item.quantity + 1 : item.quantity - 1;
          await updateCartItem(item.uuid, next, token);
        }
        reload();
      } catch {
        setBusyUuid(null);
      }
    },
    [getToken, reload],
  );

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="Your cart is empty."
          onRetry={reload}
        />
      </View>
    );
  }

  const subtotal = data.reduce(
    (sum, item) => sum + Number(item.unitPrice ?? 0) * item.quantity,
    0,
  );
  const currency = data[0]?.currency ?? "SAR";
  const { vat, total } = summarizeCart(subtotal);

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item) => item.uuid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CartRow
            item={item}
            busy={busyUuid === item.uuid}
            onIncrement={() => mutate(item, "inc")}
            onDecrement={() => mutate(item, "dec")}
            onRemove={() => mutate(item, "remove")}
          />
        )}
      />
      <View style={styles.footer}>
        <View style={styles.summary}>
          <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
          <SummaryRow label="VAT (15%)" value={formatMoney(vat, currency)} />
          <View style={styles.divider} />
          <SummaryRow label="Total" value={formatMoney(total, currency)} emphasis />
        </View>
        <Button label="Proceed to checkout" onPress={reload} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.overlay,
    gap: spacing.lg,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
  },
  summary: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  summaryStrong: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 14,
  },
  totalValue: {
    fontSize: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});

export default CartScreen;
