import { useAuth } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Check, Columns3, FileText, ShoppingCart } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ProductCard } from "@/components/products/product-card";
import { SpecTable } from "@/components/products/spec-table";
import { Button } from "@/components/ui/button";
import { Kicker, Price, Rule } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import {
  addCartItem,
  documentUrl,
  fetchProduct,
  fetchRelatedProducts,
} from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { PRODUCT_STATUS_LABELS } from "@/lib/labels";
import { colors, fonts, spacing, tabular, tracking, type } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type DetailRow = {
  label: string;
  value: string;
};

// One plate per screen width, minus the page margins, so a swipe lands squarely
// on the next image rather than halfway between two.
const PLATE_WIDTH = Dimensions.get("window").width - spacing.lg * 2;

const ProductScreen = () => {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { getToken } = useAuth();
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  // The related list is fetched beside the product rather than inside it: it is a
  // separate endpoint on the same service the web page uses, and a failure there
  // must cost the page nothing.
  const load = useCallback(
    async () => ({
      product: await fetchProduct(uuid),
      related: await fetchRelatedProducts(uuid).catch(() => []),
    }),
    [uuid],
  );
  const { data, error, loading, reload } = useAsync(load, uuid);

  const product = data?.product ?? null;

  const addToCart = async () => {
    if (!product) {
      return;
    }
    setCartMessage(null);
    setAdding(true);
    try {
      const token = await getToken();
      if (!token) {
        setCartMessage("Please sign in to add items to your cart.");
        return;
      }
      await addCartItem({ productUuid: product.uuid }, token);
      setAdded(true);
      setCartMessage("Added to your cart.");
    } catch (e) {
      setCartMessage(e instanceof Error ? e.message : "Could not add to cart.");
    } finally {
      setAdding(false);
    }
  };

  if (loading || error || !product) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !product}
          emptyLabel="Product not found."
          onRetry={reload}
        />
      </View>
    );
  }

  // The lead image first, then the gallery — deduplicated, because a product
  // whose `images` repeats its cover would otherwise open on the same plate twice.
  const plates = [product.image, ...(product.images ?? [])].filter(
    (entry, index, all): entry is string =>
      Boolean(entry) && all.indexOf(entry) === index,
  );

  // The same five fields the web page lists under "Product details", plus the
  // warranty and origin lines its hero carries — the app has no hero strip to put
  // them in.
  const details: DetailRow[] = [];
  if (product.brandName) {
    details.push({ label: "Brand", value: product.brandName });
  }
  if (product.categoryName) {
    details.push({ label: "Category", value: product.categoryName });
  }
  if (product.sku) {
    details.push({ label: "SKU", value: product.sku });
  }
  if (product.model) {
    details.push({ label: "Model", value: product.model });
  }
  if (product.status) {
    details.push({
      label: "Status",
      value: PRODUCT_STATUS_LABELS[product.status] ?? product.status,
    });
  }
  if (product.warrantyPeriod) {
    details.push({ label: "Warranty", value: product.warrantyPeriod });
  }
  if (product.countryOfOrigin) {
    details.push({ label: "Origin", value: product.countryOfOrigin });
  }

  const related = data?.related ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: product.name }} />

      {/* A tipped-in plate per image, swiped horizontally. One plate is simply a
          plate — the pager only earns its keep when there is a second. */}
      <ScrollView
        horizontal
        pagingEnabled={plates.length > 1}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gallery}
      >
        {plates.length > 0 ? (
          plates.map((entry) => (
            <View key={entry} style={styles.mat}>
              <View style={styles.plate}>
                <Image
                  source={documentUrl(entry)}
                  style={styles.image}
                  contentFit="contain"
                  transition={150}
                />
              </View>
            </View>
          ))
        ) : (
          <View style={styles.mat}>
            <View style={styles.plate}>
              <Text style={styles.plateEmpty}>No plate</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.head}>
        {product.brandName ? (
          <Text style={styles.brand}>{product.brandName}</Text>
        ) : null}
        <Text style={styles.name}>{product.name}</Text>
        <Price>{formatPrice(product.price, product.currency)}</Price>

        {product.shortDescription ? (
          <Text style={styles.lead}>{product.shortDescription}</Text>
        ) : null}
        {product.description ? (
          <Text style={styles.description}>{product.description}</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={added ? "Added to cart" : "Add to cart"}
          icon={added ? Check : ShoppingCart}
          onPress={addToCart}
          loading={adding}
        />
        {/* The same comparison the web product page shows, built from the same
            service — so the two cannot compare different attributes. Its own
            screen rather than a block here: the table scrolls sideways, and it has
            no business fighting the page for that gesture. */}
        <Button
          label="Compare with similar"
          icon={Columns3}
          variant="outline"
          onPress={() => router.push(`/compare/${product.uuid}`)}
        />
        {product.datasheet ? (
          <Button
            label="Download datasheet"
            icon={FileText}
            variant="ghost"
            onPress={() => {
              const datasheet = product.datasheet;
              if (datasheet) {
                void Linking.openURL(documentUrl(datasheet));
              }
            }}
          />
        ) : null}
        {cartMessage ? <Text style={styles.message}>{cartMessage}</Text> : null}
      </View>

      {details.length > 0 ? (
        <View style={styles.section}>
          <Rule />
          <Text style={styles.sectionTitle}>Product details</Text>
          <View style={styles.detailRows}>
            {details.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.detailRow,
                  index === details.length - 1 ? null : styles.divided,
                ]}
              >
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Only the attributes this viewer may read — the API filtered them by
          audience before they ever reached the device. */}
      {product.specs && product.specs.length > 0 ? (
        <View style={styles.section}>
          <Rule />
          <SpecTable specs={product.specs} heading="Technical specifications" />
        </View>
      ) : null}

      {related.length > 0 ? (
        <View style={styles.section}>
          <Rule />
          <Kicker label="Pairs well with" />
          <Text style={styles.sectionTitle}>Other devices in this range</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relatedRow}
          >
            {related.map((entry) => (
              <View key={entry.uuid} style={styles.relatedTile}>
                <ProductCard product={entry} />
              </View>
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
  gallery: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  mat: {
    width: PLATE_WIDTH,
    aspectRatio: 1,
    padding: 6,
    backgroundColor: colors.surface,
  },
  plate: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  plateEmpty: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  head: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  brand: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
  },
  name: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.display.size,
    lineHeight: type.display.line,
  },
  // The one-liner leads in italic, the way a standfirst opens an article.
  lead: {
    color: colors.text,
    fontFamily: fonts.bodyItalic,
    fontSize: type.lead.size,
    lineHeight: 26,
    marginTop: spacing.sm,
  },
  description: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.line,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  message: {
    color: colors.muted,
    fontFamily: fonts.bodyItalic,
    fontSize: type.caption.size,
    textAlign: "center",
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.heading.size,
    lineHeight: type.heading.line,
  },
  detailRows: { borderTopWidth: 1, borderTopColor: colors.border },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailLabel: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  detailValue: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    textAlign: "right",
    ...tabular,
  },
  relatedRow: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  relatedTile: { width: 168 },
});

export default ProductScreen;
