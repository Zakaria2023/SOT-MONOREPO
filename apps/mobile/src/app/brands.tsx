import { useCallback } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { BrandRow } from "@/components/brands/brand-row";
import { Kicker } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import { fetchBrands } from "@/lib/api";
import { colors, fonts, spacing, tabular, tracking, type } from "@/lib/theme";
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
      ListHeaderComponent={
        <View style={styles.header}>
          <Kicker label="Partners" />
          <Text style={styles.count}>
            {data.length} {data.length === 1 ? "brand" : "brands"}
          </Text>
        </View>
      }
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  count: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
    ...tabular,
  },
});

export default BrandsScreen;
