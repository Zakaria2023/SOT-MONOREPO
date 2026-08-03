import { SlidersHorizontal, X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import type { SpecFacet } from "@/lib/types";

type FilterSheetProps = {
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
 * The facet sidebar the web catalog has, as a sheet. Facets are resolved by
 * the API from the category's assignments, so this renders whatever it is
 * given and never needs to know the attribute library.
 */
export const FilterSheet = ({
  facets,
  selected,
  open,
  onOpen,
  onClose,
  onChange,
}: FilterSheetProps) => {
  const count = Object.values(selected).reduce(
    (total, values) => total + values.length,
    0,
  );

  if (facets.length === 0) {
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
                onPress={() => onChange({})}
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
