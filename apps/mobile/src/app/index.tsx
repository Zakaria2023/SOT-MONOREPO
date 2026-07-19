import { useAuth, useUser } from "@clerk/clerk-expo";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/lib/theme";

const HomeScreen = () => {
  const { user } = useUser();
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SOT Mobile</Text>
      <Text style={styles.subtitle}>
        Signed in as {user?.primaryEmailAddress?.emailAddress ?? "your account"}
      </Text>
      <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
});

export default HomeScreen;
