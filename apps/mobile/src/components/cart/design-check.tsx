import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import type { DesignCheckResult, DesignFinding } from "@/lib/types";
import { colors, fonts, radius, spacing } from "@/lib/theme";

type DesignCheckProps = {
  result: DesignCheckResult | null;
  checking: boolean;
};

type FindingRowProps = {
  finding: DesignFinding;
};

const FindingRow = ({ finding }: FindingRowProps) => {
  const blocking = finding.tone === "block";
  const Icon = blocking ? ShieldAlert : AlertTriangle;
  const accent = blocking ? colors.danger : colors.primary;

  return (
    <View style={styles.finding}>
      <Icon color={accent} size={16} style={styles.findingIcon} />
      <View style={styles.findingBody}>
        <Text style={[styles.findingTitle, { color: accent }]}>
          {finding.title}
        </Text>
        <Text style={styles.findingMessage}>{finding.message}</Text>
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
 * Blockers lead, because they are what stops the order. A clean basket still
 * says so — silence would read as "not checked", and the point of the check is
 * the confidence it gives, not only the errors it catches.
 */
export const DesignCheck = ({ result, checking }: DesignCheckProps) => {
  if (checking && !result) {
    return (
      <View style={styles.card}>
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
      <View style={[styles.card, styles.clean]}>
        <CheckCircle2 color={colors.success} size={16} />
        <Text style={styles.cleanText}>
          This design checks out — nothing missing, nothing over capacity.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        blockers.length > 0 ? styles.blocked : styles.warned,
      ]}
    >
      <Text style={styles.heading}>
        {blockers.length > 0
          ? `${blockers.length} problem${blockers.length === 1 ? "" : "s"} to fix`
          : warnings.length > 0
            ? `${warnings.length} thing${warnings.length === 1 ? "" : "s"} to check`
            : `${unknowns.length} check${unknowns.length === 1 ? "" : "s"} we could not run`}
      </Text>
      {/* Unknowns last, and never counted as problems — but never dropped
          either. A check we could not make must not read as one that passed. */}
      {[...blockers, ...warnings, ...unknowns].map((finding) => (
        <FindingRow key={finding.id} finding={finding} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  blocked: { borderColor: "rgba(239,68,68,0.35)" },
  warned: { borderColor: "rgba(34,211,238,0.30)" },
  clean: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderColor: "rgba(52,226,155,0.30)",
  },
  cleanText: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  checking: {
    color: colors.faint,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  finding: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  findingIcon: { marginTop: 2 },
  findingBody: { flex: 1, gap: 2 },
  findingTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  findingMessage: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  suggestions: {
    color: colors.faint,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: 2,
  },
});
