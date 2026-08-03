import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FilterSheet } from "@/components/products/filter-sheet";
import { ProductCard } from "@/components/products/product-card";
import { ListState } from "@/components/ui/list-state";
import { fetchCategories, fetchCategoryFacets, fetchProducts } from "@/lib/api";
import { rootCategories, subtreeUuids } from "@/lib/categories";
import { colors, fonts, radius, spacing, type } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import type { Category, Product, SpecFacet } from "@/lib/types";

const ProductsScreen = () => {
  const { getToken } = useAuth();

  const load = useCallback(async () => {
    const [categories, products] = await Promise.all([
      fetchCategories(),
      fetchProducts(),
    ]);
    return { categories, products };
  }, []);

  const { data, error, loading, reload } = useAsync(load);

  // Spec facets belong to a place in the tree, so they only exist once a
  // category is picked — the same rule the web catalog follows.
  const [category, setCategory] = useState<Category | null>(null);
  const [facets, setFacets] = useState<SpecFacet[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rows, setRows] = useState<Product[] | null>(null);

  const signature = JSON.stringify(selected);
  const categoryUuid = category?.uuid ?? null;

  // Changing category invalidates the chosen facets — a value from Copper
  // Cables means nothing under IP Cameras, and leaving it set would filter the
  // new list down to nothing for no visible reason.
  useEffect(() => {
    setSelected({});
    if (!categoryUuid) {
      setFacets([]);
      return;
    }
    let cancelled = false;
    getToken()
      .catch(() => null)
      .then((token) => fetchCategoryFacets(categoryUuid, token ?? undefined))
      .then((next) => {
        if (!cancelled) {
          setFacets(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFacets([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoryUuid, getToken]);

  useEffect(() => {
    if (!data) {
      return;
    }
    if (!categoryUuid && Object.keys(selected).length === 0) {
      setRows(null);
      return;
    }
    let cancelled = false;
    fetchProducts({
      // The whole subtree, because products sit in the leaves — filtering to
      // "Networking" alone would come back empty.
      categoryUuids: categoryUuid
        ? subtreeUuids(data.categories, categoryUuid)
        : undefined,
      // …but the facets are the picked category's, so name it separately.
      facetCategoryUuid: categoryUuid ?? undefined,
      specValues: selected,
    })
      .then((next) => {
        if (!cancelled) {
          setRows(next);
        }
      })
      // Narrowing a list is not worth losing the list over.
      .catch(() => {
        if (!cancelled) {
          setRows(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoryUuid, signature, data]);

  if (loading || error || !data) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !data}
          emptyLabel="No products yet."
          onRetry={reload}
        />
      </View>
    );
  }

  const products = rows ?? data.products;
  const roots = rootCategories(data.categories);

  return (
    <View style={styles.container}>
      <View style={styles.tools}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setCategory(null)}
            style={[styles.chip, !category ? styles.chipActive : null]}
          >
            <Text
              style={[
                styles.chipText,
                !category ? styles.chipTextActive : null,
              ]}
            >
              All
            </Text>
          </Pressable>
          {roots.map((root) => {
            const active = category?.uuid === root.uuid;
            return (
              <Pressable
                key={root.uuid}
                onPress={() => setCategory(active ? null : root)}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <Text
                  style={[
                    styles.chipText,
                    active ? styles.chipTextActive : null,
                  ]}
                >
                  {root.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.filterRow}>
          {category ? (
            <FilterSheet
              facets={facets}
              selected={selected}
              open={sheetOpen}
              onOpen={() => setSheetOpen(true)}
              onClose={() => setSheetOpen(false)}
              onChange={setSelected}
            />
          ) : (
            <Text style={styles.hint}>Pick a category to filter by spec</Text>
          )}
          <Text style={styles.count}>
            {products.length} {products.length === 1 ? "item" : "items"}
          </Text>
        </View>
      </View>

      {products.length === 0 ? (
        <ListState
          loading={false}
          error={null}
          empty
          emptyLabel="Nothing matches those filters."
          onRetry={() => setSelected({})}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={products}
          keyExtractor={(item) => item.uuid}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tools: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    height: 36,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Inverted rather than tinted: the accent is reserved for actions, so the
  // current filter reads as state without competing with the buttons.
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: type.caption.size,
  },
  chipTextActive: { color: colors.surface, fontFamily: fonts.semibold },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  hint: {
    color: colors.faint,
    fontFamily: fonts.regular,
    fontSize: type.caption.size,
  },
  count: {
    color: colors.faint,
    fontFamily: fonts.medium,
    fontSize: type.caption.size,
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
