import { useAuth, useUser } from "@clerk/clerk-expo";
import { Link } from "expo-router";
import {
  ChevronRight,
  Handshake,
  Layers,
  LogOut,
  Package,
  ReceiptText,
} from "lucide-react-native";
import { useCallback } from "react";
import type { ComponentType } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Kicker, Rule } from "@/components/ui/editorial";
import { ListState } from "@/components/ui/list-state";
import { Masthead } from "@/components/ui/masthead";
import { fetchMe } from "@/lib/api";
import {
  colors,
  fonts,
  radius,
  spacing,
  tabular,
  tracking,
  type,
} from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type DetailRowProps = {
  label: string;
  value: string | null;
  /** Shown beside an empty value, so a gap reads as an invitation not a blank. */
  addLabel?: string;
  last?: boolean;
};

type LinkRowProps = {
  href: "/brands" | "/offers" | "/orders" | "/partner";
  label: string;
  icon: ComponentType<{ color: string; size: number }>;
  last?: boolean;
};

/**
 * A detail row: uppercase letterspaced label above its value, hairline beneath.
 *
 * No card, no shadow. The old version wrapped these three in a white panel, which
 * made them look like a form — and there is nothing here to submit.
 *
 * A missing value reads as italic grey "Not provided" with a small gold "Add"
 * beside it. An empty row that says nothing looks like a bug; one that offers the
 * fix reads as a prompt.
 */
const DetailRow = ({
  label,
  value,
  addLabel,
  last = false,
}: DetailRowProps) => (
  <View style={[styles.detailRow, last ? null : styles.divided]}>
    <View style={styles.detailBody}>
      <Text style={styles.detailLabel}>{label}</Text>
      {value ? (
        <Text style={styles.detailValue}>{value}</Text>
      ) : (
        <Text style={styles.detailEmpty}>Not provided</Text>
      )}
    </View>

    {!value && addLabel ? (
      <Pressable
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`${addLabel} ${label.toLowerCase()}`}
        style={({ pressed }) => [
          styles.addWrap,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.addText}>{addLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

/** An account link: gold outline icon, serif label, grey chevron. No tinted tile. */
const LinkRow = ({ href, label, icon: Icon, last = false }: LinkRowProps) => (
  <Link href={href} asChild>
    {/* No style prop on the Pressable: under asChild the web build assigns the
          cloned child's style straight onto the DOM node, so a style function is
          dropped and a style array throws. Everything visual lives on the View
          inside, and the press state arrives through the children function. */}
    <Pressable>
      {({ pressed }) => (
        <View
          style={[
            styles.linkRow,
            last ? null : styles.divided,
            pressed ? styles.pressed : null,
          ]}
        >
          <Icon color={colors.primary} size={18} />
          <Text style={styles.linkLabel}>{label}</Text>
          <ChevronRight color={colors.faint} size={16} />
        </View>
      )}
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
  const email = data.email ?? user?.primaryEmailAddress?.emailAddress ?? null;
  // Clerk's createdAt is the only join date available — the profile row carries
  // none, so the line is omitted rather than invented if it is missing.
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).getFullYear()
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Masthead label="Account" />
      <Rule />

      {/* The initial in a gold OUTLINE circle, not a filled disc — 82px of solid
          gold would be the loudest thing in the app by a distance. */}
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{initial}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        {memberSince ? (
          <Text style={styles.since}>Member since {memberSince}</Text>
        ) : null}
      </View>
      <Rule />

      <View style={styles.details}>
        <DetailRow label="Email" value={email} addLabel="Add" />
        <DetailRow label="Phone" value={data.phone} addLabel="Add" />
        <DetailRow label="Company" value={data.company} addLabel="Add" last />
      </View>
      <Rule />

      <View style={styles.section}>
        <Kicker label="Your account" />
        <View style={styles.links}>
          <LinkRow href="/brands" label="Browse brands" icon={Layers} />
          <LinkRow href="/offers" label="Your offers" icon={ReceiptText} />
          <LinkRow href="/orders" label="Your orders" icon={Package} />
          <LinkRow
            href="/partner"
            label="Become a partner"
            icon={Handshake}
            last
          />
        </View>
      </View>

      <View style={styles.signOut}>
        <Button
          label="Sign out"
          variant="outline"
          icon={LogOut}
          onPress={() => signOut()}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },

  identity: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 34,
    // The serif's optical centre sits above its metric one at this size.
    marginTop: 4,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: type.display.size,
    lineHeight: type.display.line,
    textAlign: "center",
  },
  since: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.kicker.size,
    letterSpacing: tracking.label,
    textTransform: "uppercase",
    ...tabular,
  },

  details: { paddingHorizontal: spacing.lg },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.lg,
    minHeight: 44,
    paddingVertical: spacing.md,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailBody: { flex: 1, gap: 4 },
  detailLabel: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.line,
  },
  detailEmpty: {
    color: colors.faint,
    fontFamily: fonts.bodyItalic,
    fontSize: type.body.size,
    lineHeight: type.body.line,
  },
  addWrap: { paddingBottom: 2, justifyContent: "flex-end", minHeight: 44 },
  addText: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: type.kicker.size,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
    paddingBottom: 3,
  },

  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  links: { borderTopWidth: 1, borderTopColor: colors.border },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.md,
  },
  linkLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: type.title.size,
  },
  pressed: { backgroundColor: colors.hover },

  signOut: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
});

export default ProfileScreen;
