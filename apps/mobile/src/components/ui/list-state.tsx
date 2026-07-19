import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/lib/theme";

type ListStateProps = {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyLabel: string;
  onRetry: () => void;
};

// Renders the loading / error / empty placeholder for a data screen, or null
// when there is data to show.
export const ListState = ({
  loading,
  error,
  empty,
  emptyLabel,
  onRetry,
}: ListStateProps) => {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button label="Retry" variant="ghost" onPress={onRetry} />
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{emptyLabel}</Text>
      </View>
    );
  }
  return null;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: 15,
    textAlign: "center",
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    textAlign: "center",
  },
});
