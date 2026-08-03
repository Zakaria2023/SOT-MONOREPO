import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Numeral } from "@/components/ui/editorial";
import { colors, fonts, spacing, type } from "@/lib/theme";
import type { Category } from "@/lib/types";

type CategoryRowProps = {
  category: Category;
  /** Position in the list, rendered as a gold 01/02/03 numeral. */
  index?: number;
  last?: boolean;
};

/**
 * A hairline-divided row: gold tabular numeral, serif name, quiet meta line.
 *
 * The image tile is gone. Category art here is inconsistent — logos, product
 * shots, often nothing — so a 56px thumbnail column was mostly an empty grey
 * square with an icon in it, repeated down the page. A numbered index is honest
 * about what these are (an ordered contents list) and gives the eye something
 * regular to travel down.
 */
export const CategoryRow = ({
  category,
  index,
  last = false,
}: CategoryRowProps) => (
  <Link href={`/category/${category.uuid}`} asChild>
    {/* No style prop on the Pressable: under asChild the web build assigns the
          cloned child's style straight onto the DOM node, so a style function is
          dropped and a style array throws. Everything visual lives on the View
          inside, and the press state arrives through the children function. */}
    <Pressable>
      {({ pressed }) => (
        <View
          style={[
            styles.row,
            last ? null : styles.divided,
            pressed ? styles.pressed : null,
          ]}
        >
          {typeof index === "number" ? (
            <View style={styles.numeral}>
              <Numeral value={index + 1} />
            </View>
          ) : null}

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

          <ChevronRight color={colors.faint} size={16} />
        </View>
      )}
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.md,
  },
  divided: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.hover },
  // Fixed width so the names align down the page regardless of the numeral.
  numeral: { width: 22 },
  body: { flex: 1, gap: 3 },
  name: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.title.size,
    lineHeight: type.title.line,
  },
  meta: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
  },
});
