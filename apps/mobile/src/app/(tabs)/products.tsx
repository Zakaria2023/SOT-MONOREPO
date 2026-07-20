import { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ProductCard } from "@/components/products/product-card";
import { ListState } from "@/components/ui/list-state";
import { fetchProducts } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const ProductsScreen = () => {
  const load = useCallback(() => fetchProducts(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="No products yet."
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
      numColumns={2}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => <ProductCard product={item} />}
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
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    gap: spacing.lg,
  },
});

export default ProductsScreen;
