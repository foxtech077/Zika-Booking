// ─── Kainook Design System ────────────────────────────────────────────────────
// Single source of truth for all colors, spacing, typography, shadows and radii.
// Every mobile screen and component MUST import from here — no hardcoded values.

export const K = {
  colors: {
    // ── Dark backgrounds ─────────────────────────────────────────────────────
    darkGreen: "#0D3D2B",           // Deep branded section bg
    darkGreenDeep: "#071C12",       // Deepest level (splash, hero headers)
    darkGreenMid: "#0F3225",        // Mid elevation cards on dark
    darkGreenSurface: "#163B28",    // Elevated surfaces
    darkGreenCard: "#1C4A34",       // Card-level dark elevation

    // ── Brand accent greens ──────────────────────────────────────────────────
    accent: "#39FF73",              // Primary CTA — vivid neon green
    accentLight: "#6FFF9E",         // Lighter accent — hover, highlights
    accentDark: "#22CC55",          // Darker accent — pressed states
    accentMuted: "#1EA847",         // Muted green (less vivid contexts)
    accentDim: "rgba(57,255,115,0.18)",
    accentSurface: "rgba(57,255,115,0.10)",

    // ── App surfaces (dark theme) ────────────────────────────────────────────
    bgLight: "#0B1A10",             // Page background
    bgCard: "#0E2118",              // Card / panel background
    bgSubtle: "#081510",            // Screen background (deepest)
    bgSection: "#0B1C11",           // Grouped sections, skeleton
    bgCardDark: "#163B28",          // Elevated card on dark bg

    // ── Glassmorphism (dark surfaces) ────────────────────────────────────────
    glassBg: "rgba(255,255,255,0.07)",
    glassBgStrong: "rgba(255,255,255,0.13)",
    glassBorder: "rgba(255,255,255,0.14)",
    glassBorderStrong: "rgba(255,255,255,0.24)",
    glassInput: "rgba(255,255,255,0.08)",
    glassInputBorder: "rgba(255,255,255,0.18)",

    // ── Primary text (on dark surfaces) ─────────────────────────────────────
    textDark: "#FFFFFF",            // Headings — white on dark
    textBody: "rgba(255,255,255,0.80)", // Body copy
    textMuted: "rgba(255,255,255,0.55)", // Secondary text
    textSubtle: "rgba(255,255,255,0.35)", // Tertiary / placeholder
    textMid: "rgba(255,255,255,0.65)", // Mid-tone

    // ── Light text helpers (for overlays etc.) ───────────────────────────────
    textLight: "#FFFFFF",
    textLightMuted: "rgba(255,255,255,0.65)",
    textLightDim: "rgba(255,255,255,0.40)",
    textLightSubtle: "rgba(255,255,255,0.25)",

    // ── Borders ──────────────────────────────────────────────────────────────
    border: "rgba(255,255,255,0.12)",    // Dividers on dark
    borderMid: "rgba(255,255,255,0.20)", // Input borders on dark
    borderDark: "rgba(255,255,255,0.12)",

    // ── Overlays ─────────────────────────────────────────────────────────────
    overlay: "rgba(0,0,0,0.60)",
    overlayLight: "rgba(0,0,0,0.30)",
    overlayStrong: "rgba(0,0,0,0.80)",

    // ── Status primitives ────────────────────────────────────────────────────
    success: "#39FF73",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    // ── Status badge tokens (dark-friendly) ──────────────────────────────────
    successBg: "#0E3520",
    successText: "#39FF73",
    warningBg: "#2A1A00",
    warningText: "#FCD34D",
    errorBg: "#2A0A0A",
    errorText: "#FC5C5C",
    infoBg: "#0A1A2A",
    infoText: "#60A5FA",

    // ── Booking status badge objects ─────────────────────────────────────────
    confirmed: { bg: "#0E3520", text: "#39FF73" },
    pending: { bg: "#2A1A00", text: "#FCD34D" },
    completed: { bg: "#1A1F1A", text: "rgba(255,255,255,0.55)" },
    cancelled: { bg: "#2A0A0A", text: "#FC5C5C" },
    active: { bg: "#0A1A2A", text: "#60A5FA" },
    refunded: { bg: "#0E3520", text: "#39FF73" },
    checkedIn: { bg: "#1A1230", text: "#A78BFA" },

    // ── Loyalty tier colours ─────────────────────────────────────────────────
    tierBronze: "#CD7F32",
    tierBronzeBg: "#2A1A00",
    tierSilver: "#9CA3AF",
    tierSilverBg: "#1A1A1A",
    tierGold: "#F59E0B",
    tierGoldBg: "#2A2000",
    tierDiamond: "#60A5FA",
    tierDiamondBg: "#0A1A2A",

    // ── Tab bar ──────────────────────────────────────────────────────────────
    tabBarBg: "#0E2118",
    tabBarBorder: "rgba(255,255,255,0.08)",
    tabActive: "#39FF73",
    tabInactive: "rgba(255,255,255,0.40)",
  },

  // ── Border radii ───────────────────────────────────────────────────────────
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    full: 999,
  },

  // ── Shadow presets ─────────────────────────────────────────────────────────
  shadow: {
    xs: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.20,
      shadowRadius: 3,
      elevation: 2,
    },
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.30,
      shadowRadius: 8,
      elevation: 4,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 6,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.40,
      shadowRadius: 20,
      elevation: 10,
    },
    xl: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.50,
      shadowRadius: 28,
      elevation: 14,
    },
  },

  // ── Spacing scale ──────────────────────────────────────────────────────────
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    xxxxl: 40,
  },

  // ── Type scale ─────────────────────────────────────────────────────────────
  font: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 36,
    hero: 44,
  },
} as const;

// ── Tier colour helper ─────────────────────────────────────────────────────────

type Tier = "bronze" | "silver" | "gold" | "diamond";

export function tierColor(tier: Tier): string {
  const map: Record<Tier, string> = {
    bronze: K.colors.tierBronze,
    silver: K.colors.tierSilver,
    gold: K.colors.tierGold,
    diamond: K.colors.tierDiamond,
  };
  return map[tier] ?? K.colors.tierBronze;
}

export function tierBgColor(tier: Tier): string {
  const map: Record<Tier, string> = {
    bronze: K.colors.tierBronzeBg,
    silver: K.colors.tierSilverBg,
    gold: K.colors.tierGoldBg,
    diamond: K.colors.tierDiamondBg,
  };
  return map[tier] ?? K.colors.tierBronzeBg;
}
