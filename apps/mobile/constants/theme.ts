export const K = {
  colors: {
    // Core brand
    darkGreen:      "#024622",
    darkGreenDeep:  "#011a0d",
    darkGreenMid:   "#035730",
    accent:         "#1d9e62",
    accentLight:    "#3dbd82",
    accentDim:      "rgba(29,158,98,0.14)",

    // App backgrounds — warm cream, not cold white
    bgApp:    "#F9F8F6",
    bgLight:  "#F9F8F6",   // backward-compat alias
    bgCard:   "#FFFFFF",
    bgCardDark: "#1a1917",
    bgSubtle: "#F2F0EC",
    bgTint:   "#EEFBF4",

    // Glassmorphism on dark surfaces
    glassBg:          "rgba(255,255,255,0.08)",
    glassBorder:      "rgba(255,255,255,0.16)",
    glassInput:       "rgba(255,255,255,0.12)",
    glassInputBorder: "rgba(255,255,255,0.22)",

    // Text — warm-tinted neutrals
    textDark:      "#0c0b09",
    textMid:       "#2e2c29",
    textMuted:     "#6b6760",
    textLight:     "#FFFFFF",
    textLightMuted: "rgba(255,255,255,0.75)",
    textLightDim:   "rgba(255,255,255,0.45)",
    textBrand:     "#024622",

    // Semantic status colors
    success: "#16a34a",
    warning: "#d97706",
    error:   "#dc2626",
    info:    "#2563eb",

    // Status badge pairs — used by BookingCard, StatusBadge, etc.
    confirmed:  { bg: "#f0fdf4", text: "#16a34a", dot: "#16a34a",  stripe: "#16a34a"  },
    pending:    { bg: "#fffbeb", text: "#d97706", dot: "#d97706",  stripe: "#d97706"  },
    active:     { bg: "#eff6ff", text: "#2563eb", dot: "#2563eb",  stripe: "#2563eb"  },
    completed:  { bg: "#F2F0EC", text: "#6b6760", dot: "#b3afa8",  stripe: "#b3afa8"  },
    cancelled:  { bg: "#fef2f2", text: "#dc2626", dot: "#dc2626",  stripe: "#dc2626"  },

    // Tab bar
    tabBarBg:     "#FFFFFF",
    tabBarBorder: "#E5E2DC",
    tabActive:    "#024622",
    tabInactive:  "#8f8b84",

    // Borders — warm, not cold gray
    border:       "#E5E2DC",
    borderStrong: "#CCC9C3",
    borderDark:   "rgba(255,255,255,0.12)",

    // Gold accent — loyalty tier only
    gold:     "#f5b31a",
    goldDark: "#b07d0e",
    goldTint: "#fef9e7",
  },

  radius: {
    sm:   8,
    md:   12,
    lg:   16,
    xl:   20,
    xxl:  24,
    xxxl: 32,
    full: 999,
    // Semantic aliases
    card:   20,
    button: 14,
    input:  12,
    modal:  28,
  },

  shadow: {
    xs: {
      shadowColor:   "#0c0b09",
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius:  3,
      elevation:     1,
    },
    sm: {
      shadowColor:   "#0c0b09",
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius:  8,
      elevation:     2,
    },
    md: {
      shadowColor:   "#0c0b09",
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius:  14,
      elevation:     4,
    },
    lg: {
      shadowColor:   "#0c0b09",
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.10,
      shadowRadius:  24,
      elevation:     8,
    },
    brand: {
      shadowColor:   "#024622",
      shadowOffset:  { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius:  16,
      elevation:     6,
    },
  },

  spacing: {
    xs:     4,
    sm:     8,
    md:     12,
    lg:     16,
    xl:     20,
    xxl:    24,
    xxxl:   32,
    screen: 16,
    section: 28,
    card:   16,
  },

  font: {
    xs:      11,
    sm:      13,
    base:    15,
    lg:      17,
    xl:      20,
    xxl:     24,
    xxxl:    30,
    display: 36,
    hero:    48,
  },
} as const;
