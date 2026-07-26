import { Image } from "expo-image";
import { Link } from "expo-router";
import { ChevronRight, LayoutGrid } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadow, spacing, type } from "@/lib/theme";
import type { Category } from "@/lib/types";

type CategoryRowProps = {
  category: Category;
};

// A horizontal row with a small image tile, not a full-bleed photo card with
// white text on a dark scrim. Category art here is inconsistent — logos,
// product shots, sometimes nothing — and the old overlay was only legible
// because the dark theme could hide it under near-black. On paper the label
// belongs beside the image, where it always reads.
export const CategoryRow = ({ category }: CategoryRowProps) => (
  <Link href={`/category/${category.uuid}`} asChild>
    <Pressable
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.tile}>
        {category.image ? (
          <Image
            source={category.image}
            style={styles.image}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <LayoutGrid color={colors.faint} size={22} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {category.productCount}{" "}
          {category.productCount === 1 ? "product" : "products"}
          {category.parentName ? ` · ${category.parentName}` : ""}
        </Text>
      </View>

      <ChevronRight color={colors.faint} size={18} />
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
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  pressed: { backgroundColor: colors.hover },
  tile: {
    width: 56,
    height: 56,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  body: { flex: 1, gap: 2 },
  name: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
  },
  meta: {
    color: colors.faint,
    fontFamily: fonts.regular,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
  },
});
