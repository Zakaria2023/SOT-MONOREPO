// Mobile design tokens.
//
// A light, high-contrast system built for a technical B2B catalog: paper-white
// surfaces, one restrained accent, and a single sans family carrying the whole
// hierarchy through weight and size. The previous dark-navy theme with a
// three-stop cyan→violet gradient read consumer; specification tables and long
// product names read better on paper, and a lone accent lets price, state and
// actions be the only coloured things on a screen.

export const colors = {
  // Surfaces — a ladder, so depth says which things sit on top of which.
  background: "#f6f7f9", // page — barely-there grey so white cards lift off it
  surface: "#ffffff", // cards, sheets, rows
  surfaceAlt: "#f1f3f6", // image wells, inset panels
  sunken: "#eceff3", // pressed states, tracks
  overlay: "#ffffff", // floating chrome

  // Text — three steps is enough, and each is far enough apart to be a choice.
  text: "#0d1117", // near-black, not pure
  muted: "#5b6472",
  faint: "#8b94a3",
  placeholder: "#a5adba",
  onAccent: "#ffffff",

  // Lines
  border: "#e4e7ec",
  borderStrong: "#d3d8e0",
  hover: "#f1f3f6",

  // One accent. Everything coloured on a screen is either this, or a state.
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  primaryTint: "#eef4ff",
  primaryBorder: "#d5e2ff",

  // States
  success: "#0f9d58",
  successTint: "#e9f7ef",
  danger: "#d92d20",
  dangerTint: "#fdecea",
  warning: "#b54708",
  warningTint: "#fef4e6",
} as const;

// Kept as a named token so the few places that want a wash behind product art
// have one source. Deliberately almost invisible — art should not sit on
// colour it has to fight.
export const gradient = {
  wash: ["#ffffff", "#f1f3f6"] as const,
  fade: ["rgba(255,255,255,0)", "rgba(255,255,255,0.95)", "#ffffff"] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
  vertical: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
};

// Steps far enough apart to read as deliberate. The old scale clustered
// 12/14/16 and everything ended up looking the same distance apart.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// Size and line-height travel together, so vertical rhythm survives a change
// of size. Hierarchy comes from these plus weight — not from colour.
export const type = {
  micro: { size: 11, line: 14 },
  caption: { size: 13, line: 18 },
  body: { size: 15, line: 22 },
  lead: { size: 17, line: 26 },
  title: { size: 20, line: 26 },
  heading: { size: 26, line: 32 },
  display: { size: 32, line: 38 },
} as const;

export const radius = {
  sm: 8,
  control: 12,
  card: 16,
  panel: 20,
  pill: 9999,
} as const;

// One family, five weights. A serif heading beside a spec table looks like two
// designs; the weight scale carries the hierarchy on its own.
export const fonts = {
  regular: "HankenGrotesk_400Regular",
  medium: "HankenGrotesk_500Medium",
  semibold: "HankenGrotesk_600SemiBold",
  bold: "HankenGrotesk_700Bold",
  // Numerics — prices, quantities, spec values — in a grotesk with clearer
  // figures, so a column of numbers lines up and reads at a glance.
  mono: "SpaceGrotesk_500Medium",
  monoBold: "SpaceGrotesk_700Bold",

  // Retained so screens not yet migrated keep compiling; they resolve to the
  // same family rather than reintroducing the serif.
  body: "HankenGrotesk_400Regular",
  heading: "HankenGrotesk_700Bold",
  headingExtra: "HankenGrotesk_700Bold",
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
} as const;

// On a light UI a shadow is a soft, close halo — not the deep drop a dark UI
// needs. Anything heavier looks like a 2015 material card.
export const shadow = {
  card: {
    shadowColor: "#0d1117",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  raised: {
    shadowColor: "#0d1117",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  glow: {
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;
