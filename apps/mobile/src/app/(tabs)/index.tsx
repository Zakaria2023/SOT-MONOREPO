import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandChip } from "@/components/brands/brand-chip";
import { CategoryRow } from "@/components/categories/category-row";
import { ProductCard } from "@/components/products/product-card";
import { SectionHeader } from "@/components/home/section-header";
import { Kicker, Rule } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import { fetchBrands, fetchCategories, fetchProducts } from "@/lib/api";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";
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
      {/* A masthead, not a hero. The wordmark and a kicker sit either side of a
          hairline, the way a title page carries a running head. */}
      <View style={styles.masthead}>
        <Text style={styles.wordmark}>SOT</Text>
        <Text style={styles.mastheadKicker}>Catalogue</Text>
      </View>
      <Rule />

      <View style={styles.hero}>
        <Kicker label="Smart Infrastructure" />
        <Text style={styles.heroTitle}>
          Build your network,{"\n"}
          <Text style={styles.heroTitleItalic}>piece by piece</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Browse products, compare brands and build your cart — all in one place.
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
            {data.categories.slice(0, 4).map((category, index, shown) => (
              <CategoryRow
                key={category.uuid}
                category={category}
                index={index}
                last={index === shown.length - 1}
              />
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
    paddingBottom: spacing.xxxl,
    gap: spacing.xxl,
  },
  masthead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  wordmark: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: tracking.wordmark,
    textTransform: "uppercase",
  },
  mastheadKicker: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
  },
  // No card, no border, no fill. The hero is type on the paper.
  hero: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.displayLarge.size,
    lineHeight: type.displayLarge.line,
  },
  // Emphasis by italic, because nothing here is bold.
  heroTitleItalic: {
    fontFamily: fonts.displayItalic,
    color: colors.primary,
  },
  heroSubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    maxWidth: 300,
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
  // No gap: the rows draw their own hairlines, and a gap between them would
  // leave the rules floating apart instead of reading as one ruled list.
  categoryList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default HomeScreen;
