import { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Dimensions,
  Alert,
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLoyaltyProfile, usePointsHistoryInfinite } from "../../hooks/loyalty";
import { useMergedVouchers } from "../../hooks/vouchers";
import { VoucherCard, voucherActivityLabel, fmtVoucherDate } from "../../components/vouchers/VoucherCard";
import { SkeletonPulse } from "../../components/ui/SkeletonPulse";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import { TIER_COLORS, TIER_ICON, CARD_CFG, TIER_BENEFITS, TIER_ORDER } from "../../constants/loyaltyTiers";
import type { LoyaltyTier, PointsTransaction } from "../../lib/types/loyalty";
import type { WalletVoucher } from "../../lib/types/voucher";

// ── Constants ─────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width;
// vouchersSection content width (screen minus its own horizontal margin + padding),
// sized so the next card peeks in at the edge to hint the list scrolls.
const COUPON_CARD_WIDTH = Math.round((SCREEN_W - K.spacing.screen * 2 - 36) * 0.82);

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

// ── Premium Membership Card ───────────────────────────────────────────────────

function WalletCard({ tier, points }: { tier: LoyaltyTier; points: number }) {
  const router = useRouter();
  const cfg = CARD_CFG[tier];
  const { needed, nextLabel } = tierProgress(points, tier);
  const isTopTier = tier === "diamond";

  const progressText = isTopTier
    ? "✦ Maximum tier reached"
    : needed != null && nextLabel
    ? `–${needed.toLocaleString()} pts to ${nextLabel}`
    : "";

  const cardShadow = {
    shadowColor:   cfg.shadowColor,
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius:  22,
    elevation:     12,
  };

  return (
    <View style={[mc.card, { backgroundColor: cfg.cardBg }, cardShadow]}>
      {/* ── Decorative background layers (simulate metallic gradient) ── */}

      {/* Large top-right highlight blob */}
      <View style={[mc.blob1, { backgroundColor: cfg.blob1 }]} />
      {/* Bottom-left shadow blob */}
      <View style={[mc.blob2, { backgroundColor: cfg.blob2 }]} />

      {/* Diagonal shimmer strips (metallic sheen) */}
      <View style={[mc.sheen1, { backgroundColor: cfg.shimmer }]} />
      {cfg.shimmer2 && (
        <View style={[mc.sheen2, { backgroundColor: cfg.shimmer2 }]} />
      )}
      {cfg.shimmer3 && (
        <View style={[mc.sheen3, { backgroundColor: cfg.shimmer3 }]} />
      )}

      {/* Top edge highlight — rim-light effect like a physical card */}
      {cfg.topEdge && (
        <View style={[mc.topEdge, { backgroundColor: cfg.topEdge }]} />
      )}

      {/* Diamond prismatic border strip */}
      {tier === "diamond" && (
        <View style={mc.prismaticStrip}>
          {["#FF9999","#FFCC88","#FFFF88","#AAFFAA","#88CCFF","#CC88FF"].map((c, i) => (
            <View key={i} style={[mc.prismaticSegment, { backgroundColor: c }]} />
          ))}
        </View>
      )}

      {/* ── Card content ── */}
      <View style={mc.content}>

        {/* Row 1: Title + tier icon */}
        <View style={mc.topRow}>
          <View style={mc.titleBlock}>
            <Text style={[mc.brand, { color: cfg.textPrimary }]}>Kainook Elite</Text>
            <Text style={[mc.tierLabel, { color: cfg.textMuted }]}>
              {tier.toUpperCase()} MEMBER
            </Text>
          </View>

          {/* Tier icon circle */}
          <View style={[mc.iconCircle, { backgroundColor: cfg.iconCircle }]}>
            <Ionicons name={TIER_ICON[tier] as any} size={28} color={cfg.iconColor} />
          </View>
        </View>

        {/* Row 2: Points */}
        <View style={mc.pointsBlock}>
          <Text style={[mc.pointsLabel, { color: cfg.textMuted }]}>TOTAL POINTS</Text>
          <View style={mc.pointsRow}>
            <Text style={[mc.pointsValue, { color: cfg.textPrimary }]}>
              {points.toLocaleString()}
            </Text>
            <Text style={[mc.pointsSuffix, { color: cfg.textMuted }]}> pts</Text>
          </View>
        </View>

        {/* Separator */}
        <View style={[mc.separator, { backgroundColor: cfg.separator }]} />

        {/* Row 3: Progress + CTA */}
        <View style={mc.footer}>
          <Text style={[mc.progressText, { color: cfg.textMuted }]} numberOfLines={1}>
            {progressText}
          </Text>
          <TouchableOpacity
            style={[mc.viewBtn, { backgroundColor: cfg.btnBg }]}
            activeOpacity={0.82}
            onPress={() => router.push("/loyalty/benefits" as any)}
          >
            <Text style={[mc.viewBtnText, { color: cfg.btnText }]}>View Benefits</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    borderRadius: 26,
    overflow: "hidden",
    marginHorizontal: K.spacing.screen,
  },

  // Gradient simulation layers
  blob1: {
    position: "absolute",
    width: SCREEN_W * 0.6,
    height: SCREEN_W * 0.6,
    borderRadius: SCREEN_W * 0.3,
    top: -(SCREEN_W * 0.2),
    right: -(SCREEN_W * 0.12),
    opacity: 0.50,
  },
  blob2: {
    position: "absolute",
    width: SCREEN_W * 0.45,
    height: SCREEN_W * 0.45,
    borderRadius: SCREEN_W * 0.22,
    bottom: -(SCREEN_W * 0.14),
    left: -(SCREEN_W * 0.10),
    opacity: 0.42,
  },
  sheen1: {
    position: "absolute",
    width: 64, height: 600,
    top: -100, left: SCREEN_W * 0.22,
    transform: [{ rotate: "22deg" }],
  },
  sheen2: {
    position: "absolute",
    width: 44, height: 600,
    top: -100, left: SCREEN_W * 0.38,
    transform: [{ rotate: "22deg" }],
  },
  sheen3: {
    position: "absolute",
    width: 28, height: 600,
    top: -100, left: SCREEN_W * 0.52,
    transform: [{ rotate: "22deg" }],
  },
  topEdge: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 1.5,
  },
  prismaticStrip: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 3,
    flexDirection: "row",
    opacity: 0.55,
  },
  prismaticSegment: { flex: 1 },

  // Content
  content: { padding: 22, paddingVertical: 20 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  titleBlock: { flex: 1 },
  brand: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  tierLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  iconCircle: {
    width: 56, height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    marginTop: -2,
  },

  // Points
  pointsBlock: { marginBottom: 14 },
  pointsLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 5,
  },
  pointsRow:   { flexDirection: "row", alignItems: "baseline" },
  pointsValue: { fontSize: 44, fontWeight: "900", letterSpacing: -1.5 },
  pointsSuffix:{ fontSize: 19, fontWeight: "600" },

  // Footer
  separator: { height: 1, marginBottom: 14 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  progressText: { fontSize: 12, fontWeight: "500", flex: 1 },
  viewBtn: {
    borderRadius: K.radius.full,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  viewBtnText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
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
        <Text style={[s.txPoints, { color }]}>{sign}{(tx.points ?? 0).toLocaleString()}</Text>
        <Text style={s.txTypeLabel}>{tx.type}</Text>
      </View>
    </View>
  );
}

