export const K = {
  colors: {
    // Core brand
    darkGreen: "#024622",
    darkGreenDeep: "#012015",
    darkGreenMid: "#015428",
    accent: "#1D8D2B",
    accentLight: "#58B430",
    accentDim: "#1D8D2B26",

    // Content backgrounds
    bgLight: "#F8FAF9",
    bgCard: "#FFFFFF",
    bgCardDark: "#015428",

    // Glassmorphism on dark
    glassBg: "rgba(255,255,255,0.08)",
    glassBorder: "rgba(255,255,255,0.14)",
    glassInput: "rgba(255,255,255,0.12)",
    glassInputBorder: "rgba(255,255,255,0.20)",

    // Text
    textDark: "#111827",
    textMid: "#374151",
    textMuted: "#6B7280",
    textLight: "#FFFFFF",
    textLightMuted: "rgba(255,255,255,0.75)",
    textLightDim: "rgba(255,255,255,0.45)",

    // Status
    success: "#1D8D2B",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",

    // Status badges
    confirmed: { bg: "#DCFCE7", text: "#16A34A" },
    pending: { bg: "#FEF3C7", text: "#92400E" },
    completed: { bg: "#F3F4F6", text: "#6B7280" },
    cancelled: { bg: "#FEE2E2", text: "#DC2626" },
    active: { bg: "#D1FAE5", text: "#065F46" },

    // Tab bar
    tabBarBg: "#FFFFFF",
    tabBarBorder: "#E5E7EB",
    tabActive: "#024622",
    tabInactive: "#9CA3AF",

    // Separator
    border: "#E5E7EB",
    borderDark: "rgba(255,255,255,0.12)",
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 999,
  },

  shadow: {
    sm: {
      shadowColor: "#024622",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: "#024622",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: "#024622",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 8,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  font: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 36,
  },
} as const;
