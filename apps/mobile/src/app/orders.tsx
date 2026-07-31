import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { OrderCard } from "@/components/orders/order-card";
import { ListState } from "@/components/ui/list-state";
import { fetchOrders } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const OrdersScreen = () => {
  const { getToken } = useAuth();
  // Set by the cart after a successful checkout, so the order the buyer just
  // placed is the one they see first.
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Please sign in to view your orders.");
    }
    return fetchOrders(token);
  }, [getToken]);

  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="You have no orders yet."
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(item) => item.uuid}
      renderItem={({ item }) => (
        <OrderCard order={item} highlighted={item.uuid === highlight} />
      )}
    />
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
    paddingBottom: spacing.xxl,
  },
});

export default OrdersScreen;
