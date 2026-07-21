import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { ImageOff } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatPrice } from "@/lib/format";
import { colors, fonts, gradient, radius, shadow, spacing } from "@/lib/theme";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
};

export const ProductCard = ({ product }: ProductCardProps) => (
  <Link href={`/product/${product.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.well}>
        <LinearGradient
          colors={gradient.wash}
          start={gradient.start}
          end={gradient.end}
          style={styles.wash}
        />
        {product.image ? (
          <Image
            source={product.image}
            style={styles.image}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <ImageOff color={colors.faint} size={28} />
        )}
      </View>
      <View style={styles.body}>
        {product.brandName ? (
          <Text style={styles.brand} numberOfLines={1}>
            {product.brandName}
          </Text>
        ) : product.categoryName ? (
          <Text style={styles.category} numberOfLines={1}>
            {product.categoryName}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price} numberOfLines={1}>
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
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  well: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  body: {
    padding: spacing.md,
    gap: 3,
  },
  brand: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  category: {
    color: colors.faint,
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  name: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 19,
  },
  price: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});
