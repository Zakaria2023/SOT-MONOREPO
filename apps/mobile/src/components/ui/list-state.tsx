import { PackageOpen, TriangleAlert } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { colors, fonts, radius, spacing } from "@/lib/theme";

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
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.iconWell}>
          <TriangleAlert color={colors.danger} size={26} />
        </View>
        <Text style={styles.error}>{error}</Text>
        <Button label="Try again" variant="outline" onPress={onRetry} />
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <View style={styles.iconWell}>
          <PackageOpen color={colors.faint} size={26} />
        </View>
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
    gap: spacing.lg,
  },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: "center",
  },
});
