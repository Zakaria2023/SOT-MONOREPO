import { Image } from "expo-image";
import { LayoutGrid } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import type { Category } from "@/lib/types";

type CategoryRowProps = {
  category: Category;
};

export const CategoryRow = ({ category }: CategoryRowProps) => (
  <View style={styles.row}>
    {category.image ? (
      <Image source={category.image} style={styles.image} contentFit="cover" />
    ) : (
      <View style={[styles.image, styles.placeholder]}>
        <LayoutGrid color={colors.muted} size={20} />
      </View>
    )}
    <View style={styles.body}>
      <Text style={styles.name}>{category.name}</Text>
      <Text style={styles.count}>
        {category.productCount}{" "}
        {category.productCount === 1 ? "product" : "products"}
      </Text>
    </View>
  </View>
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
  image: {
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
