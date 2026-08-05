import { SlidersHorizontal, X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FilterTree } from "@/components/products/filter-tree";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui/editorial";
import {
  colors,
  fonts,
  radius,
  spacing,
  tabular,
  tracking,
  type,
} from "@/lib/theme";
import type { TreeNode } from "@/lib/tree";
import type { Brand, Category, ProductSort, SpecFacet } from "@/lib/types";

/**
 * The four orders the catalogue offers, in the same words the web catalogue uses.
 * "Featured" is the order the merchandiser set, which is why it leads and why it
 * is what an untouched screen shows.
 */
const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

type FilterSheetProps = {
  /**
   * Category families, already assembled into a tree with rolled-up counts. Left
   * out on a screen that is already scoped to one category — the category page
   * offers facets, and a category picker there would navigate the shopper away
   * from the page they chose.
   */
  categories?: TreeNode<Category>[];
  selectedCategory?: string | null;
  onSelectCategory?: (uuid: string | null) => void;
  /** Products across the whole catalogue, shown against "All products". */
  totalProducts?: number;
  /**
   * Brands as a tree, with each maker's own products plus its houses'. Several
   * may be chosen at once — unlike category, where two families at once is a
   * question nobody asks.
   */
  brands?: TreeNode<Brand>[];
  selectedBrands?: string[];
  onToggleBrand?: (uuid: string) => void;
  sort?: ProductSort;
  onSort?: (value: ProductSort) => void;
  facets: SpecFacet[];
  selected: Record<string, string[]>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (next: Record<string, string[]>) => void;
};

type FacetBlockProps = {
  facet: SpecFacet;
  chosen: string[];
  onToggle: (value: string) => void;
};

