import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProductsGrid } from "@/components/products/products-grid";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ListState } from "@/components/ui/list-state";
import { fetchBrand, fetchProducts } from "@/lib/api";
import { colors, fonts, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const BrandScreen = () => {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();

  const load = useCallback(async () => {
    const [brand, products] = await Promise.all([
      fetchBrand(uuid),
      fetchProducts({ brandUuids: [uuid] }),
    ]);
    return { brand, products };
  }, [uuid]);

  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !data}
          emptyLabel="Brand not found."
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: data.brand.name }} />
      <ProductsGrid
        data={data.products}
        emptyLabel="No products from this brand yet."
        header={
          <View style={styles.header}>
            <Eyebrow label="Brand" />
            <Text style={styles.title}>{data.brand.name}</Text>
            {data.brand.description ? (
              <Text style={styles.description}>{data.brand.description}</Text>
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
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 32,
  },
  description: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
});

export default BrandScreen;
