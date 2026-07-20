// Mobile design tokens, ported from the web client's dark-navy theme
// (apps/client/src/app/globals.css). Deep-navy page, translucent "glass"
// surfaces, the signature cyan → periwinkle → violet accent gradient, and the
// editorial serif-heading / grotesk-UI type pairing.

export const colors = {
  // Surfaces
  background: "#060a14", // page — deep navy, not pure black
  backgroundAlt: "#0a1020", // subtle inset background
  surface: "#0f1526", // cards / panels (solid stand-in for the glass token)
  surfaceGlass: "rgba(255,255,255,0.05)",
  surfaceAlt: "#0a1020", // image wells behind product art
  overlay: "#10152a", // menus / floating chrome

  // Text
  text: "#eaf0fb", // ink
  muted: "#9198ac", // secondary
  faint: "#606a80", // faint / dim
  placeholder: "#586074",

  // Lines
  border: "rgba(255,255,255,0.09)", // hairline
  borderStrong: "rgba(255,255,255,0.16)", // input / search borders
  hover: "rgba(255,255,255,0.06)",

  // Accent
  primary: "#8b7bff",
  primaryHover: "#7e8dff",
  primaryTint: "rgba(139,123,255,0.16)",
  accentCyan: "#22d3ee",
  accentViolet: "#b77cff",
  onGradient: "#07101f", // dark ink that sits on top of the accent gradient
  success: "#34e29b",
  danger: "#ef4444",
  primaryText: "#ffffff",
} as const;

// Signature accent gradient (115deg cyan → periwinkle → violet).
export const gradient = {
  accent: ["#22d3ee", "#7e8dff", "#b77cff"] as const,
  // A subtle glass wash used behind logos / hero art.
  wash: ["rgba(34,211,238,0.16)", "rgba(139,123,255,0.16)"] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  control: 12,
  card: 16,
  panel: 18,
  pill: 9999,
} as const;

// Font family keys as registered by expo-google-fonts via useFonts (see the
// root layout). Newsreader = serif headings, Hanken Grotesk = UI/body,
// Space Grotesk = display + numeric.
export const fonts = {
  heading: "Newsreader_700Bold",
  headingExtra: "Newsreader_800ExtraBold",
  body: "HankenGrotesk_400Regular",
  medium: "HankenGrotesk_500Medium",
  semibold: "HankenGrotesk_600SemiBold",
  bold: "HankenGrotesk_700Bold",
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
} as const;

// Soft elevation shadows tuned for a dark UI.
export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
