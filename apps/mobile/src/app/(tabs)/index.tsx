import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandChip } from "@/components/brands/brand-chip";
import { CategoryRow } from "@/components/categories/category-row";
import { ProductCard } from "@/components/products/product-card";
import { SectionHeader } from "@/components/home/section-header";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ListState } from "@/components/ui/list-state";
import { fetchBrands, fetchCategories, fetchProducts } from "@/lib/api";
import { colors, fonts, gradient, radius, spacing } from "@/lib/theme";
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
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={["rgba(139,123,255,0.22)", "rgba(34,211,238,0.10)", "transparent"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroGlow}
        />
        <Eyebrow label="Smart Infrastructure" />
        <Text style={styles.heroTitle}>
          Build your network with SOT
        </Text>
        <Text style={styles.heroSubtitle}>
          Browse products, compare brands and build your cart — all in one
          place.
        </Text>
      </View>

      {data.products.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Catalog"
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
            eyebrow="Solutions"
            title="Shop by category"
            onSeeAll={() => router.push("/categories")}
          />
          <View style={styles.categoryList}>
            {data.categories.slice(0, 4).map((category) => (
              <CategoryRow key={category.uuid} category={category} />
            ))}
          </View>
        </View>
      ) : null}

      {data.brands.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Partners"
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
    gap: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    gap: spacing.md,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: spacing.lg,
  },
  hScroll: {
    gap: spacing.md,
    paddingRight: spacing.lg,
    paddingVertical: spacing.xs,
  },
  tile: {
    width: 168,
  },
  categoryList: {
    gap: spacing.md,
  },
});

export default HomeScreen;
