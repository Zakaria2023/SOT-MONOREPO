import { Image } from "expo-image";
import { Link } from "expo-router";
import { ChevronRight, Layers } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import type { Brand } from "@/lib/types";

type BrandRowProps = {
  brand: Brand;
};

export const BrandRow = ({ brand }: BrandRowProps) => (
  <Link href={`/brand/${brand.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {brand.image ? (
        <Image source={brand.image} style={styles.logo} contentFit="contain" />
      ) : (
        <View style={[styles.logo, styles.placeholder]}>
          <Layers color={colors.muted} size={20} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name}>{brand.name}</Text>
        {typeof brand.productCount === "number" ? (
          <Text style={styles.count}>
            {brand.productCount}{" "}
            {brand.productCount === 1 ? "product" : "products"}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={colors.muted} size={18} />
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  count: {
    color: colors.muted,
    fontSize: 13,
  },
});
