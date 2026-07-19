import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatPrice } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
};

export const ProductCard = ({ product }: ProductCardProps) => (
  <Link href={`/product/${product.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <Image
        source={product.image}
        style={styles.image}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.body}>
        {product.categoryName ? (
          <Text style={styles.category}>{product.categoryName}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>
          {formatPrice(product.price, product.currency)}
        </Text>
      </View>
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.85,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surfaceAlt,
  },
  body: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  category: {
    color: colors.muted,
    fontSize: 12,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  price: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
});
