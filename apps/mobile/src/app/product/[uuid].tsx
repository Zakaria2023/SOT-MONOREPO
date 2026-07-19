import { useAuth } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import { addCartItem, fetchProduct } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const ProductScreen = () => {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { getToken } = useAuth();
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => fetchProduct(uuid), [uuid]);
  const { data: product, error, loading, reload } = useAsync(load);

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
    >
      <Stack.Screen options={{ title: product.name }} />
      <Image
        source={product.image}
        style={styles.image}
        contentFit="cover"
        transition={150}
      />
      {product.categoryName ? (
        <Text style={styles.category}>{product.categoryName}</Text>
      ) : null}
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>
        {formatPrice(product.price, product.currency)}
      </Text>
      {product.brandName ? (
        <Text style={styles.meta}>Brand: {product.brandName}</Text>
      ) : null}
      {product.shortDescription ? (
        <Text style={styles.lead}>{product.shortDescription}</Text>
      ) : null}
      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}

      <Button label="Add to cart" onPress={addToCart} loading={adding} />
      {cartMessage ? <Text style={styles.message}>{cartMessage}</Text> : null}
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
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: spacing.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  category: {
    color: colors.muted,
    fontSize: 13,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
  },
  price: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "600",
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
  },
  lead: {
    color: colors.text,
    fontSize: 15,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  message: {
    color: colors.text,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});

export default ProductScreen;
