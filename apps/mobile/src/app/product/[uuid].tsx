import { useAuth } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Check,
  Columns3,
  ImageOff,
  ShoppingCart,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import { SpecTable } from "@/components/products/spec-table";
import { addCartItem, fetchProduct } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { colors, fonts, radius, shadow, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const ProductScreen = () => {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { getToken } = useAuth();
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => fetchProduct(uuid), [uuid]);
  const { data: product, error, loading, reload } = useAsync(load, uuid);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: product.name }} />
      <View style={styles.well}>
        
        {product.image ? (
          <Image
            source={product.image}
            style={styles.image}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <ImageOff color={colors.faint} size={40} />
        )}
      </View>

      <View style={styles.badges}>
        {product.categoryName ? (
          <Badge label={product.categoryName} tone="primary" />
        ) : null}
        {product.brandName ? (
          <Badge label={product.brandName} tone="neutral" />
        ) : null}
      </View>

      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>
        {formatPrice(product.price, product.currency)}
      </Text>

      {product.shortDescription ? (
        <Text style={styles.lead}>{product.shortDescription}</Text>
      ) : null}
      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}

      {/* Only the attributes this viewer may read — the API filtered them by
          audience before they ever reached the device. */}
      {product.specs ? <SpecTable specs={product.specs} /> : null}

      <View style={styles.action}>
        <Button
          label={added ? "Added to cart" : "Add to cart"}
          icon={added ? Check : ShoppingCart}
          onPress={addToCart}
          loading={adding}
        />
        {/* The same comparison the web product page shows, built from the same
            service — so the two cannot compare different attributes. Its own
            screen rather than a block here: the table scrolls sideways, and it
            has no business fighting the page for that gesture. */}
        <Button
          label="Compare with similar"
          icon={Columns3}
          variant="outline"
          onPress={() => router.push(`/compare/${product.uuid}`)}
        />
        {cartMessage ? <Text style={styles.message}>{cartMessage}</Text> : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  well: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    overflow: "hidden",
    ...shadow.card,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 31,
  },
  price: {
    color: colors.primary,
    fontFamily: fonts.monoBold,
    fontSize: 26,
  },
  lead: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    marginTop: spacing.sm,
    lineHeight: 23,
  },
  description: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  action: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  message: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: "center",
  },
});

export default ProductScreen;
