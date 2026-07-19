import { useAuth, useUser } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import { fetchMe } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type ProfileRowProps = {
  label: string;
  value: string | null;
};

const ProfileRow = ({ label, value }: ProfileRowProps) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value ?? "—"}</Text>
  </View>
);

const ProfileScreen = () => {
  const { user } = useUser();
  const { getToken, signOut } = useAuth();

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Not signed in.");
    }
    return fetchMe(token);
  }, [getToken]);

  const { data, error, loading, reload } = useAsync(load);

  if (loading || error || !data) {
    return (
      <View style={styles.container}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !data}
          emptyLabel="No profile found."
          onRetry={reload}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.card}>
        <ProfileRow
          label="Name"
          value={data.fullName ?? user?.fullName ?? null}
        />
        <ProfileRow
          label="Email"
          value={data.email ?? user?.primaryEmailAddress?.emailAddress ?? null}
        />
        <ProfileRow label="Phone" value={data.phone} />
        <ProfileRow label="Company" value={data.company} />
      </View>
      <Button label="Sign out" variant="ghost" onPress={() => signOut()} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  value: {
    color: colors.text,
    fontSize: 16,
  },
});

export default ProfileScreen;
