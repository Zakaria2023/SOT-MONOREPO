import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProductsGrid } from "@/components/products/products-grid";
import { ListState } from "@/components/ui/list-state";
import { fetchCategory, fetchProducts } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const CategoryScreen = () => {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();

  const load = useCallback(async () => {
    const [category, products] = await Promise.all([
      fetchCategory(uuid),
      fetchProducts({ categoryUuids: [uuid] }),
    ]);
    return { category, products };
  }, [uuid]);

  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !data}
          emptyLabel="Category not found."
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: data.category.name }} />
      <ProductsGrid
        data={data.products}
        emptyLabel="No products in this category yet."
        header={
          <View style={styles.header}>
            <Text style={styles.title}>{data.category.name}</Text>
            {data.category.parentName ? (
              <Text style={styles.parent}>in {data.category.parentName}</Text>
            ) : null}
          </View>
        }
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
  },
  parent: {
    color: colors.muted,
    fontSize: 14,
  },
});

export default CategoryScreen;
