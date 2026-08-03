import { documentUrl } from "@/lib/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadow, spacing } from "@/lib/theme";
import type { Brand } from "@/lib/types";

type BrandRowProps = {
  brand: Brand;
};

export const BrandRow = ({ brand }: BrandRowProps) => (
  <Link href={`/brand/${brand.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.logoTile}>
        {brand.image ? (
          <Image
            source={documentUrl(brand.image)}
            style={styles.logo}
            contentFit="contain"
          />
        ) : (
          <Text style={styles.initial}>{brand.name.charAt(0)}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {brand.name}
        </Text>
        {typeof brand.productCount === "number" ? (
          <Text style={styles.count}>
            {brand.productCount}{" "}
            {brand.productCount === 1 ? "product" : "products"}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={colors.faint} size={18} />
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.9,
  },
  logoTile: {
    width: 52,
    height: 52,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  initial: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  count: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
