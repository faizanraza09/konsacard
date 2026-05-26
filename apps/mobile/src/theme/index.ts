// Brand tokens lifted from card-match-pk/assets/styles.css.
// Keep names parallel so future shared design work is one mental model.
//
// Palette anchored to the web app's Tailwind slate scale + brand terracotta,
// so the two surfaces feel like the same product. If you change a value here,
// check apps/web/assets/styles.css :root first and stay in sync.

export const colors = {
  brand: "#BD5B3D",       // primary terracotta — matches web --brand
  brandDark: "#9E4530",   // matches web --brand-dark
  brandLight: "#FDF3F0",  // matches web --brand-light
  brandMid: "#F5C4B5",    // matches web --brand-mid (featured card borders)

  bg: "#FFFFFF",          // page background — pure white, modern flat look
  bgElev: "#FFFFFF",      // card surface (cards lean on borders + shadow, not fill, to separate from page)
  bgSubtle: "#F1F5F9",    // slate-100, used inside cards (logo fallback, stat containers, segmented bg)
  bgTint: "#FDF3F0",      // brand-light peach for top-pick rows

  text: "#0F172A",        // slate-900, matches web --ink
  textMuted: "#334155",   // slate-700, matches web --ink2
  textDim: "#64748B",     // slate-500, matches web --muted
  textOnBrand: "#FFFFFF",

  border: "#E2E8F0",      // slate-200, matches web --line
  borderStrong: "#CBD5E1",// slate-300

  green: "#059669",       // emerald-600, matches web --green
  amber: "#D97706",       // amber-600, matches web --amber
  red: "#DC2626",         // red-600, matches web --red

  // Eligibility tone colors — vivid text on a softly tinted cool background,
  // mirroring the web .tone-* classes.
  toneEligible: "#059669",
  toneEligibleBg: "#ECFDF5",      // emerald-50
  toneEstEligible: "#0E7C50",
  toneEstEligibleBg: "#F0FDF4",   // green-50
  toneIneligible: "#DC2626",
  toneIneligibleBg: "#FEF2F2",    // red-50
  toneNeedsInput: "#D97706",
  toneNeedsInputBg: "#FFFBEB",    // amber-50
  toneUnclear: "#64748B",
  toneUnclearBg: "#F1F5F9",       // slate-100
};

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  // System font family — RN will substitute San Francisco on iOS, Roboto on
  // Android. Avoids a custom font dep for v1; can swap to Outfit later via
  // expo-font without changing call sites.
  family: undefined as string | undefined,
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    black: "800" as const,
  },
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 36,
  },
};

export const shadow = {
  // Cards float on a white page; the shadow + 1px slate-300 border together
  // make each card visually self-contained without feeling boxed in.
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};

export function eligibilityTone(tone: string): { color: string; bg: string } {
  switch (tone) {
    case "eligible":
      return { color: colors.toneEligible, bg: colors.toneEligibleBg };
    case "est-eligible":
      return { color: colors.toneEstEligible, bg: colors.toneEstEligibleBg };
    case "ineligible":
    case "est-ineligible":
      return { color: colors.toneIneligible, bg: colors.toneIneligibleBg };
    case "needs-input":
    case "est-needs-input":
      return { color: colors.toneNeedsInput, bg: colors.toneNeedsInputBg };
    case "unclear":
    default:
      return { color: colors.toneUnclear, bg: colors.toneUnclearBg };
  }
}

export function scoreColor(score: number) {
  return score >= 70 ? colors.green : score >= 50 ? colors.amber : colors.red;
}
