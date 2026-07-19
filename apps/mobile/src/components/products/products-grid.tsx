import type { ReactElement } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { ProductCard } from "@/components/products/product-card";
import { colors, spacing } from "@/lib/theme";
import type { Product } from "@/lib/types";

type ProductsGridProps = {
  data: Product[];
  header?: ReactElement | null;
  emptyLabel?: string;
};

export const ProductsGrid = ({
  data,
  header,
  emptyLabel = "No products yet.",
}: ProductsGridProps) => (
  <FlatList
    style={styles.container}
    contentContainerStyle={styles.content}
    data={data}
    keyExtractor={(item) => item.uuid}
    numColumns={2}
    columnWrapperStyle={data.length > 0 ? styles.row : undefined}
    ListHeaderComponent={header}
    ListEmptyComponent={
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    }
    renderItem={({ item }) => <ProductCard product={item} />}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    gap: spacing.lg,
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
  },
});
