import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadow, spacing } from "@/lib/theme";
import type { Brand } from "@/lib/types";

type BrandChipProps = {
  brand: Brand;
};

// Logo tile overlapping a gradient band, centered name — the client's brand
// card, condensed for a horizontal scroller.
export const BrandChip = ({ brand }: BrandChipProps) => (
  <Link href={`/brand/${brand.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
    >
      <View style={[styles.band, { backgroundColor: colors.primary }]} />
      <View style={styles.logoTile}>
        {brand.image ? (
          <Image
            source={brand.image}
            style={styles.logo}
            contentFit="contain"
          />
        ) : (
          <Text style={styles.initial}>{brand.name.charAt(0)}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {brand.name}
      </Text>
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  chip: {
    width: 130,
    alignItems: "center",
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  pressed: {
    opacity: 0.92,
  },
  band: {
    height: 26,
    width: "100%",
  },
  logoTile: {
    width: 60,
    height: 60,
    marginTop: -22,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  initial: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 26,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 13,
    paddingHorizontal: spacing.sm,
    textAlign: "center",
  },
});
