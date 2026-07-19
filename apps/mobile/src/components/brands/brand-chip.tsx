import { Image } from "expo-image";
import { Link } from "expo-router";
import { Layers } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import type { Brand } from "@/lib/types";

type BrandChipProps = {
  brand: Brand;
};

export const BrandChip = ({ brand }: BrandChipProps) => (
  <Link href={`/brand/${brand.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
    >
      {brand.image ? (
        <Image source={brand.image} style={styles.logo} contentFit="contain" />
      ) : (
        <View style={[styles.logo, styles.placeholder]}>
          <Layers color={colors.muted} size={20} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {brand.name}
      </Text>
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  chip: {
    width: 110,
    alignItems: "center",
    gap: spacing.sm,
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
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
});
