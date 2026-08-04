import type { TextStyle } from "react-native";

// Mobile design tokens — editorial, not SaaS.
//
// The previous system was a light B2B dashboard: blue accent, grotesk everywhere,
// grey-filled cards lifted on shadows. This one is a printed catalogue. Structure
// comes from hairline rules rather than tinted boxes, emphasis from italics and
// size rather than weight, and exactly one colour carries every accent.
//
// Three rules the whole system depends on:
//   nothing is bold — Cormorant sits at 400 at display sizes, and weight never
//     substitutes for hierarchy;
//   nothing is filled — buttons and chips are 1px outlines on the paper;
//   nothing is blue — one gold, used sparingly enough that it still reads as an
//     accent when it appears.

export const colors = {
  // Paper. Warm near-white, not white: on a true #fff page the mats and
  // hairlines vanish, because there is nothing for them to sit on.
  background: "#f3f2f2",
  // The mat behind a product plate — a half step off the page, so an image reads
  // as tipped onto the paper rather than cut into it.
  surface: "#f7f6f5",
  surfaceAlt: "#eeecea",
  sunken: "#e7e4e1",
  overlay: "#f7f6f5",

  // Ink. One near-black and two greys; more than that and the page stops being
  // quiet.
  text: "#201f1d",
  muted: "#6b665f",
  faint: "#969087",
  placeholder: "#a8a29a",
  onAccent: "#f7f6f5",

  // Hairlines. `border` draws almost every division in the app — no grey fill
  // does that job anywhere.
  border: "#dedad5",
  borderStrong: "#cdc7c0",
  hover: "rgba(182, 130, 53, 0.06)", // faint gold tint
  pressed: "rgba(182, 130, 53, 0.12)", // one ramp step darker

  // The single accent: kickers, rules, numerals, prices, active tab, focus.
  primary: "#b68235",
  primaryHover: "#9c6d29",
  primaryTint: "rgba(182, 130, 53, 0.08)",
  primaryBorder: "rgba(182, 130, 53, 0.45)",

  // States, desaturated so they belong to the same page as the gold.
  success: "#4a6b46",
  successTint: "rgba(74, 107, 70, 0.08)",
  danger: "#8c3b32",
  dangerTint: "rgba(140, 59, 50, 0.08)",
  warning: "#8a6224",
  warningTint: "rgba(138, 98, 36, 0.08)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Sizes with their leading. Airier than the old scale — an editorial page earns
 * its calm from leading more than from margins.
 *
 * `kicker` is the 9–10px uppercase label that opens a section, and is used for
 * nothing else: letterspacing that wide is unreadable at any length.
 */
export const type = {
  kicker: { size: 9.5, line: 12 },
  micro: { size: 11, line: 15 },
  caption: { size: 12.5, line: 18 },
  body: { size: 14, line: 22 },
  lead: { size: 16, line: 26 },
  title: { size: 18, line: 24 },
  heading: { size: 24, line: 30 },
  display: { size: 30, line: 34 },
  displayLarge: { size: 34, line: 40 },
} as const;

/**
 * 4px everywhere. A pill or a 16px card reads as app chrome; a barely-there
 * corner reads as a printed rule that happens to turn.
 */
export const radius = {
  sm: 4,
  control: 4,
  card: 4,
  panel: 4,
  pill: 9999, // only the identity circle, which genuinely is one
} as const;

/**
 * Two families, and no bold in either.
 *
 * Cormorant Garamond is a display serif: lovely at 24px and thin to the point of
 * illegible at 12px, which is why Lora carries all running text and every small
 * label. Cormorant gets 500/600 only for row titles, where it still has size to
 * breathe.
 *
 * Italic is the emphasis mechanism, so there is deliberately no bold token to
 * reach for.
 */
export const fonts = {
  // Cormorant Garamond — headings and display only.
  display: "CormorantGaramond_400Regular",
  displayItalic: "CormorantGaramond_400Regular_Italic",
  heading: "CormorantGaramond_500Medium",
  headingStrong: "CormorantGaramond_600SemiBold",

  // Lora — body, labels, kickers, anything small.
  body: "Lora_400Regular",
  bodyItalic: "Lora_400Regular_Italic",
  medium: "Lora_500Medium",
  mediumItalic: "Lora_500Medium_Italic",

} as const;

// The migration aliases (regular/semibold/bold/mono/monoBold/headingExtra/
// displayMedium) are deliberately gone now that no screen reads them. They existed
// so a half-converted screen still rendered in the new faces, and leaving them
// would make `fonts.bold` compile forever — in a language whose first rule is that
// nothing is bold.

/**
 * Tabular figures, for anything in a column or compared: kickers, counts, prices,
 * spec tables, the 01/02/03 numerals on category rows.
 *
 * Proportional digits give "01" and "11" different widths, which is visible the
 * moment two are stacked.
 */
// Typed as TextStyle, and deliberately NOT `as const`: a readonly fontVariant
// array does not satisfy TextStyle, and spreading one into StyleSheet.create
// makes the whole sheet degrade to a ViewStyle|TextStyle|ImageStyle union — which
// then rejects every View style in the same sheet. The error surfaces on an
// unrelated line, which is the annoying part.
export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

/**
 * Letterspacing as rendered points.
 *
 * React Native's letterSpacing is points, not em, so it cannot scale with the
 * font size. The em intent is spelled out per entry so a label at another size
 * can be computed rather than guessed.
 */
export const tracking = {
  kicker: 1.9, // 0.2em at 9.5px
  wordmark: 2.9, // 0.22em at 13px
  label: 1.8, // 0.18em at 10px
} as const;

/**
 * No shadows. Depth is not part of this language — a plate is separated from the
 * page by its mat and a hairline, not by floating above it.
 *
 * The keys survive as empty objects so components mid-migration still compile
 * and spreading one changes nothing.
 */
export const shadow = {
  card: {},
  raised: {},
  glow: {},
} as const;

/** Archival grade for product plates: warm, slightly desaturated, print-like. */
export const PLATE_FILTER = "sepia(0.22) saturate(0.82) contrast(1.05)";

/** Minimum touch target. Rows and controls are padded up to it. */
export const HIT_TARGET = 44;
