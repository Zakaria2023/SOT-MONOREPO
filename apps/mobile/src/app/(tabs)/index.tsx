import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandChip } from "@/components/brands/brand-chip";
import { CategoryRow } from "@/components/categories/category-row";
import { ProductCard } from "@/components/products/product-card";
import { SectionHeader } from "@/components/home/section-header";
import { ListState } from "@/components/ui/list-state";
import { fetchBrands, fetchCategories, fetchProducts } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const HomeScreen = () => {
  const router = useRouter();

  const load = useCallback(async () => {
    const [products, categories, brands] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchBrands(),
    ]);
    return { products, categories, brands };
  }, []);

  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={false}
          emptyLabel=""
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Build your network with SOT</Text>
        <Text style={styles.heroSubtitle}>
          Browse products, compare brands and add to your cart.
        </Text>
      </View>

      {data.products.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Featured products"
            onSeeAll={() => router.push("/products")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {data.products.slice(0, 8).map((product) => (
              <View key={product.uuid} style={styles.tile}>
                <ProductCard product={product} />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {data.categories.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Shop by category"
            onSeeAll={() => router.push("/categories")}
          />
          <View style={styles.categoryList}>
            {data.categories.slice(0, 5).map((category) => (
              <CategoryRow key={category.uuid} category={category} />
            ))}
          </View>
        </View>
      ) : null}

      {data.brands.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Top brands"
            onSeeAll={() => router.push("/brands")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {data.brands.slice(0, 10).map((brand) => (
              <BrandChip key={brand.uuid} brand={brand} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "600",
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  section: {
    paddingHorizontal: spacing.lg,
  },
  hScroll: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  tile: {
    width: 160,
  },
  categoryList: {
    gap: spacing.md,
  },
});

export default HomeScreen;
