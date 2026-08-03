import { documentUrl } from "@/lib/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { ImageOff } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Price } from "@/components/ui/editorial";
import { formatPrice } from "@/lib/format";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
};

/**
 * A tipped-in plate with its caption beneath — no card, no shadow, no fill.
 *
 * The image sits on a 6px paper mat inside a hairline, which is what separates it
 * from the page. Product photos here are mostly white boxes photographed on
 * white; the mat gives them an edge to end at, which a borderless card never did.
 *
 * The archival grade (warm, slightly desaturated) is applied per platform below —
 * see the note on `plate`.
 */
export const ProductCard = ({ product }: ProductCardProps) => (
  <Link href={`/product/${product.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.mat}>
        <View style={styles.plate}>
          {product.image ? (
            <Image
              source={documentUrl(product.image)}
              style={styles.image}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <ImageOff color={colors.faint} size={22} />
          )}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker} numberOfLines={1}>
          {product.brandName ?? product.categoryName ?? " "}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Price>{formatPrice(product.price, product.currency)}</Price>
      </View>
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  card: { flex: 1 },
  pressed: { backgroundColor: colors.hover },
  // The mat: paper, a half step off the page, 6px on every side.
  mat: {
    width: "100%",
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
    padding: spacing.md,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  body: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  kicker: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    lineHeight: type.kicker.line,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
  },
  name: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.lead.size,
    lineHeight: 21,
    // Two lines reserved, so a one-line and a two-line name in the same row
    // still line their prices up.
    minHeight: 42,
  },
});
