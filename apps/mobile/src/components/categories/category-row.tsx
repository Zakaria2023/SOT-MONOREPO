import { Link } from "expo-router";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Numeral } from "@/components/ui/editorial";
import { colors, fonts, spacing, tabular, type } from "@/lib/theme";
import type { Category } from "@/lib/types";

type CategoryRowProps = {
  category: Category;
  /** Position in the list, rendered as a gold 01/02/03 numeral. */
  index?: number;
  last?: boolean;
  /** How deep in the tree — children are indented and set smaller. */
  depth?: number;
  /** Products in this category AND everything under it. */
  count?: number;
  /** Given only when the row has children: expanding is then a separate target. */
  onToggle?: () => void;
  expanded?: boolean;
};

/**
 * A hairline-divided row: gold tabular numeral, serif name, quiet meta line.
 *
 * The image tile is gone. Category art here is inconsistent — logos, product
 * shots, often nothing — so a 56px thumbnail column was mostly an empty grey
 * square with an icon in it, repeated down the page. A numbered index is honest
 * about what these are (an ordered contents list) and gives the eye something
 * regular to travel down.
 *
 * A parent row carries two targets: the name opens the category, the chevron opens
 * the branch. They are separate Pressables side by side rather than nested, because
 * a button inside a link is neither on a phone — whichever wins, the other feels
 * broken.
 */
export const CategoryRow = ({
  category,
  index,
  last = false,
  depth = 0,
  count,
  onToggle,
  expanded = false,
}: CategoryRowProps) => {
  const total = count ?? category.productCount;
  const isChild = depth > 0;

  return (
    <View
      style={[
        styles.wrap,
        last ? null : styles.divided,
        isChild ? { paddingLeft: spacing.lg * depth } : null,
      ]}
    >
      <View style={styles.link}>
        <Link href={`/category/${category.uuid}`} asChild>
          {/* No style prop on the Pressable: under asChild the web build assigns
              the cloned child's style straight onto the DOM node, so a style
              function is dropped and a style array throws. Everything visual lives
              on the View inside. */}
          <Pressable>
            {({ pressed }) => (
              <View style={[styles.row, pressed ? styles.pressed : null]}>
                {typeof index === "number" && !isChild ? (
                  <View style={styles.numeral}>
                    <Numeral value={index + 1} />
                  </View>
                ) : isChild ? (
                  <View style={styles.tick} />
                ) : null}

                <View style={styles.body}>
                  <Text
                    style={[styles.name, isChild ? styles.childName : null]}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {total} {total === 1 ? "product" : "products"}
                    {category.parentName ? ` · ${category.parentName}` : ""}
                  </Text>
                </View>

                {onToggle ? null : (
                  <ChevronRight color={colors.faint} size={16} />
                )}
              </View>
            )}
          </Pressable>
        </Link>
      </View>

      {onToggle ? (
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded ? `Collapse ${category.name}` : `Expand ${category.name}`
          }
          style={({ pressed }) => [
            styles.toggle,
            pressed ? styles.pressed : null,
          ]}
        >
          <ChevronDown
            color={expanded ? colors.primary : colors.faint}
            size={16}
          />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  link: { flex: 1, minWidth: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.hover },
  // Fixed width so the names align down the page regardless of the numeral.
  numeral: { width: 22 },
  // A child sits in its parent's numeral column with a short rule in place of a
  // number: the numbering belongs to the families, not to everything in the tree,
  // and numbering children too would imply an order they do not have.
  tick: {
    width: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  name: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.title.size,
    lineHeight: type.title.line,
  },
  childName: {
    fontSize: type.lead.size,
    color: colors.muted,
  },
  meta: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
    ...tabular,
  },
  toggle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
