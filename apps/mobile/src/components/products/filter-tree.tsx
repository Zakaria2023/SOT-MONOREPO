import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, tabular, type } from "@/lib/theme";
import type { FlatNode, TreeNode } from "@/lib/tree";

type Named = FlatNode & { name: string };

type FilterTreeProps<T extends Named> = {
  roots: TreeNode<T>[];
  /** True for a node the shopper has chosen. */
  isSelected: (uuid: string) => boolean;
  onSelect: (uuid: string) => void;
  /**
   * "single" draws a gold hairline square with a tick — one choice, and choosing
   * another replaces it. "multi" is the same mark on independent boxes.
   */
  mode?: "single" | "multi";
};

type RowProps = {
  name: string;
  count: number;
  depth: number;
  selected: boolean;
  expanded: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onToggle: () => void;
};

/**
 * One filter row: a mark, the name, its rolled-up count, and — where the node has
 * children — a chevron that opens the branch.
 *
 * The mark is an outlined square that fills with a gold tick, never a filled block:
 * a checked box painted solid would be the only solid shape in the sheet, and there
 * can be a dozen of them on screen at once.
 */
const FilterRow = ({
  name,
  count,
  depth,
  selected,
  expanded,
  hasChildren,
  onSelect,
  onToggle,
}: RowProps) => (
  <View style={styles.row}>
    <Pressable
      onPress={onSelect}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      style={({ pressed }) => [
        styles.main,
        { paddingLeft: depth * spacing.lg },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.mark, selected ? styles.markOn : null]}>
        {selected ? (
          <Check color={colors.primary} size={12} strokeWidth={2} />
        ) : null}
      </View>
      <Text
        style={[
          styles.name,
          depth > 0 ? styles.child : null,
          selected ? styles.nameOn : null,
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </Pressable>

    {hasChildren ? (
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? `Collapse ${name}` : `Expand ${name}`}
        style={({ pressed }) => [
          styles.toggle,
          pressed ? styles.pressed : null,
        ]}
      >
        <ChevronDown
          color={expanded ? colors.primary : colors.faint}
          size={15}
        />
      </Pressable>
    ) : null}
  </View>
);

/**
 * A category or brand tree inside the filter sheet.
 *
 * Branches start closed. The catalogue is thirty categories deep in four families,
 * and opening them all would put the specification facets three screens below the
 * fold — which is where the shopper who opened "Filters" was actually heading.
 *
 * Choosing a parent means the parent AND everything under it; the caller expands
 * the uuid to its subtree before querying, because products sit in the leaves and
 * a query for "Networking" alone comes back empty.
 */
export const FilterTree = <T extends Named>({
  roots,
  isSelected,
  onSelect,
  mode = "single",
}: FilterTreeProps<T>) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (uuid: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });

  const render = (nodes: TreeNode<T>[], depth: number): React.ReactNode[] =>
    nodes.flatMap((node) => [
      <FilterRow
        key={node.uuid}
        name={node.name}
        count={node.count}
        depth={depth}
        selected={isSelected(node.uuid)}
        expanded={expanded.has(node.uuid)}
        hasChildren={node.children.length > 0}
        onSelect={() => onSelect(node.uuid)}
        onToggle={() => toggle(node.uuid)}
      />,
      ...(expanded.has(node.uuid) ? render(node.children, depth + 1) : []),
    ]);

  return (
    <View accessibilityRole={mode === "single" ? "radiogroup" : undefined}>
      {render(roots, 0)}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: colors.pressed },
  mark: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  markOn: { borderColor: colors.primaryBorder },
  name: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
  },
  child: { color: colors.muted },
  nameOn: { color: colors.primary, fontFamily: fonts.medium },
  count: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    ...tabular,
  },
  toggle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
