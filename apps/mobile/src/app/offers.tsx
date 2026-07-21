import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { OfferCard } from "@/components/offers/offer-card";
import { ListState } from "@/components/ui/list-state";
import { fetchOffers } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const OffersScreen = () => {
  const { getToken } = useAuth();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Please sign in to view your offers.");
    }
    return fetchOffers(token);
  }, [getToken]);

  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && (data?.length ?? 0) === 0}
          emptyLabel="You have no offers yet."
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(item) => item.uuid}
      renderItem={({ item }) => <OfferCard offer={item} />}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
});

export default OffersScreen;
