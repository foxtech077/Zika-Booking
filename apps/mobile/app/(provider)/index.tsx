import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { Ionicons } from "@expo/vector-icons";
import { ListingImage } from "../../components/ListingImage";
import { K } from "../../constants/theme";

const W = Dimensions.get("window").width;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentBooking {
  id: string; reference: string; listingTitle: string; listingCategory: string;
  listingId?: string; primaryPhotoUrl?: string | null;
  guestName: string; guestCount?: number;
  checkIn: string | null; checkOut: string | null;
  pickupDatetime: string | null; returnDatetime: string | null;
  totalAmount: number; providerPayout: number; currency: string; status: string;
}
interface MonthlyRevenue { month: string; revenue: number; bookings: number; }
interface DashboardData {
  totalEarnings: number; thisMonthEarnings: number; activeListingsCount: number;
  pendingBookingsCount: number; completedBookingsCount: number; unreadMessages: number;
  pendingReviews: number; recentBookings: RecentBooking[]; monthlyRevenue: MonthlyRevenue[];
}
interface ReviewsData { averageRating: number | null; totalReviews: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number, currency = "USD") {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function momPct(cur: number, prev: number): { label: string; pct: number } {
  if (prev === 0) return { label: cur > 0 ? "100.0" : "0.0", pct: cur > 0 ? 100 : 0 };
  const d = ((cur - prev) / prev) * 100;
  return { label: Math.abs(d).toFixed(1), pct: d };
}

function fmtDateRange(checkIn: string | null, checkOut: string | null, pickup: string | null, ret: string | null) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
  if (checkIn && checkOut) return `${fmt(checkIn)} – ${fmt(checkOut)}`;
  if (pickup && ret) {
    const days = Math.ceil((new Date(ret).getTime() - new Date(pickup).getTime()) / 86400000);
    return `${fmt(pickup)} · ${days} day${days !== 1 ? "s" : ""}`;
  }
  return "—";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, trend, trendPositive }: {
  icon: string; label: string; value: string;
  trend?: string; trendPositive?: boolean;
}) {
  return (
    <View style={mc.card}>
      <View style={mc.iconWrap}>
        <Ionicons name={icon as any} size={18} color={K.colors.darkGreen} />
      </View>
      <Text style={mc.label}>{label}</Text>
      <Text style={mc.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {trend ? (
        <Text style={[mc.trend, { color: trendPositive ? K.colors.success : K.colors.textMuted }]}>
          {trend}
        </Text>
      ) : null}
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  label: { fontSize: 11, color: K.colors.textMuted, marginBottom: 4, fontWeight: "500" },
  value: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: 4 },
  trend: { fontSize: 11, fontWeight: "600" },
});

// ── Quick Action ──────────────────────────────────────────────────────────────

