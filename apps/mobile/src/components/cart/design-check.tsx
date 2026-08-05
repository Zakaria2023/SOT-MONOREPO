import { AlertTriangle, Check, ShieldAlert } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import type { DesignCheckResult, DesignFinding } from "@/lib/types";
import { colors, fonts, spacing, tracking, type } from "@/lib/theme";

type DesignCheckProps = {
  result: DesignCheckResult | null;
  checking: boolean;
};

type FindingRowProps = {
  finding: DesignFinding;
  last?: boolean;
};

const FindingRow = ({ finding, last = false }: FindingRowProps) => {
  const blocking = finding.tone === "block";
  const Icon = blocking ? ShieldAlert : AlertTriangle;
  const accent = blocking ? colors.danger : colors.primary;

  return (
    <View style={[styles.finding, last ? null : styles.divided]}>
      <Icon
        color={accent}
        size={15}
        strokeWidth={1.6}
        style={styles.findingIcon}
      />
      <View style={styles.findingBody}>
        <Text style={[styles.findingTitle, { color: accent }]}>
          {finding.title}
        </Text>
        {/* A line per product beats the engine's semicolon-joined sentence, which
            at phone width wraps into a paragraph the buyer has to parse. The
            sentence still stands in where the skip names no product. */}
        {finding.skipped && finding.skipped.length > 0 ? (
          finding.skipped.map((item) => (
            <Text key={item.productUuid} style={styles.findingMessage}>
              {item.name} — no value for {item.missing.join(", ")}
            </Text>
          ))
        ) : (
          <Text style={styles.findingMessage}>{finding.message}</Text>
        )}
        {/* Every correction is add supply, reduce demand, or swap — the buyer is
            never told only that something is wrong. */}
        {finding.corrections.map((correction, index) => (
          <Text key={index} style={styles.suggestions}>
            {correction.message}
            {correction.products.length > 0
              ? ` e.g. ${correction.products.map((entry) => entry.name).join(", ")}`
              : ""}
          </Text>
        ))}
      </View>
    </View>
  );
};

/**
 * What the engines make of this basket, shown before the buyer commits.
 *
 * Blockers lead, because they are what stops the order. A clean basket still says
 * so — silence would read as "not checked", and the point of the check is the
 * confidence it gives, not only the errors it catches.
 *
 * No card and no tint. The old panel carried leftover blue and green borders from
 * the previous palette, two colours that exist nowhere else in the app now.
 * Severity is carried by the kicker's rule and the icon beside each finding.
 */
export const DesignCheck = ({ result, checking }: DesignCheckProps) => {
  if (checking && !result) {
    return (
      <View style={styles.block}>
        <Text style={styles.checking}>Checking your design…</Text>
      </View>
    );
  }
  if (!result) {
    return null;
  }

  const { blockers, warnings, unknowns } = result;

  if (blockers.length === 0 && warnings.length === 0 && unknowns.length === 0) {
    return (
      <View style={styles.clean}>
        <Check color={colors.success} size={15} strokeWidth={1.8} />
        <Text style={styles.cleanText}>
          This design checks out — nothing missing, nothing over capacity.
        </Text>
      </View>
    );
  }

  const findings = [...blockers, ...warnings, ...unknowns];
  const blocked = blockers.length > 0;

  return (
    <View style={styles.block}>
      <View style={styles.kickerRow}>
        <View
          style={[styles.kickerRule, blocked ? styles.kickerRuleBad : null]}
        />
        <Text style={[styles.kicker, blocked ? styles.kickerBad : null]}>
          {blocked
            ? `${blockers.length} problem${blockers.length === 1 ? "" : "s"} to fix`
            : warnings.length > 0
              ? `${warnings.length} thing${warnings.length === 1 ? "" : "s"} to check`
              : `${unknowns.length} check${unknowns.length === 1 ? "" : "s"} we could not run`}
        </Text>
      </View>
      {/* Unknowns last, and never counted as problems — but never dropped either.
          A check we could not make must not read as one that passed. */}
      {findings.map((finding, index) => (
        <FindingRow
          key={finding.id}
          finding={finding}
          last={index === findings.length - 1}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kickerRule: { width: 22, height: 1, backgroundColor: colors.primary },
  kickerRuleBad: { backgroundColor: colors.danger },
  kicker: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: type.kicker.size,
    lineHeight: type.kicker.line,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
  },
  kickerBad: { color: colors.danger },
  checking: {
    color: colors.faint,
    fontFamily: fonts.bodyItalic,
    fontSize: type.caption.size,
  },
  clean: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cleanText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
  },
  finding: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.border },
  findingIcon: { marginTop: 3 },
  findingBody: { flex: 1, minWidth: 0, gap: 3 },
  findingTitle: {
    fontFamily: fonts.heading,
    fontSize: type.lead.size,
  },
  findingMessage: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
  },
  suggestions: {
    color: colors.faint,
    fontFamily: fonts.bodyItalic,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
    marginTop: 2,
  },
});
