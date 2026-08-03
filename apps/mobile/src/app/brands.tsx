import { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { BrandRow } from "@/components/brands/brand-row";
import { ListState } from "@/components/ui/list-state";
import { fetchBrands } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const BrandsScreen = () => {
  const load = useCallback(() => fetchBrands(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="No brands yet."
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
      renderItem={({ item, index }) => (
        <BrandRow brand={item} last={index === (data?.length ?? 0) - 1} />
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

export default BrandsScreen;
