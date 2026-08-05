import { Link, useRouter } from "expo-router";
import { ArrowRight, Search, ShoppingCart } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandChip } from "@/components/brands/brand-chip";
import { CategoryRow } from "@/components/categories/category-row";
import { SectionHeader } from "@/components/home/section-header";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Kicker, Rule } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import { Masthead } from "@/components/ui/masthead";
import { fetchBrands, fetchCategories, fetchProducts } from "@/lib/api";
import { rootCategories } from "@/lib/categories";
import { colors, fonts, spacing, type } from "@/lib/theme";
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
      {/* A title page, not a hero banner: wordmark and standing line to the left,
          the two things you can do from here to the right. */}
      <Masthead tagline="Est. network supply">
        <Link href="/products" asChild>
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Search the catalogue"
          >
            {({ pressed }) => (
              <View
                style={[styles.action, pressed ? styles.actionPressed : null]}
              >
                <Search color={colors.text} size={19} strokeWidth={1.6} />
              </View>
            )}
          </Pressable>
        </Link>
        <Link href="/cart" asChild>
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Your cart"
          >
            {({ pressed }) => (
              <View
                style={[styles.action, pressed ? styles.actionPressed : null]}
              >
                <ShoppingCart color={colors.text} size={19} strokeWidth={1.6} />
              </View>
            )}
          </Pressable>
        </Link>
      </Masthead>
      <Rule />

      <View style={styles.hero}>
        <Kicker label="Smart Infrastructure" />
        <Text style={styles.heroTitle}>
          Build your network{"\n"}
          <Text style={styles.heroTitleItalic}>with</Text> SOT
        </Text>
        <Text style={styles.heroSubtitle}>
          Browse products, compare brands and build your cart — all in one
          place.
        </Text>

        {/* Two outlines, gold and grey: which hairline is gold is the only thing
            separating the primary action from the secondary one. */}
        <View style={styles.heroActions}>
          <Button
            label="Browse catalogue"
            icon={ArrowRight}
            iconSide="trailing"
            size="md"
            full={false}
            onPress={() => router.push("/products")}
          />
          <Button
            label="Request a quote"
            variant="outline"
            size="md"
            full={false}
            onPress={() => router.push("/cart")}
          />
        </View>
      </View>
      <Rule />

      {data.products.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Catalogue"
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
          {/* Families only. The list arrives flat, so slicing it took the first
              four rows of the tree — which put a leaf beside a family and showed
              "0 products" against a parent holding forty. */}
          <View style={styles.categoryList}>
            {rootCategories(data.categories)
              .slice(0, 4)
              .map((category, index, shown) => (
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
  },
  action: {
    minHeight: 44,
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: { opacity: 0.5 },
  // No card, no border, no fill. The hero is type on the paper.
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.displayLarge.size,
    lineHeight: type.displayLarge.line,
  },
  // Emphasis by italic, because nothing here is bold. The italic falls on "with"
  // rather than the wordmark: SOT is a name and reads wrong leaning.
  heroTitleItalic: {
    fontFamily: fonts.displayItalic,
  },
  heroSubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    maxWidth: 300,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
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