// ── Best Offer (hero voucher) ─────────────────────────────────────────────────

function BestOfferCard({ voucher, onUse }: { voucher: WalletVoucher; onUse: (code: string) => void }) {
  const bigLabel = voucher.discountType === "percentage" ? `${voucher.discountValue}%` : `$${voucher.discountValue}`;
  const metaText = [
    voucher.minOrderValue ? `Min spend $${voucher.minOrderValue}` : null,
    voucher.maxDiscount ? `Up to $${voucher.maxDiscount} off` : null,
    `Valid till ${fmtVoucherDate(voucher.validUntil)}`,
  ].filter(Boolean).join(" · ");

  return (
    <View style={bo.card}>
      <View style={bo.blob1} />
      <View style={bo.blob2} />

      <View style={bo.topRow}>
        <View style={bo.iconWrap}>
          <Ionicons name="pricetag" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={bo.bigRow}>
            <Text style={bo.bigLabel}>{bigLabel}</Text>
            <Text style={bo.offLabel}>OFF</Text>
          </View>
          <Text style={bo.subtitle}>on {voucherActivityLabel(voucher.activityScope)}</Text>
          <Text style={bo.meta} numberOfLines={1}>{metaText}</Text>
        </View>
      </View>

      <View style={bo.footer}>
        <View style={bo.codeChip}>
          <Text style={bo.codeText}>{voucher.code}</Text>
        </View>
        <TouchableOpacity style={bo.useBtn} activeOpacity={0.85} onPress={() => onUse(voucher.code)}>
          <Text style={bo.useBtnText}>Use Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const bo = StyleSheet.create({
  card: {
    backgroundColor: "#D9820F",
    borderRadius: K.radius.xl,
    padding: 18,
    overflow: "hidden",
    shadowColor: "#7A4C08",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  blob1: {
    position: "absolute",
    width: 160, height: 160, borderRadius: 80,
    top: -60, right: -40,
    backgroundColor: "#F0A238",
    opacity: 0.55,
  },
  blob2: {
    position: "absolute",
    width: 120, height: 120, borderRadius: 60,
    bottom: -50, left: -30,
    backgroundColor: "#8A5405",
    opacity: 0.35,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },
  bigRow: { flexDirection: "row", alignItems: "baseline" },
  bigLabel: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  offLabel: { fontSize: 16, fontWeight: "800", color: "rgba(255,255,255,0.85)", marginLeft: 6 },
  subtitle: { fontSize: K.font.sm, fontWeight: "600", color: "rgba(255,255,255,0.92)", marginTop: 2 },
  meta: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeChip: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: K.radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  codeText: { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  useBtn: { backgroundColor: "#0E0500", borderRadius: K.radius.full, paddingHorizontal: 20, paddingVertical: 10 },
  useBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});

// ── Empty voucher state ───────────────────────────────────────────────────────

function EmptyVoucherState({ onExplore }: { onExplore: () => void }) {
  return (
    <View style={ev.wrap}>
      <View style={ev.iconCircle}>
        <Ionicons name="pricetag-outline" size={32} color={K.colors.textMuted} />
      </View>
      <Text style={ev.title}>No vouchers available yet</Text>
      <Text style={ev.body}>Explore offers to unlock vouchers you can redeem at checkout.</Text>
      <TouchableOpacity style={ev.cta} onPress={onExplore} activeOpacity={0.85}>
        <Text style={ev.ctaText}>Explore Offers</Text>
      </TouchableOpacity>
    </View>
  );
}

const ev = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 24, gap: 6 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  body: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 8, paddingHorizontal: 12 },
  cta: { backgroundColor: K.colors.darkGreen, borderRadius: K.radius.button, paddingHorizontal: 22, paddingVertical: 11, marginTop: 4 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },
});

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

  const {
    bestVoucher, otherVouchers, heroSource,
    rawApplicableCount, usableApplicableCount, rawWalletCount, usableWalletCount,
    isLoading: vouchersLoading, isError: vouchersError, refetch: refetchVouchers,
  } = useMergedVouchers();

  const tier      = (profile?.currentTier ?? storeUser?.currentTier ?? "bronze") as LoyaltyTier;
  const points    = profile?.loyaltyPoints ?? storeUser?.loyaltyPoints ?? 0;
  const recentTxs = historyPages?.pages[0]?.transactions.slice(0, 5) ?? [];
  const summary   = historyPages?.pages[0];

  const showEmptyVoucherState = !vouchersLoading && !vouchersError && bestVoucher == null && otherVouchers.length === 0;

  useEffect(() => {
    if (vouchersLoading) return;
    console.log("[Rewards] /vouchers/applicable received:", rawApplicableCount, "usable:", usableApplicableCount);
    console.log("[Rewards] /vouchers/wallet received:", rawWalletCount, "usable:", usableWalletCount);
    console.log("[Rewards] selected hero voucher:", bestVoucher?.code ?? null, "source:", heroSource);
    console.log("[Rewards] My Coupons count:", otherVouchers.length);
    console.log(
      "[Rewards] empty state rendered:", showEmptyVoucherState,
      showEmptyVoucherState ? "(no bestVoucher AND no usable vouchers from applicable or wallet)" : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vouchersLoading, rawApplicableCount, rawWalletCount, bestVoucher?.code]);

  const onRefresh = () => { void refetchProfile(); void refetchHistory(); void refetchVouchers(); };

  const handleUseVoucher = (code: string) => {
    Clipboard.setString(code);
    Alert.alert("Code Copied", `"${code}" has been copied. Paste it at checkout to apply your discount.`);
  };

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
            {/* Title row */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ gap: 6 }}>
                <SkeletonPulse w={140} h={18} />
                <SkeletonPulse w={90} h={10} />
              </View>
              <SkeletonPulse w={56} h={56} />
            </View>
            {/* Points */}
            <SkeletonPulse w={80} h={10} mb={6} />
            <SkeletonPulse w={160} h={44} mb={14} />
            {/* Separator */}
            <SkeletonPulse w="100%" h={1} mb={14} />
            {/* Footer */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <SkeletonPulse w={120} h={12} />
              <SkeletonPulse w={110} h={40} />
            </View>
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
              <Text style={[s.summaryStat, { color: K.colors.success }]}>{(summary.totalEarned ?? 0).toLocaleString()}</Text>
              <Text style={s.summaryLabel}>Earned</Text>
            </View>
            <View style={s.summarySep} />
            <View style={s.summaryCell}>
              <Text style={[s.summaryStat, { color: "#7c3aed" }]}>{(summary.totalRedeemed ?? 0).toLocaleString()}</Text>
              <Text style={s.summaryLabel}>Redeemed</Text>
            </View>
            <View style={s.summarySep} />
            <View style={s.summaryCell}>
              <Text style={[s.summaryStat, { color: K.colors.error }]}>{(summary.totalReversed ?? 0).toLocaleString()}</Text>
              <Text style={s.summaryLabel}>Reversed</Text>
            </View>
          </View>
        )}

        {/* Tier roadmap */}
        {!profileLoading && <TierRoadmap currentTier={tier} />}

        {/* Best Offer + My Coupons */}
        <View style={s.vouchersSection}>
          <View style={s.recentHeader}>
            <View style={s.bestOfferTitleRow}>
              <Text style={s.sectionTitle}>Best Offer For You</Text>
              {bestVoucher && (
                <View style={s.bestBadge}>
                  <Ionicons name="star" size={9} color="#fff" />
                  <Text style={s.bestBadgeText}>Best</Text>
                </View>
              )}
            </View>
          </View>

          {vouchersLoading ? (
            <View style={s.voucherSkeleton}>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <SkeletonPulse w={44} h={44} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonPulse w={100} h={26} />
                  <SkeletonPulse w={140} h={13} />
                </View>
              </View>
            </View>
          ) : vouchersError ? (
            <View style={s.errorInline}>
              <Text style={s.errorInlineText}>Could not load your vouchers.</Text>
              <TouchableOpacity onPress={() => void refetchVouchers()}>
                <Text style={s.retryLink}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : showEmptyVoucherState ? (
            <EmptyVoucherState onExplore={() => router.push("/(tabs)")} />
          ) : (
            <>
              {bestVoucher && <BestOfferCard voucher={bestVoucher} onUse={handleUseVoucher} />}

              <View style={[s.recentHeader, { marginTop: 20 }]}>
                <Text style={s.sectionTitle}>My Coupons</Text>
                <TouchableOpacity onPress={() => router.push("/voucher-wallet")}>
                  <Text style={s.viewAll}>View All</Text>
                </TouchableOpacity>
              </View>

              {otherVouchers.length === 0 ? (
                <Text style={s.noMoreCoupons}>No other active coupons right now.</Text>
              ) : (
                <FlatList
                  data={otherVouchers}
                  keyExtractor={(v) => v.code}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={COUPON_CARD_WIDTH + 12}
                  decelerationRate="fast"
                  contentContainerStyle={{ gap: 12, paddingRight: 12 }}
                  renderItem={({ item }) => (
                    <View style={{ width: COUPON_CARD_WIDTH }}>
                      <VoucherCard item={item} onPress={() => handleUseVoucher(item.code)} />
                    </View>
                  )}
                />
              )}
            </>
          )}
        </View>

        {/* Benefits */}
        {!profileLoading && <BenefitsCard tier={tier} />}

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
    backgroundColor: "#B07010",
    borderRadius: 26,
    padding: 22,
    marginHorizontal: K.spacing.screen,
    gap: 6,
    shadowColor: "#7A4C08",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 12,
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

  vouchersSection: { backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl, padding: 18, marginHorizontal: K.spacing.screen, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.xs },
  bestOfferTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: K.colors.gold, borderRadius: K.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  bestBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  voucherSkeleton: { backgroundColor: K.colors.bgSubtle, borderRadius: K.radius.xl, padding: 18 },
  noMoreCoupons: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", paddingVertical: 12 },

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
