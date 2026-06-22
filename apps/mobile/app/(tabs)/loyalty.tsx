import { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLoyaltyProfile, usePointsHistoryInfinite } from "../../hooks/loyalty";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import type { LoyaltyTier, PointsTransaction } from "../../lib/types/loyalty";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<LoyaltyTier, string> = {
  bronze:  "#cd7f32",
  silver:  "#9ca3af",
  gold:    K.colors.gold,
  diamond: "#38bdf8",
};

const TIER_ICON: Record<LoyaltyTier, string> = {
  bronze:  "shield-outline",
  silver:  "shield-half-outline",
  gold:    "shield",
  diamond: "diamond-outline",
};

const TIER_BENEFITS: Record<LoyaltyTier, string[]> = {
  bronze:  ["1 point per $1 spent", "Access to member-only deals"],
  silver:  ["1.15× earning multiplier", "Priority customer support", "Early access to promotions"],
  gold:    ["1.25× earning multiplier", "Dedicated support line", "Exclusive gold member discounts"],
  diamond: ["1.4× earning multiplier", "Concierge support", "Free upgrades when available", "VIP partner perks"],
};

const TIER_ORDER: LoyaltyTier[]              = ["bronze", "silver", "gold", "diamond"];
const TIER_THRESHOLDS: Record<LoyaltyTier, number> = { bronze: 0, silver: 1000, gold: 5000, diamond: 15000 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierProgress(points: number, tier: LoyaltyTier): { pct: number; needed: number | null; nextLabel: string | null } {
  const idx     = TIER_ORDER.indexOf(tier);
  const next    = TIER_ORDER[idx + 1] as LoyaltyTier | undefined;
  if (!next) return { pct: 1, needed: null, nextLabel: null };
  const floor   = TIER_THRESHOLDS[tier];
  const ceil    = TIER_THRESHOLDS[next];
  const pct     = Math.max(0, Math.min((points - floor) / (ceil - floor), 1));
  return { pct, needed: Math.max(0, ceil - points), nextLabel: next.charAt(0).toUpperCase() + next.slice(1) };
}

function txTypeColor(type: string): string {
  switch (type) {
    case "earned":   return K.colors.success;
    case "redeemed": return "#7c3aed";
    case "reversed": return K.colors.error;
    case "refunded": return K.colors.info;
    case "expired":  return K.colors.textMuted;
    default:         return K.colors.textMid;
  }
}

function txSign(type: string): string {
  return type === "earned" || type === "refunded" ? "+" : "–";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Skeleton Pulse ────────────────────────────────────────────────────────────

function SkeletonPulse({ w, h = 14, mb = 0 }: { w: number | string; h?: number; mb?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={{ width: w as any, height: h, backgroundColor: K.colors.bgSubtle, borderRadius: 6, marginBottom: mb, opacity: anim }}
    />
  );
}

// ── Wallet Card ───────────────────────────────────────────────────────────────

function WalletCard({ tier, points }: { tier: LoyaltyTier; points: number }) {
  const tierColor = TIER_COLORS[tier];
  const { pct, needed, nextLabel } = tierProgress(points, tier);
  const isTopTier = tier === "diamond";
  const bgStart   = tier === "gold" || tier === "diamond" ? "#2a1f06" : K.colors.darkGreen;
  const bgEnd     = tier === "gold" ? "#6b4a0e" : tier === "diamond" ? "#0c2a3a" : K.colors.darkGreenMid;

  return (
    <View style={[wc.card, { backgroundColor: bgStart }]}>
      {/* Top glow strip using tier color */}
      <View style={[wc.glowStrip, { backgroundColor: tierColor }]} />

      {/* Header row */}
      <View style={wc.headerRow}>
        <View style={wc.logoWrap}>
          <Text style={wc.logoText}>AfriPoints</Text>
        </View>
        <View style={[wc.tierBadge, { backgroundColor: tierColor + "30", borderColor: tierColor + "60" }]}>
          <Ionicons name={TIER_ICON[tier] as any} size={14} color={tierColor} />
          <Text style={[wc.tierLabel, { color: tierColor }]}>{tier.toUpperCase()}</Text>
        </View>
      </View>

      {/* Balance */}
      <Text style={wc.balanceLabel}>YOUR BALANCE</Text>
      <View style={wc.balanceRow}>
        <Text style={wc.balance}>{points.toLocaleString()}</Text>
        <Text style={wc.balancePts}> pts</Text>
      </View>
      <Text style={wc.balanceValue}>≈ {points > 0 ? `KES ${Math.round(points * 0.1).toLocaleString()}` : "—"} value</Text>

      {/* Progress bar */}
      {!isTopTier && (
        <View style={wc.progressSection}>
          <View style={wc.progressTrack}>
            <View style={[wc.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: tierColor }]} />
          </View>
          <Text style={wc.progressLabel}>
            {needed != null && nextLabel ? `${needed.toLocaleString()} pts to ${nextLabel}` : "Max tier reached"}
          </Text>
        </View>
      )}
      {isTopTier && (
        <View style={wc.progressSection}>
          <Text style={[wc.progressLabel, { color: tierColor }]}>Maximum tier — you're at the top ✦</Text>
        </View>
      )}
    </View>
  );
}

const wc = StyleSheet.create({
  card: {
    borderRadius: K.radius.xxl,
    overflow: "hidden",
    padding: 24,
    marginHorizontal: K.spacing.screen,
    ...K.shadow.brand,
  },
  glowStrip: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  logoWrap:  {},
  logoText:  { fontSize: K.font.sm, fontWeight: "800", color: "rgba(255,255,255,0.85)", letterSpacing: 0.5 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tierLabel:     { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  balanceLabel:  { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.50)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  balanceRow:    { flexDirection: "row", alignItems: "baseline" },
  balance:       { fontSize: K.font.hero, fontWeight: "800", color: "#fff", letterSpacing: -2 },
  balancePts:    { fontSize: K.font.xl, fontWeight: "600", color: "rgba(255,255,255,0.60)", marginLeft: 2 },
  balanceValue:  { fontSize: K.font.sm, color: "rgba(255,255,255,0.55)", marginTop: 4, marginBottom: 20 },
  progressSection: { marginTop: 4 },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: K.radius.full,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill:  { height: "100%", borderRadius: K.radius.full, minWidth: 6 },
  progressLabel: { fontSize: 12, color: "rgba(255,255,255,0.60)", fontWeight: "500" },
});

// ── Tier Roadmap ──────────────────────────────────────────────────────────────

function TierRoadmap({ currentTier }: { currentTier: LoyaltyTier }) {
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  return (
    <View style={s.roadmap}>
      <Text style={s.sectionTitle}>Tier Roadmap</Text>
      <View style={s.roadmapRow}>
        {TIER_ORDER.map((t, i) => {
          const done    = i <= currentIdx;
          const current = i === currentIdx;
          const color   = TIER_COLORS[t];
          return (
            <View key={t} style={s.roadmapStep}>
              <View style={[
                s.roadmapDot,
                done    && { backgroundColor: color, borderColor: color },
                current && { borderWidth: 3 },
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <View style={[s.roadmapDotInner, { backgroundColor: K.colors.border }]} />}
              </View>
              <Text style={[s.roadmapLabel, done && { color, fontWeight: "700" }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              <Text style={s.roadmapPts}>{TIER_THRESHOLDS[t].toLocaleString()}</Text>
              {i < TIER_ORDER.length - 1 && (
                <View style={[s.roadmapLine, i < currentIdx && { backgroundColor: TIER_COLORS[TIER_ORDER[i + 1]] }]} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Transaction Row ───────────────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: PointsTransaction }) {
  const color = txTypeColor(tx.type);
  const sign  = txSign(tx.type);
  const iconMap: Record<string, string> = {
    earned: "arrow-up-circle", redeemed: "arrow-down-circle",
    refunded: "refresh-circle", reversed: "close-circle",
  };
  return (
    <View style={s.txRow}>
      <View style={[s.txIconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={(iconMap[tx.type] ?? "ellipse-outline") as any} size={22} color={color} />
      </View>
      <View style={s.txMeta}>
        <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
        <Text style={s.txRef}>
          {tx.bookingReference ? `${tx.bookingReference} · ` : ""}{fmtDate(tx.createdAt)}
        </Text>
      </View>
      <View style={s.txRight}>
        <Text style={[s.txPoints, { color }]}>{sign}{tx.points.toLocaleString()}</Text>
        <Text style={s.txTypeLabel}>{tx.type}</Text>
      </View>
    </View>
  );
}

// ── Benefits Card ─────────────────────────────────────────────────────────────

function BenefitsCard({ tier }: { tier: LoyaltyTier }) {
  const color = TIER_COLORS[tier];
  return (
    <View style={s.benefitsCard}>
      <View style={s.benefitsHeader}>
        <View style={[s.benefitsIconWrap, { backgroundColor: color + "20" }]}>
          <Ionicons name={TIER_ICON[tier] as any} size={20} color={color} />
        </View>
        <Text style={s.sectionTitle}>Your Benefits</Text>
      </View>
      {TIER_BENEFITS[tier].map((b) => (
        <View key={b} style={s.benefitRow}>
          <Ionicons name="checkmark-circle" size={16} color={color} />
          <Text style={s.benefitText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LoyaltyScreen() {
  const router     = useRouter();
  const storeUser  = useAuthStore((s) => s.user);

  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile, isFetching: profileFetching } = useLoyaltyProfile();
  const { data: historyPages, isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = usePointsHistoryInfinite();

  const tier      = (profile?.currentTier ?? storeUser?.currentTier ?? "bronze") as LoyaltyTier;
  const points    = profile?.loyaltyPoints ?? storeUser?.loyaltyPoints ?? 0;
  const recentTxs = historyPages?.pages[0]?.transactions.slice(0, 5) ?? [];
  const summary   = historyPages?.pages[0];

  const onRefresh = () => { void refetchProfile(); void refetchHistory(); };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={profileFetching} onRefresh={onRefresh} tintColor={K.colors.accent} />}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Rewards</Text>
          <Text style={s.headerSub}>Your AfriPoints loyalty programme</Text>
        </View>

        {/* Wallet Card */}
        {profileLoading ? (
          <View style={s.skeletonCard}>
            <SkeletonPulse w="45%" h={12} mb={12} />
            <SkeletonPulse w="60%" h={44} mb={8} />
            <SkeletonPulse w="35%" h={12} mb={20} />
            <SkeletonPulse w="100%" h={6} mb={8} />
            <SkeletonPulse w="55%" h={11} />
          </View>
        ) : profileError ? (
          <View style={s.errorCard}>
            <Ionicons name="cloud-offline-outline" size={40} color={K.colors.textMuted} />
            <Text style={s.errorText}>Could not load loyalty data.</Text>
            <TouchableOpacity onPress={() => void refetchProfile()} style={s.retryBtn}>
              <Text style={s.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WalletCard tier={tier} points={points} />
        )}

        {/* Summary stats */}
        {summary && (
          <View style={s.summaryRow}>
            <View style={s.summaryCell}>
              <Text style={[s.summaryStat, { color: K.colors.success }]}>{summary.totalEarned.toLocaleString()}</Text>
              <Text style={s.summaryLabel}>Earned</Text>
            </View>
            <View style={s.summarySep} />
            <View style={s.summaryCell}>
              <Text style={[s.summaryStat, { color: "#7c3aed" }]}>{summary.totalRedeemed.toLocaleString()}</Text>
              <Text style={s.summaryLabel}>Redeemed</Text>
            </View>
            <View style={s.summarySep} />
            <View style={s.summaryCell}>
              <Text style={[s.summaryStat, { color: K.colors.error }]}>{summary.totalReversed.toLocaleString()}</Text>
              <Text style={s.summaryLabel}>Reversed</Text>
            </View>
          </View>
        )}

        {/* Benefits */}
        {!profileLoading && <BenefitsCard tier={tier} />}

        {/* Tier roadmap */}
        {!profileLoading && <TierRoadmap currentTier={tier} />}

        {/* Recent transactions */}
        <View style={s.recentSection}>
          <View style={s.recentHeader}>
            <Text style={s.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push("/loyalty/points-history")}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {historyLoading ? (
            [1, 2, 3].map((i) => (
              <View key={i} style={s.txSkRow}>
                <SkeletonPulse w={40} h={40} mb={0} />
                <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                  <SkeletonPulse w="65%" h={13} />
                  <SkeletonPulse w="40%" h={11} />
                </View>
                <SkeletonPulse w={60} h={18} />
              </View>
            ))
          ) : historyError ? (
            <View style={s.errorInline}>
              <Text style={s.errorInlineText}>Could not load transactions.</Text>
              <TouchableOpacity onPress={() => void refetchHistory()}>
                <Text style={s.retryLink}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : recentTxs.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="star-outline" size={48} color={K.colors.border} />
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptyBody}>Complete a booking to start earning AfriPoints.</Text>
            </View>
          ) : (
            recentTxs.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          )}

          {recentTxs.length > 0 && (
            <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push("/loyalty/points-history")} activeOpacity={0.8}>
              <Text style={s.viewAllBtnText}>View Full History</Text>
              <Ionicons name="arrow-forward" size={16} color={K.colors.accent} />
            </TouchableOpacity>
          )}
        </View>

        {/* How it works */}
        <View style={s.howSection}>
          <Text style={s.sectionTitle}>How AfriPoints Works</Text>
          {[
            { icon: "cart-outline",        title: "Book & Earn",       body: "Earn 1 point for every $1 you spend on any booking."           },
            { icon: "trending-up-outline", title: "Tier Up",           body: "Reach higher tiers to unlock multipliers and exclusive perks." },
            { icon: "gift-outline",        title: "Redeem at Checkout",body: "Use your points to reduce the cost of future bookings."        },
            { icon: "refresh-outline",     title: "Auto-Refund",       body: "Points are automatically refunded if you cancel a confirmed booking." },
          ].map(({ icon, title, body }) => (
            <View key={title} style={s.howRow}>
              <View style={s.howIconWrap}>
                <Ionicons name={icon as any} size={22} color={K.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.howTitle}>{title}</Text>
                <Text style={s.howBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  scroll:    { paddingBottom: 60, gap: 16 },

  header:      { paddingHorizontal: K.spacing.screen, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.5 },
  headerSub:   { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 3 },

  skeletonCard: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xxl,
    padding: 24,
    marginHorizontal: K.spacing.screen,
    gap: 4,
  },
  errorCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 24,
    marginHorizontal: K.spacing.screen,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  errorText:    { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center" },
  retryBtn:     { backgroundColor: K.colors.darkGreen, borderRadius: K.radius.button, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    alignItems: "center",
    marginHorizontal: K.spacing.screen,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  summaryCell:  { flex: 1, alignItems: "center" },
  summarySep:   { width: 1, height: 36, backgroundColor: K.colors.border },
  summaryStat:  { fontSize: K.font.xl, fontWeight: "800", marginBottom: 3 },
  summaryLabel: { fontSize: 11, color: K.colors.textMuted, fontWeight: "500" },

  benefitsCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 18,
    marginHorizontal: K.spacing.screen,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  benefitsHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  benefitsIconWrap: { width: 36, height: 36, borderRadius: K.radius.full, alignItems: "center", justifyContent: "center" },
  benefitRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  benefitText:  { fontSize: K.font.sm, color: K.colors.textMid, flex: 1 },

  roadmap:    { backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl, padding: 18, marginHorizontal: K.spacing.screen, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.xs },
  roadmapRow: { flexDirection: "row", marginTop: 14, paddingHorizontal: 8 },
  roadmapStep:  { flex: 1, alignItems: "center", position: "relative" },
  roadmapDot: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: K.colors.border,
    backgroundColor: K.colors.bgCard,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8, zIndex: 1,
  },
  roadmapDotInner: { width: 10, height: 10, borderRadius: 5 },
  roadmapLabel:    { fontSize: 11, color: K.colors.textMuted, textAlign: "center" },
  roadmapPts:      { fontSize: 10, color: K.colors.textMuted, textAlign: "center" },
  roadmapLine: {
    position: "absolute",
    top: 14, left: "50%", right: "-50%",
    height: 2, backgroundColor: K.colors.border, zIndex: 0,
  },

  sectionTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 12 },

  recentSection: { backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl, padding: 18, marginHorizontal: K.spacing.screen, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.xs },
  recentHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  viewAll:       { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "700" },

  txRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: K.colors.bgSubtle },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 12 },
  txMeta:   { flex: 1, marginRight: 8 },
  txDesc:   { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark },
  txRef:    { fontSize: 11, color: K.colors.textMuted, marginTop: 2 },
  txRight:  { alignItems: "flex-end" },
  txPoints: { fontSize: K.font.base, fontWeight: "800" },
  txTypeLabel: { fontSize: 10, color: K.colors.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  txSkRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 12 },

  viewAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: 16, marginTop: 4, gap: 6 },
  viewAllBtnText: { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "700" },

  howSection: { backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl, padding: 18, marginHorizontal: K.spacing.screen, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.xs },
  howRow:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  howIconWrap: { width: 40, height: 40, borderRadius: K.radius.full, backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center", marginRight: 14 },
  howTitle:   { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 3 },
  howBody:    { fontSize: 12, color: K.colors.textMuted, lineHeight: 18 },

  errorInline: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16 },
  errorInlineText: { fontSize: K.font.sm, color: K.colors.textMuted },
  retryLink:   { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "600" },

  emptyState: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textMid },
  emptyBody:  { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20 },
});