const FacetBlock = ({ facet, chosen, onToggle }: FacetBlockProps) => (
  <View style={styles.facet}>
    <Text style={styles.facetLabel}>
      {facet.label}
      {facet.unit ? <Text style={styles.unit}> ({facet.unit})</Text> : null}
    </Text>
    {facet.ordered ? (
      // An ordered attribute is what the buyer HAS, and anything needing less
      // still fits. Without saying so, picking 1G looks like it should return
      // only 1G devices.
      <Text style={styles.hint}>What you have — shows anything that fits</Text>
    ) : null}
    <View style={styles.options}>
      {facet.options.map((option) => {
        const active = chosen.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onToggle(option.value)}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.chipActive : null,
              pressed ? styles.chipPressed : null,
            ]}
            // Colour alone does not tell a screen reader which values are
            // chosen, and these are toggles rather than links.
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${facet.label}: ${option.label}`}
          >
            <Text
              style={[styles.chipText, active ? styles.chipTextActive : null]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

/**
 * The filter sidebar the web catalog has, as a sheet: the category tree first,
 * then the specification facets that category offers.
 *
 * Category leads because the facets depend on it — an attribute assigned at
 * Networking has nothing to narrow while the shopper is looking at everything.
 * Facets are resolved by the API from the category's assignments, so this renders
 * whatever it is given and never needs to know the attribute library.
 *
 * The sheet no longer hides itself when a category offers no facets: it now holds
 * the category tree, which is the one filter that is always worth opening.
 */
export const FilterSheet = ({
  categories,
  selectedCategory = null,
  onSelectCategory,
  totalProducts = 0,
  brands,
  selectedBrands,
  onToggleBrand,
  sort = "featured",
  onSort,
  facets,
  selected,
  open,
  onOpen,
  onClose,
  onChange,
}: FilterSheetProps) => {
  const specCount = Object.values(selected).reduce(
    (total, values) => total + values.length,
    0,
  );
  const showCategories = Boolean(categories && categories.length > 0);
  const showBrands = Boolean(brands && brands.length > 0);
  const chosenBrands = selectedBrands ?? [];
  // Category and brands count as applied filters on the trigger, because from the
  // outside they are — the tally has to match what the shopper narrowed by.
  // Sort is deliberately absent from the tally and from Clear: it narrows
  // nothing, and resetting an order the shopper chose while they were clearing
  // filters would reshuffle the page under them.
  const count =
    specCount +
    (showCategories && selectedCategory ? 1 : 0) +
    (showBrands ? chosenBrands.length : 0);

  // Nothing to offer at all: no tree to pick from and no facets to narrow by.
  if (!showCategories && !showBrands && !onSort && facets.length === 0) {
    return null;
  }

  const toggle = (key: string, value: string) => {
    const current = selected[key] ?? [];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    const merged = { ...selected, [key]: next };
    if (next.length === 0) {
      delete merged[key];
    }
    onChange(merged);
  };

  return (
    <>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Filters, ${count} applied` : "Filters"}
        style={({ pressed }) => [
          styles.trigger,
          pressed ? styles.triggerPressed : null,
        ]}
      >
        <SlidersHorizontal color={colors.primary} size={15} />
        <Text style={styles.triggerText}>Filters</Text>
        {count > 0 ? <Text style={styles.triggerCount}>{count}</Text> : null}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close filters"
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <View style={styles.sheetHeadText}>
              <Kicker label="Refine" />
              <Text style={styles.sheetTitle}>Filters</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
            >
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            {onSort ? (
              <View style={styles.section}>
                <Text style={styles.facetLabel}>Sort</Text>
                <View style={styles.options}>
                  {SORT_OPTIONS.map((option) => {
                    const active = option.value === sort;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => onSort(option.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Sort by ${option.label}`}
                        style={({ pressed }) => [
                          styles.chip,
                          active ? styles.chipActive : null,
                          pressed ? styles.chipPressed : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active ? styles.chipTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {showCategories && categories ? (
              <View style={styles.section}>
                <Text style={styles.facetLabel}>Category</Text>
                {/* "All products" is a row like any other so clearing the category
                  is one tap in the same column, not a separate control. */}
                <Pressable
                  onPress={() => onSelectCategory?.(null)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectedCategory === null }}
                  accessibilityLabel="All products"
                  style={({ pressed }) => [
                    styles.allRow,
                    pressed ? styles.chipPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.allLabel,
                      selectedCategory === null ? styles.allLabelOn : null,
                    ]}
                  >
                    All products
                  </Text>
                  <Text style={styles.allCount}>{totalProducts}</Text>
                </Pressable>
                <FilterTree
                  roots={categories}
                  isSelected={(uuid) => uuid === selectedCategory}
                  onSelect={(uuid) =>
                    onSelectCategory?.(uuid === selectedCategory ? null : uuid)
                  }
                />
              </View>
            ) : null}

            {showBrands && brands ? (
              <View style={styles.section}>
                <Text style={styles.facetLabel}>Brand</Text>
                <FilterTree
                  roots={brands}
                  mode="multi"
                  isSelected={(uuid) => chosenBrands.includes(uuid)}
                  onSelect={(uuid) => onToggleBrand?.(uuid)}
                />
              </View>
            ) : null}

            {facets.map((facet) => (
              <FacetBlock
                key={facet.key}
                facet={facet}
                chosen={selected[facet.key] ?? []}
                onToggle={(value) => toggle(facet.key, value)}
              />
            ))}
          </ScrollView>

          <View style={styles.sheetFoot}>
            {count > 0 ? (
              <Button
                label="Clear"
                variant="outline"
                size="md"
                full={false}
                onPress={() => {
                  onChange({});
                  onSelectCategory?.(null);
                  chosenBrands.forEach((uuid) => onToggleBrand?.(uuid));
                }}
              />
            ) : null}
            <View style={styles.footGrow}>
              <Button label="Show results" size="md" onPress={onClose} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerPressed: { backgroundColor: colors.hover },
  triggerText: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: type.caption.size,
  },
  // A filled gold pill was the loudest thing on the list screen. The tally is
  // just a gold numeral — tabular, so 1 and 11 do not shift the label.
  triggerCount: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: type.caption.size,
    ...tabular,
  },
  // Warm ink, not the old blue-black: a cool scrim over warm paper reads as a
  // different app dimming a screenshot of this one.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(32, 31, 29, 0.4)",
  },
  // Paper, square, and separated from the scrim by a hairline rather than a
  // shadow — the sheet is a page sliding up, not a card floating over one.
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingBottom: spacing.xxl,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 1,
    backgroundColor: colors.borderStrong,
    marginTop: spacing.md,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetHeadText: { gap: spacing.xs },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.heading.size,
    lineHeight: type.heading.line,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  section: { gap: spacing.sm },
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  allLabel: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
  },
  allLabelOn: { color: colors.primary, fontFamily: fonts.medium },
  allCount: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    ...tabular,
  },
  facet: { gap: spacing.sm },
  // The same uppercase letterspaced label the profile details use, so a field
  // name looks like a field name wherever it turns up.
  facetLabel: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  unit: { color: colors.faint, fontFamily: fonts.bodyItalic },
  hint: {
    color: colors.faint,
    fontFamily: fonts.bodyItalic,
    fontSize: type.caption.size,
    marginTop: -2,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Border and label only. The gold tint belongs to hover; using it for the
  // chosen state as well leaves no way to tell the two apart under a finger.
  chipActive: { borderColor: colors.primaryBorder },
  chipPressed: { backgroundColor: colors.pressed },
  chipText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
  },
  chipTextActive: { color: colors.primary, fontFamily: fonts.medium },
  sheetFoot: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footGrow: { flex: 1 },
});
