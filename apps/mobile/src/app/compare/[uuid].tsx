import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { CompareTable } from "@/components/products/compare-table";
import { ListState } from "@/components/ui/list-state";
import { fetchProductComparison } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const CompareScreen = () => {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { getToken } = useAuth();

  const load = useCallback(async () => {
    // A partner is compared on attributes a plain user is not offered, so the
    // token decides which rows come back at all. A signed-out browser still
    // compares — it just sees the public ones.
    const token = await getToken().catch(() => null);
    return fetchProductComparison(uuid, token ?? undefined);
  }, [uuid, getToken]);

  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data || data.rows.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.rows.length ?? 0) === 0}
          emptyLabel="Nothing comparable in this category yet."
          onRetry={reload}
        />
      </View>
    );
  }

  return <CompareTable products={data.products} rows={data.rows} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
});

export default CompareScreen;
