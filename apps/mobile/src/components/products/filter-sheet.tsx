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
import { colors, fonts, radius, shadow, spacing, type } from "@/lib/theme";
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
        const active = chosen.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <Text
              style={[styles.chipText, active ? styles.chipTextActive : null]}
            >
              {option}
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
        style={({ pressed }) => [
          styles.trigger,
          pressed ? styles.triggerPressed : null,
        ]}
      >
        <SlidersHorizontal color={colors.text} size={16} />
        <Text style={styles.triggerText}>Filters</Text>
        {count > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={12}>
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
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  triggerPressed: { backgroundColor: colors.hover },
  triggerText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: type.caption.size,
  },
  countPill: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: colors.onAccent,
    fontFamily: fonts.semibold,
    fontSize: type.micro.size,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,17,23,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingBottom: spacing.xxl,
    ...shadow.raised,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginTop: spacing.md,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: type.title.size,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  facet: { gap: spacing.sm },
  facetLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: type.body.size,
  },
  unit: { color: colors.faint, fontFamily: fonts.regular },
  hint: {
    color: colors.faint,
    fontFamily: fonts.regular,
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
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: type.caption.size,
  },
  chipTextActive: { color: colors.primary, fontFamily: fonts.semibold },
  sheetFoot: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footGrow: { flex: 1 },
});
