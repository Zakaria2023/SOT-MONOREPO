import { documentUrl } from "@/lib/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { ImageOff } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatPrice } from "@/lib/format";
import { colors, fonts, radius, shadow, spacing, type } from "@/lib/theme";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
};

// White card on a grey page — the surface does the separating, so the card
// needs no heavy border and no coloured wash behind the art. Product photos
// are mostly white boxes on white, and a light inset well is what makes them
// read as objects rather than float.
export const ProductCard = ({ product }: ProductCardProps) => (
  <Link href={`/product/${product.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.well}>
        {product.image ? (
          <Image
            source={documentUrl(product.image)}
            style={styles.image}
            contentFit="contain"
            transition={150}
          />
        ) : (
          <ImageOff color={colors.faint} size={26} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {product.brandName ?? product.categoryName ?? " "}
        </Text>
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
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  well: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  image: { width: "100%", height: "100%" },
  body: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.faint,
    fontFamily: fonts.semibold,
    fontSize: type.micro.size,
    lineHeight: type.micro.line,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
    // Two lines reserved, so a one-line name and a two-line name in the same
    // row still line their prices up.
    minHeight: type.caption.line * 2,
  },
  price: {
    color: colors.text,
    fontFamily: fonts.monoBold,
    fontSize: type.body.size,
    marginTop: spacing.xs,
  },
});
