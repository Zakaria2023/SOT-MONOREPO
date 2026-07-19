import { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { CategoryRow } from "@/components/categories/category-row";
import { ListState } from "@/components/ui/list-state";
import { fetchCategories } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const CategoriesScreen = () => {
  const load = useCallback(() => fetchCategories(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="No categories yet."
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
      renderItem={({ item }) => <CategoryRow category={item} />}
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
  },
});

export default CategoriesScreen;
