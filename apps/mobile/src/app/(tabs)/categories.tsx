import { useCallback } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { CategoryRow } from "@/components/categories/category-row";
import { Kicker, Rule } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import { Masthead } from "@/components/ui/masthead";
import { fetchCategories } from "@/lib/api";
import { colors, fonts, spacing, type } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import { countIn } from "@/lib/words";

const CategoriesScreen = () => {
  const load = useCallback(() => fetchCategories(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
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
        data={data}
        keyExtractor={(item) => item.uuid}
        ListHeaderComponent={
          <View style={styles.header}>
            <Kicker label="Solutions" />
            <Text style={styles.title}>Shop by category</Text>
            {/* A sentence, not "30 CATEGORIES" in a corner: the count is a line
                of the page here, not a data readout. */}
            <Text style={styles.subtitle}>
              {countIn(data.length, "category", "categories")}, sorted by
              specification.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <CategoryRow
            category={item}
            index={index}
            last={index === (data?.length ?? 0) - 1}
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
