import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { CartRow } from "@/components/cart/cart-row";
import { ListState } from "@/components/ui/list-state";
import { fetchCart } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const CartScreen = () => {
  const { getToken } = useAuth();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Please sign in to view your cart.");
    }
    return fetchCart(token);
  }, [getToken]);

  const { data, error, loading, reload } = useAsync(load);

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

  const total = data.reduce(
    (sum, item) => sum + Number(item.unitPrice ?? 0) * item.quantity,
    0,
  );
  const currency = data[0]?.currency ?? "SAR";

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => <CartRow item={item} />}
      />
      <View style={styles.footer}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>
          {formatPrice(String(total), currency)}
        </Text>
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
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 15,
  },
  totalValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
});

export default CartScreen;
