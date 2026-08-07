import { View, Text, Dimensions, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { LoyaltyTier } from "@zika/types";
import { CARD_CFG, TIER_ICON, TIER_LABEL, computeTierProgress } from "../../constants/loyaltyTiers";
import { ProgressCard } from "./ProgressCard";
import { K } from "../../constants/theme";

const SCREEN_W = Dimensions.get("window").width;

interface Props {
  tier: LoyaltyTier;
  points: number;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number | null;
}

// The loyalty summary card shown on the Profile screen. Reuses the same
// tier color scheme as the Rewards tab's membership card for consistency.
export function MembershipCard({ tier, points, nextTier, pointsToNextTier }: Props) {
  const cfg = CARD_CFG[tier];
  const { pct, isMaxTier } = computeTierProgress(points, pointsToNextTier);

  return (
    <View style={[s.card, { backgroundColor: cfg.cardBg }]}>
      <View style={[s.blob1, { backgroundColor: cfg.blob1 }]} />
      <View style={[s.blob2, { backgroundColor: cfg.blob2 }]} />

      <View style={s.topRow}>
        <View>
          <Text style={[s.tierLabel, { color: cfg.textMuted }]}>{TIER_LABEL[tier].toUpperCase()} MEMBER</Text>
          <View style={s.pointsRow}>
            <Text style={[s.points, { color: cfg.textPrimary }]}>{points.toLocaleString()}</Text>
            <Text style={[s.pointsSuffix, { color: cfg.textMuted }]}> pts</Text>
          </View>
        </View>
        <View style={[s.iconCircle, { backgroundColor: cfg.iconCircle }]}>
          <Ionicons name={TIER_ICON[tier] as any} size={22} color={cfg.iconColor} />
        </View>
      </View>

      <View style={s.progressBlock}>
        <ProgressCard pct={pct} trackColor={cfg.separator} fillColor={cfg.iconColor} height={7} />
        <Text style={[s.progressText, { color: cfg.textMuted }]}>
          {isMaxTier
            ? "✦ Maximum tier reached"
            : `${(pointsToNextTier ?? 0).toLocaleString()} pts to ${nextTier ? TIER_LABEL[nextTier] : ""}`}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: K.radius.xl,
    marginHorizontal: K.spacing.screen,
    padding: 20,
    overflow: "hidden",
    ...K.shadow.md,
  },
  blob1: {
    position: "absolute",
    width: SCREEN_W * 0.5,
    height: SCREEN_W * 0.5,
    borderRadius: SCREEN_W * 0.25,
    top: -(SCREEN_W * 0.18),
    right: -(SCREEN_W * 0.1),
    opacity: 0.45,
  },
  blob2: {
    position: "absolute",
    width: SCREEN_W * 0.36,
    height: SCREEN_W * 0.36,
    borderRadius: SCREEN_W * 0.18,
    bottom: -(SCREEN_W * 0.12),
    left: -(SCREEN_W * 0.08),
    opacity: 0.38,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  tierLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 6 },
  pointsRow: { flexDirection: "row", alignItems: "baseline" },
  points: { fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  pointsSuffix: { fontSize: 14, fontWeight: "600" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  progressBlock: { gap: 8 },
  progressText: { fontSize: 12, fontWeight: "600" },
});
