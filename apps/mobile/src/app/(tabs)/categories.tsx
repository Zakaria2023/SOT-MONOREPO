import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { CategoryRow } from "@/components/categories/category-row";
import { Kicker, Rule } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import { Masthead } from "@/components/ui/masthead";
import { fetchCategories } from "@/lib/api";
import { colors, fonts, spacing, type } from "@/lib/theme";
import { buildTree, type TreeNode } from "@/lib/tree";
import type { Category } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { countIn } from "@/lib/words";

type Row = {
  node: TreeNode<Category>;
  depth: number;
  /** Only families are numbered; the index is their position among the roots. */
  index?: number;
};

/**
 * The visible rows, in reading order: every root, and the children of whichever
 * branches are open.
 *
 * Flattened rather than nested so the whole screen is one FlatList. A tree of
 * nested ScrollViews would virtualise nothing and would fight the outer list for
 * the same vertical gesture.
 */
const visibleRows = (
  roots: TreeNode<Category>[],
  expanded: Set<string>,
): Row[] => {
  const rows: Row[] = [];
  const walk = (node: TreeNode<Category>, depth: number, index?: number) => {
    rows.push({ node, depth, index });
    if (expanded.has(node.uuid)) {
      node.children.forEach((child) => walk(child, depth + 1));
    }
  };
  roots.forEach((root, index) => walk(root, 0, index));
  return rows;
};

const CategoriesScreen = () => {
  const load = useCallback(() => fetchCategories(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // The API returns the tree flat, carrying parentUuid — the shape is assembled
  // here, and each family's count is rolled up from its leaves, because a parent
  // category holds no products of its own and would otherwise read "0 products".
  const roots = useMemo(
    () => buildTree(data ?? [], (category) => category.productCount),
    [data],
  );
  const rows = useMemo(() => visibleRows(roots, expanded), [roots, expanded]);

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

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Masthead label="Solutions" />
        <Rule />
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="No categories yet."
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Masthead label="Solutions" />
      <Rule />

      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(row) => row.node.uuid}
        ListHeaderComponent={
          <View style={styles.header}>
            <Kicker label="Solutions" />
            <Text style={styles.title}>Shop by category</Text>
            {/* Counts the families, not the 30 rows in the tree: the sentence is
                about how the catalogue is organised, and every child is already
                inside one of these. */}
            <Text style={styles.subtitle}>
              {countIn(roots.length, "family", "families")}, sorted by
              specification.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <CategoryRow
            category={item.node}
            index={item.index}
            depth={item.depth}
            count={item.node.count}
            last={index === rows.length - 1}
            onToggle={
              item.node.children.length > 0
                ? () => toggle(item.node.uuid)
                : undefined
            }
            expanded={expanded.has(item.node.uuid)}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // No gap: the rows draw their own hairlines and a gap would leave the rules
  // floating apart instead of reading as one ruled list.
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.display.size,
    lineHeight: type.display.line,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.bodyItalic,
    fontSize: type.body.size,
    lineHeight: type.body.line,
  },
});

export default CategoriesScreen;
