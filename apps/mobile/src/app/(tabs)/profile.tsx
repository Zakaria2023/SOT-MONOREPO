import { useAuth, useUser } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import {
  ChevronRight,
  Handshake,
  Layers,
  Package,
  ReceiptText,
} from "lucide-react-native";
import { useCallback } from "react";
import type { ComponentType } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ListState } from "@/components/ui/list-state";
import { fetchMe } from "@/lib/api";
import { colors, fonts, radius, shadow, spacing } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type ProfileRowProps = {
  label: string;
  value: string | null;
};

type LinkRowProps = {
  href: "/brands" | "/offers" | "/orders" | "/partner";
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
      <View style={styles.linkIcon}>
        <Icon color={colors.primary} size={18} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      <ChevronRight color={colors.faint} size={18} />
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

  const name = data.fullName ?? user?.fullName ?? "SOT customer";
  const initial = name.charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        {data.company ? (
          <Text style={styles.company}>{data.company}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <ProfileRow
          label="Email"
          value={data.email ?? user?.primaryEmailAddress?.emailAddress ?? null}
        />
        <View style={styles.divider} />
        <ProfileRow label="Phone" value={data.phone} />
        <View style={styles.divider} />
        <ProfileRow label="Company" value={data.company} />
      </View>

      <View style={styles.links}>
        <LinkRow href="/brands" label="Browse brands" icon={Layers} />
        <LinkRow href="/offers" label="Your offers" icon={ReceiptText} />
        <LinkRow href="/orders" label="Your orders" icon={Package} />
        <LinkRow href="/partner" label="Become a partner" icon={Handshake} />
      </View>

      <Button label="Sign out" variant="outline" onPress={() => signOut()} />
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
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  identity: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glow,
  },
  avatarText: {
    color: colors.onAccent,
    fontFamily: fonts.monoBold,
    fontSize: 34,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 26,
  },
  company: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  links: {
    gap: spacing.md,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  pressed: {
    opacity: 0.9,
  },
  linkLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  field: {
    gap: 3,
  },
  label: {
    color: colors.faint,
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  value: {
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
});

export default ProfileScreen;
