import { documentUrl } from "@/lib/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, tabular, type } from "@/lib/theme";
import type { Brand } from "@/lib/types";

type BrandRowProps = {
  brand: Brand;
  last?: boolean;
};

/**
 * A hairline row with the logo in a bordered square well.
 *
 * The well is an outline on the paper rather than a grey tile: brand logos arrive
 * on transparent backgrounds in every possible colour, and a filled tile behind
 * them made each one look like a different shade of the same mistake. Where there
 * is no logo, a serif initial stands in.
 */
export const BrandRow = ({ brand, last = false }: BrandRowProps) => (
  <Link href={`/brand/${brand.uuid}`} asChild>
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
          <View style={styles.well}>
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
    gap: spacing.lg,
    minHeight: 44,
    paddingVertical: spacing.md,
  },
  divided: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.hover },
  well: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  logo: { width: "100%", height: "100%" },
  initial: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 22,
  },
  body: { flex: 1, gap: 3 },
  name: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.title.size,
    lineHeight: type.title.line,
  },
  count: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    ...tabular,
  },
});
