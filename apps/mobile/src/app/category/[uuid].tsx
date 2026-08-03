import { useAuth } from "@clerk/clerk-expo";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FilterSheet } from "@/components/products/filter-sheet";
import { ProductsGrid } from "@/components/products/products-grid";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ListState } from "@/components/ui/list-state";
import { fetchCategory, fetchCategoryFacets, fetchProducts } from "@/lib/api";
import { colors, fonts, spacing, tabular, tracking, type } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import type { Product } from "@/lib/types";

const CategoryScreen = () => {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { getToken } = useAuth();

  // Category and facets load once; the product list reloads on its own when
  // the filters change, so the sheet stays open and the header doesn't flash.
  const load = useCallback(async () => {
    const token = await getToken().catch(() => null);
    const [category, facets, products] = await Promise.all([
      fetchCategory(uuid),
      // A partner is offered facets a plain user is not, so the token matters.
      fetchCategoryFacets(uuid, token ?? undefined),
      fetchProducts({ categoryUuids: [uuid] }),
    ]);
    return { category, facets, products };
  }, [uuid, getToken]);

  const { data, error, loading, reload } = useAsync(load, uuid);

  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filtered, setFiltered] = useState<Product[] | null>(null);
  const signature = JSON.stringify(selected);

  // Read through a ref so the effect keys on `signature` rather than on the
  // identity of `selected`, without silencing exhaustive-deps.
  const latestSelected = useRef(selected);
  latestSelected.current = selected;

  useEffect(() => {
    const chosen = latestSelected.current;
    if (Object.keys(chosen).length === 0) {
      setFiltered(null);
      return;
    }
    let cancelled = false;
    fetchProducts({ categoryUuids: [uuid], specValues: chosen })
      .then((rows) => {
        if (!cancelled) {
          setFiltered(rows);
        }
      })
      // A failed filter leaves the unfiltered list rather than an error screen.
      .catch(() => {
        if (!cancelled) {
          setFiltered(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the chosen values, not the object identity.
  }, [signature, uuid]);

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

  const products = filtered ?? data.products;
  const narrowed = filtered !== null;

  return (
    <>
      <Stack.Screen options={{ title: data.category.name }} />
      <ProductsGrid
        data={products}
        emptyLabel={
          narrowed
            ? "Nothing here matches those filters."
            : "No products in this category yet."
        }
        header={
          <View style={styles.header}>
            <Eyebrow label="Category" />
            <Text style={styles.title}>{data.category.name}</Text>
            {data.category.parentName ? (
              <Text style={styles.parent}>in {data.category.parentName}</Text>
            ) : null}

            <View style={styles.tools}>
              <FilterSheet
                facets={data.facets}
                selected={selected}
                open={sheetOpen}
                onOpen={() => setSheetOpen(true)}
                onClose={() => setSheetOpen(false)}
                onChange={setSelected}
              />
              <Text style={styles.count}>
                {products.length} {products.length === 1 ? "item" : "items"}
              </Text>
            </View>
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
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.display.size,
    lineHeight: type.display.line,
  },
  // Italic, because the parent is an aside about where you are — the same
  // mechanism the hero uses for emphasis, only quieter.
  parent: {
    color: colors.muted,
    fontFamily: fonts.bodyItalic,
    fontSize: type.body.size,
  },
  // The toolbar sits between two hairlines, so the filters read as apparatus
  // belonging to the list below rather than as part of the title above.
  tools: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
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

export default CategoryScreen;
