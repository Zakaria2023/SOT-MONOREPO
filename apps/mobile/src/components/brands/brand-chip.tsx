import { documentUrl } from "@/lib/api";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, tabular, type } from "@/lib/theme";
import type { Brand } from "@/lib/types";

type BrandChipProps = {
  brand: Brand;
};

/**
 * A brand in a horizontal scroller: bordered square well, name beneath.
 *
 * The gold band and the overlapping tile are gone. A filled colour block was the
 * loudest thing in any row it appeared in, and it repeated — six of them across a
 * scroller read as a toolbar rather than a list of makers.
 */
export const BrandChip = ({ brand }: BrandChipProps) => (
  <Link href={`/brand/${brand.uuid}`} asChild>
    {/* No style prop on the Pressable: under asChild the web build assigns the
          cloned child's style straight onto the DOM node, so a style function is
          dropped and a style array throws. Everything visual lives on the View
          inside, and the press state arrives through the children function. */}
    <Pressable>
      {({ pressed }) => (
        <View style={[styles.chip, pressed ? styles.pressed : null]}>
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

          <Text style={styles.name} numberOfLines={1}>
            {brand.name}
          </Text>
          {typeof brand.productCount === "number" ? (
            <Text style={styles.count}>{brand.productCount}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
  </Link>
);

const styles = StyleSheet.create({
  chip: {
    width: 104,
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: colors.hover },
  well: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  logo: { width: "100%", height: "100%" },
  initial: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 28,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.body.size,
    textAlign: "center",
  },
  count: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    ...tabular,
  },
});