function QuickAction({ icon, label, path, badge }: {
  icon: string; label: string; path: string; badge?: number;
}) {
  return (
    <TouchableOpacity style={qa.item} onPress={() => router.push(path as any)} activeOpacity={0.8}>
      <View style={qa.iconWrap}>
        <Ionicons name={icon as any} size={22} color={K.colors.darkGreen} />
        {badge && badge > 0 ? (
          <View style={qa.badge}>
            <Text style={qa.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={qa.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const qa = StyleSheet.create({
  item:    { alignItems: "center", gap: 8, flex: 1 },
  iconWrap: {
    width: 56, height: 56, borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: K.colors.accentDim,
  },
  badge: {
    position: "absolute", top: -2, right: -2,
    backgroundColor: K.colors.error,
    borderRadius: K.radius.full,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  label:     { fontSize: 11, fontWeight: "600", color: K.colors.textMid, textAlign: "center" },
});

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, linkLabel, onLink }: {
  title: string; linkLabel?: string; onLink?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {linkLabel && onLink ? (
        <TouchableOpacity onPress={onLink}>
          <Text style={s.sectionLink}>{linkLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Booking Row ───────────────────────────────────────────────────────────────

function BookingRow({ booking, isLast }: { booking: RecentBooking; isLast: boolean }) {
  const isCar   = booking.listingCategory === "car";
  const dateStr = fmtDateRange(booking.checkIn, booking.checkOut, booking.pickupDatetime, booking.returnDatetime);
  const guestCount = booking.guestCount ?? 2;

  return (
    <TouchableOpacity
      style={[br.row, !isLast && br.border]}
      onPress={() => router.push(`/provider/booking/${booking.id}` as any)}
      activeOpacity={0.75}
    >
      <View style={br.thumb}>
        {booking.primaryPhotoUrl ? (
          <ListingImage uri={booking.primaryPhotoUrl} style={br.thumbImg} />
        ) : (
          <View style={[br.thumbImg, br.thumbFallback]}>
            <Ionicons name={isCar ? "car-outline" : "business-outline"} size={22} color={K.colors.textMuted} />
          </View>
        )}
      </View>
      <View style={br.info}>
        <Text style={br.title} numberOfLines={1}>{booking.listingTitle}</Text>
        <View style={br.metaRow}>
          <Ionicons name="calendar-outline" size={11} color={K.colors.textMuted} />
          <Text style={br.meta}>{dateStr}</Text>
        </View>
        <View style={br.metaRow}>
          <Ionicons name="person-outline" size={11} color={K.colors.textMuted} />
          <Text style={br.meta}>
            {booking.guestName.split(" ")[0]} · {isCar ? `${guestCount} days` : `${guestCount} guests`}
          </Text>
        </View>
        <View style={br.refRow}>
          <Text style={br.ref}>{booking.reference}</Text>
        </View>
      </View>
      <View style={br.right}>
        <Text style={br.payoutLabel}>Net Payout</Text>
        <Text style={br.payout}>{fmtMoney(booking.providerPayout, booking.currency)}</Text>
        <Ionicons name="chevron-forward" size={14} color={K.colors.textMuted} style={{ marginTop: 6 }} />
      </View>
    </TouchableOpacity>
  );
}

const br = StyleSheet.create({
  row:         { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  border:      { borderBottomWidth: 1, borderBottomColor: K.colors.border },
  thumb:       { width: 72, height: 72, borderRadius: K.radius.md, overflow: "hidden", flexShrink: 0 },
  thumbImg:    { width: "100%", height: "100%" },
  thumbFallback: { backgroundColor: K.colors.bgSubtle, alignItems: "center", justifyContent: "center" },
  info:        { flex: 1 },
  title:       { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 5 },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  meta:        { fontSize: 11, color: K.colors.textMuted },
  refRow:      { marginTop: 4 },
  ref:         { fontSize: 10, fontWeight: "700", color: K.colors.accent, fontFamily: "monospace" },
  right:       { alignItems: "flex-end", flexShrink: 0 },
  payoutLabel: { fontSize: 10, color: K.colors.textMuted, marginBottom: 3 },
  payout:      { fontSize: K.font.base, fontWeight: "800", color: K.colors.darkGreen },
});

// ── Availability Stat ─────────────────────────────────────────────────────────

function AvailStat({ icon, label, value, iconColor }: {
  icon: string; label: string; value: number; iconColor: string;
}) {
  return (
    <View style={av.card}>
      <View style={[av.iconWrap, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={av.value}>{value}</Text>
      <Text style={av.label}>{label}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    padding: 14,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  iconWrap: { width: 36, height: 36, borderRadius: K.radius.full, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  value:    { fontSize: K.font.xxl, fontWeight: "900", color: K.colors.textDark, marginBottom: 3 },
  label:    { fontSize: 11, color: K.colors.textMuted, fontWeight: "500" },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProviderHomeScreen() {
  const user          = useAuthStore(s => s.user);
  const localCurrency = useAuthStore(s => s.localCurrency);
  const currency      = localCurrency ?? "USD";

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["providerDashboard"],
    queryFn:  async () => {
      const res = await listingApi.get<{ data: DashboardData }>("/provider/dashboard");
      return res.data.data;
    },
    enabled: !!user,
  });

  const { data: reviewsData } = useQuery<ReviewsData>({
    queryKey: ["providerReviewsSnippet"],
    queryFn:  async () => {
      const res = await listingApi.get<{ data: ReviewsData }>("/provider/reviews", { params: { limit: 2 } });
      return res.data.data;
    },
    enabled: !!user && !isLoading,
  });

  const recentBookings: RecentBooking[] = Array.isArray(data?.recentBookings) ? data.recentBookings.slice(0, 3) : [];
  const monthlyRevenue = Array.isArray(data?.monthlyRevenue) ? data.monthlyRevenue : [];
  const lastMonthRev   = monthlyRevenue.length >= 2 ? (monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0) : 0;
  const mom            = data && monthlyRevenue.length >= 2 ? momPct(data.thisMonthEarnings, lastMonthRev) : null;
  const totalListings  = data?.activeListingsCount ?? 0;
  const bookedCount    = data?.pendingBookingsCount ?? 0;
  const availableCount = Math.max(0, totalListings - bookedCount);
  const avgRating      = reviewsData?.averageRating ?? null;
  const totalReviews   = reviewsData?.totalReviews ?? 0;
  const unreadMessages = data?.unreadMessages ?? 0;

  // ── Loading ──
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: K.colors.darkGreen }}>
        <SafeAreaView edges={["top"]}>
          <View style={s.headerInner}>
            <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, backgroundColor: K.colors.bgApp, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      </View>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: K.colors.darkGreen }}>
        <SafeAreaView edges={["top"]}>
          <View style={s.headerInner}>
            <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, backgroundColor: K.colors.bgApp, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="cloud-offline-outline" size={48} color={K.colors.textMuted} />
          <Text style={{ fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, marginTop: 16, marginBottom: 8, textAlign: "center" }}>
            Could not load dashboard
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: K.colors.darkGreen, borderRadius: K.radius.button, paddingHorizontal: 28, paddingVertical: 13, ...K.shadow.brand }}
            onPress={() => refetch()}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: K.colors.darkGreen }}>
      {/* ── Dark header ── */}
      <SafeAreaView edges={["top"]}>
        <View style={s.headerInner}>
          <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.headerGreeting}>{greeting()}, {user?.firstName ?? "Partner"}</Text>
            <Text style={s.headerSub}>Here's your property overview.</Text>
          </View>
          <TouchableOpacity
            style={s.notifBtn}
            onPress={() => router.push("/notifications" as any)}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Hero Revenue Banner ── */}
      <View style={s.revenueBanner}>
        <View>
          <Text style={s.revenueBannerLabel}>THIS MONTH'S NET REVENUE</Text>
          <Text style={s.revenueBannerValue}>{fmtMoney(data?.thisMonthEarnings ?? 0, currency)}</Text>
          {mom && (
            <Text style={[s.revenueBannerTrend, { color: mom.pct >= 0 ? K.colors.accentLight : "#f87171" }]}>
              {mom.pct >= 0 ? "↑" : "↓"} {mom.label}% vs last month
            </Text>
          )}
        </View>
        <View style={s.revenueBannerBadge}>
          <Text style={s.revenueBannerBadgeIcon}>💰</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: K.colors.bgApp }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />}
      >
        {/* ── Metric Grid ── */}
        <View style={s.section}>
          <View style={s.metricsRow}>
            <MetricCard
              icon="calendar-outline"
              label="Completed Stays"
              value={String(data?.completedBookingsCount ?? 0)}
            />
            <MetricCard
              icon="home-outline"
              label="Active Listings"
              value={String(data?.activeListingsCount ?? 0)}
            />
          </View>
          <View style={[s.metricsRow, { marginTop: 10 }]}>
            <MetricCard
              icon="hourglass-outline"
              label="Pending Bookings"
              value={String(data?.pendingBookingsCount ?? 0)}
            />
            <MetricCard
              icon="star-outline"
              label="Avg Rating"
              value={avgRating != null ? avgRating.toFixed(1) : "—"}
              trend={totalReviews > 0 ? `★ From ${totalReviews} reviews` : "No reviews yet"}
              trendPositive={avgRating != null && avgRating >= 4}
            />
          </View>
        </View>

        {/* ── Revenue Insight ── */}
        {mom && mom.pct > 0 && (
          <View style={s.insightCard}>
            <View style={s.insightIconWrap}>
              <Ionicons name="trending-up" size={20} color={K.colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.insightTitle}>Great month!</Text>
              <Text style={s.insightBody}>
                Revenue is up{" "}
                <Text style={{ color: K.colors.success, fontWeight: "700" }}>{mom.label}%</Text>
                {" "}compared to last month.
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(provider)/analytics" as any)}>
              <Text style={s.insightLink}>View →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Upcoming Bookings ── */}
        <View style={s.section}>
          <SectionHeader
            title="Upcoming Bookings"
            linkLabel="View all"
            onLink={() => router.push("/(provider)/bookings" as any)}
          />
          <View style={s.card}>
            {recentBookings.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="calendar-outline" size={28} color={K.colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>No upcoming bookings</Text>
                <Text style={s.emptySub}>Confirmed bookings will appear here</Text>
              </View>
            ) : recentBookings.map((b, i) => (
              <BookingRow key={b.id} booking={b} isLast={i === recentBookings.length - 1} />
            ))}
          </View>
        </View>

        {/* ── Availability Overview ── */}
        <View style={s.section}>
          <SectionHeader
            title="Availability"
            linkLabel="Calendar"
            onLink={() => router.push("/(provider)/channels" as any)}
          />
          <View style={s.availGrid}>
            <View style={s.availRow}>
              <AvailStat icon="home"              label="Total Listings"  value={totalListings}    iconColor={K.colors.accent}  />
              <AvailStat icon="checkmark-circle"  label="Available Now"   value={availableCount}   iconColor={K.colors.success} />
            </View>
            <View style={[s.availRow, { marginTop: 10 }]}>
              <AvailStat icon="calendar"          label="Booked"          value={bookedCount}      iconColor={K.colors.info}    />
              <AvailStat icon="time"              label="On Hold"         value={data?.pendingReviews ?? 0} iconColor={K.colors.warning} />
            </View>
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={s.section}>
          <SectionHeader title="Quick Actions" />
          <View style={s.card}>
            <View style={s.qaRow}>
              <QuickAction icon="add-circle-outline" label="Add Listing"  path="/listings/new"         />
              <QuickAction icon="business-outline"   label="My Listings"  path="/(provider)/listings"  />
              <QuickAction icon="sync-circle-outline" label="Cal Sync"    path="/(provider)/channels"  />
              <QuickAction icon="star-outline"       label="Reviews"     path="/(provider)/reviews"    />
              <QuickAction icon="wallet-outline"     label="Payouts"     path="/wallet"                badge={unreadMessages} />
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: K.spacing.screen,
    paddingTop: 12,
    paddingBottom: 16,
  },
  logo:           { width: 90, height: 32 },
  headerGreeting: { fontSize: K.font.base, fontWeight: "700", color: "#fff" },
  headerSub:      { fontSize: 12, color: K.colors.textLightMuted, marginTop: 2 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  revenueBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: K.colors.darkGreenMid,
    marginHorizontal: K.spacing.screen,
    marginBottom: 0,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
  },
  revenueBannerLabel: { fontSize: 10, fontWeight: "800", color: K.colors.textLightMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  revenueBannerValue: { fontSize: K.font.xxxl, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  revenueBannerTrend: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  revenueBannerBadge: {
    width: 56, height: 56, borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg, borderWidth: 1, borderColor: K.colors.glassBorder,
    alignItems: "center", justifyContent: "center",
  },
  revenueBannerBadgeIcon: { fontSize: 28 },

  scroll:  { padding: K.spacing.screen, paddingTop: 20, gap: 20 },

  metricsRow: { flexDirection: "row", gap: 10 },

  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: K.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  insightIconWrap:  { width: 40, height: 40, borderRadius: K.radius.full, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center" },
  insightTitle:     { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  insightBody:      { fontSize: 12, color: K.colors.textMuted, lineHeight: 17 },
  insightLink:      { fontSize: K.font.sm, color: K.colors.success, fontWeight: "700" },

  section: {},
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.2 },
  sectionLink:  { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "700" },

  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: K.spacing.card,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },

  availGrid: {},
  availRow:  { flexDirection: "row", gap: 10 },

  qaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },

  empty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  emptySub:   { fontSize: 12, color: K.colors.textMuted, textAlign: "center" },
});
