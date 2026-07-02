import type { LoyaltyTier } from "@zika/types";

// Presentation-only tier config shared by the Profile screens (ring, badge,
// membership card). Colors match the existing Rewards tab (app/(tabs)/loyalty.tsx)
// for visual consistency across the app.

export const TIER_ORDER: LoyaltyTier[] = ["bronze", "silver", "gold", "diamond"];

export const TIER_LABEL: Record<LoyaltyTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

export const TIER_EMOJI: Record<LoyaltyTier, string> = {
  bronze: "\u{1F949}", // 🥉
  silver: "\u{1F948}", // 🥈
  gold: "\u{1F947}", // 🥇
  diamond: "\u{1F48E}", // 💎
};

export const TIER_ICON: Record<LoyaltyTier, string> = {
  bronze: "medal-outline",
  silver: "ribbon-outline",
  gold: "star",
  diamond: "diamond-outline",
};

export const TIER_COLORS: Record<LoyaltyTier, string> = {
  bronze: "#CD7F32",
  silver: "#90A4AE",
  gold: "#f5b31a",
  diamond: "#5B9BD5",
};

// Premium membership card color scheme (moved here from app/(tabs)/loyalty.tsx
// so the Profile screens' MembershipCard can reuse it without duplication).
export interface CardCfg {
  cardBg:       string;
  blob1:        string;   // top-right highlight
  blob2:        string;   // bottom-left shadow
  shimmer:      string;   // diagonal sheen
  textPrimary:  string;
  textMuted:    string;
  separator:    string;
  btnBg:        string;
  btnText:      string;
  iconCircle:   string;
  iconColor:    string;
  shadowColor:  string;
  // Diamond only extras
  shimmer2?:    string;
  shimmer3?:    string;
  topEdge?:     string;
}

export const CARD_CFG: Record<LoyaltyTier, CardCfg> = {
  bronze: {
    cardBg:      "#8B4A18",
    blob1:       "#C87030",
    blob2:       "#431A06",
    shimmer:     "rgba(240,180,100,0.14)",
    textPrimary: "#FAECD8",
    textMuted:   "rgba(250,236,216,0.62)",
    separator:   "rgba(250,236,216,0.22)",
    btnBg:       "#1E0804",
    btnText:     "#FAECD8",
    iconCircle:  "rgba(250,236,216,0.13)",
    iconColor:   "#FAECD8",
    shadowColor: "#3C1406",
    topEdge:     "rgba(255,200,120,0.22)",
  },
  silver: {
    cardBg:      "#546878",
    blob1:       "#849AB0",
    blob2:       "#2A3A48",
    shimmer:     "rgba(210,230,255,0.22)",
    textPrimary: "#E4F0FF",
    textMuted:   "rgba(228,240,255,0.60)",
    separator:   "rgba(228,240,255,0.18)",
    btnBg:       "#0E1C28",
    btnText:     "#E4F0FF",
    iconCircle:  "rgba(228,240,255,0.13)",
    iconColor:   "#E4F0FF",
    shadowColor: "#182838",
    shimmer2:    "rgba(255,255,255,0.10)",
    topEdge:     "rgba(210,240,255,0.30)",
  },
  gold: {
    cardBg:      "#C68010",
    blob1:       "#ECA828",
    blob2:       "#724A08",
    shimmer:     "rgba(255,238,140,0.18)",
    textPrimary: "#1C0A00",
    textMuted:   "rgba(28,10,0,0.52)",
    separator:   "rgba(28,10,0,0.16)",
    btnBg:       "#0E0500",
    btnText:     "#FFFFFF",
    iconCircle:  "rgba(28,10,0,0.14)",
    iconColor:   "#1C0A00",
    shadowColor: "#7A4C08",
    shimmer2:    "rgba(255,250,180,0.10)",
    topEdge:     "rgba(255,235,100,0.28)",
  },
  diamond: {
    cardBg:      "#EBF3FF",
    blob1:       "#FFFFFF",
    blob2:       "#BACDE8",
    shimmer:     "rgba(90,160,255,0.10)",
    textPrimary: "#0A1628",
    textMuted:   "rgba(10,22,40,0.52)",
    separator:   "rgba(10,22,40,0.11)",
    btnBg:       "#0A1628",
    btnText:     "#FFFFFF",
    iconCircle:  "rgba(70,130,255,0.12)",
    iconColor:   "#1C5EC0",
    shadowColor: "#0A3080",
    shimmer2:    "rgba(160,100,255,0.07)",
    shimmer3:    "rgba(60,200,255,0.06)",
    topEdge:     "rgba(255,255,255,0.95)",
  },
};

export const TIER_BENEFITS: Record<LoyaltyTier, string[]> = {
  bronze: ["1 point per $1 spent", "Access to member-only deals"],
  silver: ["1.15× earning multiplier", "Priority customer support", "Early access to promotions"],
  gold: ["1.25× earning multiplier", "Dedicated support line", "Exclusive gold member discounts"],
  diamond: ["1.4× earning multiplier", "Concierge support", "Free upgrades when available", "VIP partner perks"],
};

// Ring gradient stops + animation feel per tier, used by TierProfileRing.
export interface TierRingConfig {
  gradientColors: string[]; // stops around the ring, first === last for a seamless loop
  glowColor: string;
  rotationMs: number | null; // null = no continuous rotation (bronze: soft static glow only)
  shimmer: boolean; // adds a sweeping highlight overlay (silver/gold)
}

export const TIER_RING_CONFIG: Record<LoyaltyTier, TierRingConfig> = {
  bronze: {
    gradientColors: ["#8B5A2B", "#CD7F32", "#F0B074", "#CD7F32", "#8B5A2B"],
    glowColor: "#CD7F32",
    rotationMs: null,
    shimmer: false,
  },
  silver: {
    gradientColors: ["#8E9BA3", "#C9D3D8", "#FFFFFF", "#C9D3D8", "#8E9BA3"],
    glowColor: "#B8C4CA",
    rotationMs: 6000,
    shimmer: true,
  },
  gold: {
    gradientColors: ["#8A5A0E", "#f5b31a", "#FFE9A8", "#f5b31a", "#8A5A0E"],
    glowColor: "#f5b31a",
    rotationMs: 5000,
    shimmer: true,
  },
  diamond: {
    gradientColors: ["#3B6FB0", "#5B9BD5", "#FFFFFF", "#9FD8FF", "#5B9BD5", "#3B6FB0"],
    glowColor: "#5B9BD5",
    rotationMs: 3800,
    shimmer: true,
  },
};

export function normalizeTier(tier: string | null | undefined): LoyaltyTier {
  const t = (tier ?? "bronze").toLowerCase();
  if (t === "silver" || t === "gold" || t === "diamond") return t;
  return "bronze";
}

// Progress toward the next tier, derived entirely from backend-reported values
// (GET /auth/me's loyaltyPoints + pointsToNextTier) — no local threshold table,
// so it can never drift from the server's own tier math.
export function computeTierProgress(
  points: number,
  pointsToNextTier: number | null,
): { pct: number; isMaxTier: boolean } {
  if (pointsToNextTier == null || pointsToNextTier <= 0) return { pct: 1, isMaxTier: true };
  const total = points + pointsToNextTier;
  return { pct: total > 0 ? Math.max(0, Math.min(points / total, 1)) : 0, isMaxTier: false };
}
