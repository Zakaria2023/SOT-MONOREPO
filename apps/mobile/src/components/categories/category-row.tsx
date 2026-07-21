import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { ArrowRight, LayoutGrid } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, gradient, radius, shadow, spacing } from "@/lib/theme";
import type { Category } from "@/lib/types";

type CategoryRowProps = {
  category: Category;
};

// A full-bleed image card with a bottom scrim and the title overlaid — the
// mobile take on the client's bento category cards.
export const CategoryRow = ({ category }: CategoryRowProps) => (
  <Link href={`/category/${category.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.imageWrap}>
        {category.image ? (
          <Image
            source={category.image}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={gradient.wash}
            start={gradient.start}
            end={gradient.end}
            style={styles.image}
          >
            <LayoutGrid color={colors.primary} size={28} />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["transparent", "rgba(6,10,20,0.35)", "rgba(6,10,20,0.92)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.countPill}>
          <Text style={styles.countText}>{category.productCount}</Text>
        </View>
        <View style={styles.overlay}>
          <Text style={styles.name} numberOfLines={1}>
            {category.name}
          </Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Browse</Text>
            <ArrowRight color={colors.primary} size={15} />
          </View>
        </View>
      </View>
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.94,
  },
  imageWrap: {
    height: 132,
    justifyContent: "flex-end",
    backgroundColor: colors.surfaceAlt,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  countPill: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  countText: {
    color: "#ffffff",
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  overlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  name: {
    flex: 1,
    color: "#ffffff",
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ctaText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
