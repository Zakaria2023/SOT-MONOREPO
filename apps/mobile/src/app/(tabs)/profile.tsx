import { useAuth, useUser } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import {
  ChevronRight,
  Handshake,
  Layers,
  ReceiptText,
} from "lucide-react-native";
import { useCallback } from "react";
import type { ComponentType } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import { fetchMe } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type ProfileRowProps = {
  label: string;
  value: string | null;
};

type LinkRowProps = {
  href: "/brands" | "/offers" | "/partner";
  label: string;
  icon: ComponentType<{ color: string; size: number }>;
};

const ProfileRow = ({ label, value }: ProfileRowProps) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value ?? "—"}</Text>
  </View>
);

const LinkRow = ({ href, label, icon: Icon }: LinkRowProps) => (
  <Link href={href} asChild>
    <Pressable
      style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}
    >
      <Icon color={colors.text} size={20} />
      <Text style={styles.linkLabel}>{label}</Text>
      <ChevronRight color={colors.muted} size={18} />
    </Pressable>
  </Link>
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

      <View style={styles.links}>
        <LinkRow href="/brands" label="Browse brands" icon={Layers} />
        <LinkRow href="/offers" label="Your offers" icon={ReceiptText} />
        <LinkRow href="/partner" label="Become a partner" icon={Handshake} />
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
  links: {
    gap: spacing.md,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  linkLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
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
