import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, tabular, tracking, type } from "@/lib/theme";

type KickerProps = {
  label: string;
  /** Omit the leading rule where the kicker sits inline rather than opening a section. */
  rule?: boolean;
};

type RowProps = {
  children: ReactNode;
  /** Last row in a group — no rule beneath, so a list does not end on a line. */
  last?: boolean;
};

type PlateProps = {
  children: ReactNode;
  size?: number;
};

/**
 * A section opener: a short gold rule, then 9.5px uppercase letterspaced gold.
 *
 * The rule is 22px and fixed. It is doing the work a bold heading would do in a
 * SaaS layout — announcing a section without shouting — and it only reads that
 * way at a length short enough to be obviously ornamental.
 */
export const Kicker = ({ label, rule = true }: KickerProps) => (
  <View style={styles.kickerRow}>
    {rule ? <View style={styles.kickerRule} /> : null}
    <Text style={styles.kickerText}>{label}</Text>
  </View>
);

/** Full-width hairline. Every division in the app is one of these. */
export const Rule = () => <View style={styles.rule} />;

/**
 * A hairline-divided list row.
 *
 * Rows carry their own bottom rule instead of the list drawing separators,
 * because the last row must not have one — a list that ends on a line reads as
 * unfinished.
 */
export const ListRow = ({ children, last = false }: RowProps) => (
  <View style={[styles.listRow, last ? null : styles.listRowDivided]}>
    {children}
  </View>
);

/**
 * A tipped-in book plate: a paper mat with a hairline outline around the image.
 *
 * The 6px mat is what makes an image read as mounted on the page rather than
 * bled into it, and it is why product art needs no card and no shadow.
 */
export const Plate = ({ children, size }: PlateProps) => (
  <View style={[styles.plate, size ? { width: size, height: size } : null]}>
    <View style={styles.plateInner}>{children}</View>
  </View>
);

/**
 * Gold tabular numerals for a numbered list — 01, 02, 03.
 *
 * Tabular because the numbers stack: proportional digits make "01" and "11"
 * different widths, and the misalignment is visible immediately.
 */
export const Numeral = ({ value }: { value: number }) => (
  <Text style={styles.numeral}>{String(value).padStart(2, "0")}</Text>
);

/** A price. Italic gold, never heavy black — it is information, not a shout. */
export const Price = ({ children }: { children: ReactNode }) => (
  <Text style={styles.price}>{children}</Text>
);

/** The quiet meta line under a title: "3 products · Switching". */
export const Meta = ({ children }: { children: ReactNode }) => (
  <Text style={styles.meta}>{children}</Text>
);

const styles = StyleSheet.create({
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kickerRule: {
    width: 22,
    height: 1,
    backgroundColor: colors.primary,
  },
  kickerText: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: type.kicker.size,
    lineHeight: type.kicker.line,
    letterSpacing: tracking.kicker,
    textTransform: "uppercase",
    ...tabular,
  },
  rule: {
    height: 1,
    backgroundColor: colors.border,
  },
  listRow: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  listRowDivided: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  plate: {
    padding: 6,
    backgroundColor: colors.surface,
  },
  plateInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  numeral: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: type.caption.size,
    ...tabular,
  },
  price: {
    color: colors.primary,
    fontFamily: fonts.bodyItalic,
    fontSize: type.body.size,
    ...tabular,
  },
  meta: {
    color: colors.faint,
    fontFamily: fonts.body,
    fontSize: type.caption.size,
    lineHeight: type.caption.line,
  },
});
