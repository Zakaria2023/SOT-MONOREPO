import { useAuth } from "@clerk/clerk-expo";
import { Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FilterSheet } from "@/components/products/filter-sheet";
import { ProductCard } from "@/components/products/product-card";
import { Rule } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import {
  fetchBrands,
  fetchCategories,
  fetchCategoryFacets,
  fetchProducts,
} from "@/lib/api";
import { subtreeUuids } from "@/lib/categories";
import {
  colors,
  fonts,
  radius,
  spacing,
  tabular,
  tracking,
  type,
} from "@/lib/theme";
import { buildTree, findNode, subtreeMap } from "@/lib/tree";
import { useAsync } from "@/lib/use-async";
import type { Product, ProductSort, SpecFacet } from "@/lib/types";

const ProductsScreen = () => {
  const { getToken } = useAuth();

  const load = useCallback(async () => {
    const [categories, brands, products] = await Promise.all([
      fetchCategories(),
      fetchBrands(),
      fetchProducts(),
    ]);
    return { categories, brands, products };
  }, []);

  const { data, error, loading, reload } = useAsync(load);

  // Spec facets belong to a place in the tree, so they only exist once a
  // category is picked — the same rule the web catalog follows.
  const [categoryUuid, setCategoryUuid] = useState<string | null>(null);
  const [facets, setFacets] = useState<SpecFacet[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rows, setRows] = useState<Product[] | null>(null);
  const [brandUuids, setBrandUuids] = useState<string[]>([]);
  const [sort, setSort] = useState<ProductSort>("featured");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  const signature = JSON.stringify(selected);

  // The category list arrives flat with parentUuid on each row; the shape and the
  // rolled-up counts are assembled here, once per load.
  const roots = useMemo(
    () => buildTree(data?.categories ?? [], (item) => item.productCount),
    [data],
  );
  const total = useMemo(
    () => roots.reduce((sum, root) => sum + root.count, 0),
    [roots],
  );
  // Brands nest too — a house brand under its maker — and the count on a maker
  // has to include what its houses sell or the number contradicts the list.
  const brandRoots = useMemo(
    () => buildTree(data?.brands ?? [], (brand) => brand.productCount ?? 0),
    [data],
  );
  const brandSubtrees = useMemo(() => subtreeMap(brandRoots), [brandRoots]);
  // Chosen makers expanded to their houses, deduplicated: picking a parent and
  // one of its children would otherwise send the child's uuid twice.
  const brandQuery = useMemo(
    () => [
      ...new Set(
        brandUuids.flatMap((uuid) => brandSubtrees.get(uuid) ?? [uuid]),
      ),
    ],
    [brandUuids, brandSubtrees],
  );
  const brandSignature = brandQuery.join(",");
  // Which family the chips should mark. Choosing a sub-category in the sheet has
  // to light its family up here, or the two controls contradict each other.
  const activeRoot = useMemo(
    () =>
      categoryUuid
        ? (roots.find((root) => findNode([root], categoryUuid))?.uuid ?? null)
        : null,
    [roots, categoryUuid],
  );

  // Clerk returns a new getToken on every render, so an effect that lists it as a
  // dependency runs on every render too. Held in a ref, it stays callable without
  // being a dependency — the same fix use-async needed for its loader.
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  // Typing is debounced into `term`, which is what the query keys on. Without
  // this every keystroke is a round trip, and the list flickers through the
  // results of prefixes nobody wanted.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Changing category invalidates the chosen facets — a value from Copper
  // Cables means nothing under IP Cameras, and leaving it set would filter the
  // new list down to nothing for no visible reason.
  useEffect(() => {
    // Functional update returning `current`: setSelected({}) with a fresh object
    // is never Object.is-equal, so it re-rendered even when nothing was chosen —
    // and with getToken in the deps below, that render re-ran this effect. The
    // two together were an infinite loop that refetched facets each pass.
    setSelected((current) =>
      Object.keys(current).length === 0 ? current : {},
    );
  }, [categoryUuid]);

  // Facets are re-resolved as the shopper ticks, not once per category: a
  // conditional attribute is only offered after its trigger is set, so PoE Budget
  // appears the moment PoE = Yes does. The web catalog resolves them twice for the
  // same reason; here the second pass is the next fetch.
  useEffect(() => {
    if (!categoryUuid) {
      setFacets([]);
      return;
    }
    let cancelled = false;
    const chosen: Record<string, string[]> = JSON.parse(signature);
    tokenRef
      .current()
      .catch(() => null)
      .then((token) =>
        fetchCategoryFacets(categoryUuid, token ?? undefined, chosen),
      )
      .then((next) => {
        if (cancelled) {
          return;
        }
        setFacets(next);
        // Drop anything the category no longer offers. Un-ticking PoE takes PoE
        // Budget off the sheet, and a value left behind for a filter nobody can
        // see would go on narrowing the list invisibly.
        const offered = new Set(next.map((facet) => facet.key));
        setSelected((current) => {
          const kept = Object.entries(current).filter(([key]) =>
            offered.has(key),
          );
          return kept.length === Object.keys(current).length
            ? current
            : Object.fromEntries(kept);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFacets([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the chosen values, not the object identity — `signature` is the
    // JSON of `selected`, and it is parsed back rather than read from state so the
    // effect cannot fire on a render that rebuilt an equal object.
  }, [categoryUuid, signature]);

  // Read through a ref for the same reason as the cart: the effect keys on
  // `signature`, and depending on the identity of `data` or `selected` would
  // re-fetch on every render that rebuilt an equal object.
  const latest = useRef({ data, selected, brandQuery });
  latest.current = { data, selected, brandQuery };

  useEffect(() => {
    const {
      data: tree,
      selected: chosen,
      brandQuery: brandsChosen,
    } = latest.current;
    if (!tree) {
      return;
    }
    // "featured" is the order the unfiltered list already arrives in, so it is
    // not a reason to ask the API for the same list again.
    if (
      !categoryUuid &&
      !term &&
      sort === "featured" &&
      brandsChosen.length === 0 &&
      Object.keys(chosen).length === 0
    ) {
      setRows(null);
      return;
    }
    let cancelled = false;
    fetchProducts({
      // The whole subtree, because products sit in the leaves — filtering to
      // "Networking" alone would come back empty.
      categoryUuids: categoryUuid
        ? subtreeUuids(tree.categories, categoryUuid)
        : undefined,
      // …but the facets are the picked category's, so name it separately.
      facetCategoryUuid: categoryUuid ?? undefined,
      specValues: chosen,
      search: term || undefined,
      brandUuids: brandsChosen.length > 0 ? brandsChosen : undefined,
      sort,
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
    // Keyed on the joined uuids rather than the array, which is rebuilt each render.
  }, [categoryUuid, signature, term, brandSignature, sort]);

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

  const closeSearch = () => {
    setSearchOpen(false);
    setSearch("");
  };

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Text style={styles.heading}>Products</Text>
        <Pressable
          onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? "Close search" : "Search products"}
          style={({ pressed }) => [
            styles.action,
            pressed ? styles.actionPressed : null,
          ]}
        >
          {searchOpen ? (
            <X color={colors.muted} size={19} strokeWidth={1.6} />
          ) : (
            <Search color={colors.text} size={19} strokeWidth={1.6} />
          )}
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchRow}>
          {/* A ruled line to write on, not a filled input. The rule is the field. */}
          <TextInput
            value={search}
            onChangeText={setSearch}
            autoFocus
            placeholder="Search by name, SKU or brand"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Search products"
          />
        </View>
      ) : null}

      <View style={styles.tools}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setCategoryUuid(null)}
            style={[styles.chip, !categoryUuid ? styles.chipActive : null]}
          >
            <Text
              style={[
                styles.chipText,
                !categoryUuid ? styles.chipTextActive : null,
              ]}
            >
              All
            </Text>
          </Pressable>
          {roots.map((root) => {
            const active = activeRoot === root.uuid;
            return (
              <Pressable
                key={root.uuid}
                onPress={() => setCategoryUuid(active ? null : root.uuid)}
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
          <FilterSheet
            categories={roots}
            selectedCategory={categoryUuid}
            onSelectCategory={setCategoryUuid}
            totalProducts={total}
            brands={brandRoots}
            selectedBrands={brandUuids}
            sort={sort}
            onSort={setSort}
            onToggleBrand={(uuid) =>
              setBrandUuids((current) =>
                current.includes(uuid)
                  ? current.filter((entry) => entry !== uuid)
                  : [...current, uuid],
              )
            }
            facets={facets}
            selected={selected}
            open={sheetOpen}
            onOpen={() => setSheetOpen(true)}
            onClose={() => setSheetOpen(false)}
            onChange={setSelected}
          />
          {!categoryUuid ? (
            <Text style={styles.hint}>Pick a category to filter by spec</Text>
          ) : null}
          <Text style={styles.count}>
            {products.length} {products.length === 1 ? "item" : "items"}
          </Text>
        </View>
      </View>
      <Rule />

      {products.length === 0 ? (
        <ListState
          loading={false}
          error={null}
          empty
          emptyLabel={
            term
              ? `Nothing matches “${term}”.`
              : "Nothing matches those filters."
          }
          onRetry={() => {
            setSelected({});
            setSearch("");
            setBrandUuids([]);
          }}
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
  // overflow hidden, because the horizontal chip scroller otherwise widens this
  // container to the width of all its chips — which then dragged the two-column
  // grid off the right edge of the screen with it.
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: 44,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.display.size,
    lineHeight: type.display.line,
  },
  action: {
    minHeight: 44,
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: { opacity: 0.5 },
  searchRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchInput: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
    minHeight: 44,
  },
  // The toolbar is on the paper, separated by a hairline — not a raised bar in a
  // different fill.
  tools: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  chips: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  // Outlines on the paper at 4px. The pill shape and the grey fill were the two
  // things that made these read as app chrome rather than as marginalia.
  chip: {
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Selected is a gold hairline and a gold label — never an inverted block, which
  // would be the only filled shape on the screen and would read as a button.
  chipActive: { borderColor: colors.primaryBorder },
  chipText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
  },
  chipTextActive: { color: colors.primary, fontFamily: fonts.medium },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  hint: {
    color: colors.faint,
    fontFamily: fonts.bodyItalic,
    fontSize: type.caption.size,
  },
  count: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
    ...tabular,
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
