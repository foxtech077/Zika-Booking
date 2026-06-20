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

const W = Dimensions.get("window").width;

const GREEN      = "#024622";
const GREEN_MID  = "#015428";
const GREEN_ACC  = "#1D8D2B";
const GREEN_LT   = "#F0FDF4";
const GREEN_BD   = "#BBF7D0";
const TEXT       = "#111827";
const MUTED      = "#6B7280";
const BORDER     = "#E5E7EB";
const BG         = "#F9FAFB";

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

function asArray<T = any>(value: any, ...nestedKeys: string[]): T[] {
  if (Array.isArray(value)) return value;
  for (const key of nestedKeys) {
    const nested = value?.[key];
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(n: number, currency = "USD") {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function momPct(cur: number, prev: number): { label: string; pct: number } {
  if (prev === 0) return { label: cur > 0 ? "100.0" : "0.0", pct: cur > 0 ? 100 : 0 };
  const d = ((cur - prev) / prev) * 100;
  return { label: Math.abs(d).toFixed(1), pct: d };
}
function fmtDateRange(checkIn: string | null, checkOut: string | null, pickupDatetime: string | null, returnDatetime: string | null) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  if (checkIn && checkOut) return `${fmt(checkIn)} – ${fmt(checkOut)}`;
  if (pickupDatetime && returnDatetime) {
    const days = Math.ceil((new Date(returnDatetime).getTime() - new Date(pickupDatetime).getTime()) / 86400000);
    return `${fmt(pickupDatetime)} · ${days} Day${days !== 1 ? "s" : ""}`;
  }
  return "—";
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Overview Metric Card ──────────────────────────────────────────────────────
function MetricCard({
  icon, iconBg, label, value, trend, trendColor, trendIcon,
}: {
  icon: string; iconBg: string; label: string; value: string;
  trend?: string; trendColor?: string; trendIcon?: string;
}) {
  return (
    <View style={mc.card}>
      <View style={[mc.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={GREEN_ACC} />
      </View>
      <Text style={mc.label}>{label}</Text>
      <Text style={mc.value}>{value}</Text>
      {trend ? (
        <View style={mc.trendRow}>
          {trendIcon ? <Text style={{ fontSize: 11 }}>{trendIcon}</Text> : null}
          <Text style={[mc.trendText, { color: trendColor ?? MUTED }]}>{trend}</Text>
        </View>
      ) : null}
    </View>
  );
}
const mc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  label: { fontSize: 12, color: MUTED, marginBottom: 4 },
  value: { fontSize: 18, fontWeight: "800", color: TEXT, marginBottom: 4 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  trendText: { fontSize: 11, fontWeight: "600" },
});

// ── Availability Stat ─────────────────────────────────────────────────────────
function AvailStat({ icon, iconBg, iconColor, label, value, sub }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: number; sub: string;
}) {
  return (
    <View style={av.card}>
      <View style={[av.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={av.label}>{label}</Text>
      <Text style={av.value}>{value}</Text>
      <Text style={av.sub}>{sub}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: BORDER, alignItems: "flex-start",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  label: { fontSize: 11, color: MUTED, marginBottom: 2 },
  value: { fontSize: 22, fontWeight: "900", color: TEXT, marginBottom: 2 },
  sub: { fontSize: 11, color: MUTED },
});

// ── Quick Action ──────────────────────────────────────────────────────────────
function QuickAction({ icon, label, path, badge }: {
  icon: string; label: string; path: string; badge?: number;
}) {
  return (
    <TouchableOpacity style={qa.item} onPress={() => router.push(path as any)} activeOpacity={0.8}>
      <View style={qa.iconWrap}>
        <Ionicons name={icon as any} size={24} color={GREEN} />
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
  item: { alignItems: "center", gap: 8, flex: 1 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: GREEN_LT, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: GREEN_BD,
  },
  badge: {
    position: "absolute", top: -2, right: -2,
    backgroundColor: "#EF4444", borderRadius: 8,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "600", color: TEXT, textAlign: "center" },
});

// ── Booking Row ───────────────────────────────────────────────────────────────
function BookingRow({ booking, isLast }: { booking: RecentBooking; isLast: boolean }) {
  const dateStr = fmtDateRange(booking.checkIn, booking.checkOut, booking.pickupDatetime, booking.returnDatetime);
  const guestCount = booking.guestCount ?? 2;
  const isCar = booking.listingCategory === "car";

  return (
    <TouchableOpacity
      style={[br.row, !isLast && br.border]}
      onPress={() => router.push(`/provider/booking/${booking.id}` as any)}
      activeOpacity={0.75}
    >
      {/* Thumbnail */}
      <View style={br.thumb}>
        {booking.primaryPhotoUrl ? (
          <ListingImage uri={booking.primaryPhotoUrl} style={br.thumbImg} />
        ) : (
          <View style={[br.thumbImg, br.thumbFallback]}>
            <Text style={{ fontSize: 22 }}>{isCar ? "🚗" : "🏨"}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={br.info}>
        <View style={br.titleRow}>
          <Text style={br.title} numberOfLines={1}>{booking.listingTitle}</Text>
          <View style={br.refBadge}>
            <Text style={br.refText}>{booking.reference}</Text>
          </View>
        </View>
        <View style={br.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={MUTED} />
          <Text style={br.meta}>{dateStr}</Text>
        </View>
        <View style={br.metaRow}>
          <Ionicons name="person-outline" size={12} color={MUTED} />
          <Text style={br.meta}>
            {booking.guestName.split(" ")[0]}.{"  "}
            {isCar ? `${guestCount} Days` : `${guestCount} Guests`}
          </Text>
        </View>
      </View>

      {/* Payout + arrow */}
      <View style={br.right}>
        <Text style={br.payoutLabel}>Net Payout</Text>
        <Text style={br.payout}>{fmtMoney(booking.providerPayout, booking.currency)}</Text>
        <Ionicons name="chevron-forward" size={16} color={MUTED} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}
const br = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: BORDER },
  thumb: { width: 80, height: 80, borderRadius: 10, overflow: "hidden", flexShrink: 0 },
  thumbImg: { width: "100%", height: "100%" },
  thumbFallback: { backgroundColor: GREEN_LT, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" },
  title: { fontSize: 14, fontWeight: "700", color: TEXT, flexShrink: 1 },
  refBadge: {
    backgroundColor: GREEN_LT, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: GREEN_BD,
  },
  refText: { fontSize: 10, fontWeight: "700", color: GREEN_ACC },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  meta: { fontSize: 12, color: MUTED },
  right: { alignItems: "flex-end", flexShrink: 0 },
  payoutLabel: { fontSize: 11, color: MUTED, marginBottom: 4 },
  payout: { fontSize: 15, fontWeight: "800", color: GREEN_ACC },
});

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, linkLabel, onLink }: {
  title: string; linkLabel?: string; onLink?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color: TEXT }}>{title}</Text>
      {linkLabel && onLink && (
        <TouchableOpacity onPress={onLink}>
          <Text style={{ fontSize: 13, color: GREEN_ACC, fontWeight: "700" }}>{linkLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ProviderHomeScreen() {
  const user = useAuthStore(s => s.user);
  const localCurrency = useAuthStore(s => s.localCurrency);
  const currency = localCurrency ?? "USD";

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["providerDashboard"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: DashboardData }>("/provider/dashboard");
      return res.data.data;
    },
    enabled: !!user,
  });

  const { data: reviewsData } = useQuery<ReviewsData>({
    queryKey: ["providerReviewsSnippet"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ReviewsData }>("/provider/reviews", { params: { limit: 2 } });
      return res.data.data;
    },
    enabled: !!user && !isLoading,
  });

  const recentBookings: RecentBooking[] = Array.isArray(data?.recentBookings)
    ? data.recentBookings.slice(0, 3)
    : [];
  const monthlyRevenue = Array.isArray(data?.monthlyRevenue) ? data.monthlyRevenue : [];
  const rev = monthlyRevenue;
  const lastMonthRev = rev.length >= 2 ? (rev[rev.length - 2]?.revenue ?? 0) : 0;
  const mom = data && rev.length >= 2 ? momPct(data.thisMonthEarnings, lastMonthRev) : null;
  const totalListings = data?.activeListingsCount ?? 0;
  const bookedCount = data?.pendingBookingsCount ?? 0;
  const availableCount = Math.max(0, totalListings - bookedCount);
  const avgRating = reviewsData?.averageRating ?? 4.8;
  const totalReviews = reviewsData?.totalReviews ?? 0;
  const unreadMessages = data?.unreadMessages ?? 0;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: GREEN }}>
        <SafeAreaView edges={["top"]}>
          <View style={s.headerInner}>
            <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={GREEN_ACC} size="large" />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: GREEN }}>
        <SafeAreaView edges={["top"]}>
          <View style={s.headerInner}>
            <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT, marginBottom: 8 }}>Could not load dashboard</Text>
          <TouchableOpacity
            style={{ backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            onPress={() => refetch()}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: GREEN }}>
      {/* ── Dark green header ── */}
      <SafeAreaView edges={["top"]}>
        <View style={s.headerInner}>
          <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.headerGreeting}>{greeting()}, {user?.firstName ?? "Partner"} 👋</Text>
            <Text style={s.headerSub}>Here's what's happening with your properties today.</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={GREEN_ACC} />}
      >

        {/* ── Overview Card ── */}
        <View style={s.overviewCard}>
          <View style={s.overviewHeader}>
            <Text style={s.overviewTitle}>Overview</Text>
            <TouchableOpacity style={s.monthPicker}>
              <Text style={s.monthPickerText}>This Month</Text>
              <Ionicons name="chevron-down" size={14} color={TEXT} />
            </TouchableOpacity>
          </View>

          {/* 4 metric cards */}
          <View style={s.metricsRow}>
            <MetricCard
              icon="wallet-outline"
              iconBg={GREEN_LT}
              label="Net Revenue"
              value={fmtMoney(data?.thisMonthEarnings ?? 0, currency)}
              trend={mom ? `↑ ${mom.label}% vs last month` : undefined}
              trendColor={GREEN_ACC}
            />
            <MetricCard
              icon="calendar-outline"
              iconBg={GREEN_LT}
              label="Bookings"
              value={String(data?.completedBookingsCount ?? 0)}
              trend={`↑ 15.2% vs last month`}
              trendColor={GREEN_ACC}
            />
          </View>
          <View style={[s.metricsRow, { marginTop: 10 }]}>
            <MetricCard
              icon="time-outline"
              iconBg={GREEN_LT}
              label="Pending Payout"
              value={fmtMoney((data?.thisMonthEarnings ?? 0) * 0.19, currency)}
              trend="⏳ Due in 2 days"
              trendColor="#D97706"
            />
            <MetricCard
              icon="star-outline"
              iconBg={GREEN_LT}
              label="Average Rating"
              value={avgRating.toFixed(1)}
              trend={totalReviews > 0 ? `★ From ${totalReviews} reviews` : "No reviews yet"}
              trendColor="#F59E0B"
            />
          </View>

          {/* Revenue up banner */}
          {mom && mom.pct > 0 ? (
            <View style={s.insightBanner}>
              <View style={s.insightIcon}>
                <Text style={{ fontSize: 16 }}>%</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.insightTitle}>Great job!</Text>
                <Text style={s.insightSub}>
                  Your revenue is up{" "}
                  <Text style={{ color: GREEN_ACC, fontWeight: "700" }}>{mom.label}%</Text>
                  {" "}compared to last month.
                </Text>
              </View>
              <TouchableOpacity
                style={s.insightBtn}
                onPress={() => router.push("/(provider)/analytics" as any)}
              >
                <Text style={s.insightBtnText}>View Insights</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

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
                <Ionicons name="calendar-outline" size={36} color={MUTED} />
                <Text style={s.emptyTitle}>No upcoming bookings</Text>
                <Text style={s.emptySub}>Your upcoming bookings will appear here</Text>
              </View>
            ) : recentBookings.map((b, i) => (
              <BookingRow key={b.id} booking={b} isLast={i === recentBookings.length - 1} />
            ))}
          </View>
        </View>

        {/* ── Availability Overview ── */}
        <View style={s.section}>
          <SectionHeader
            title="Availability Overview"
            linkLabel="View Calendar"
            onLink={() => router.push("/(provider)/analytics" as any)}
          />
          <View style={s.availGrid}>
            <View style={s.availRow}>
              <AvailStat
                icon="home"
                iconBg={GREEN_LT}
                iconColor={GREEN_ACC}
                label="Total Listings"
                value={totalListings}
                sub="Across all categories"
              />
              <AvailStat
                icon="checkmark-circle"
                iconBg={GREEN_LT}
                iconColor={GREEN_ACC}
                label="Available Now"
                value={availableCount}
                sub="Units / Vehicles"
              />
            </View>
            <View style={s.availRow}>
              <AvailStat
                icon="calendar"
                iconBg={GREEN_LT}
                iconColor={GREEN_ACC}
                label="Booked"
                value={bookedCount}
                sub="Units / Vehicles"
              />
              <AvailStat
                icon="time"
                iconBg="#FEF3C7"
                iconColor="#D97706"
                label="On Hold"
                value={data?.pendingReviews ?? 0}
                sub="Units / Vehicles"
              />
            </View>
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={s.section}>
          <SectionHeader title="Quick Actions" />
          <View style={s.qaRow}>
            <QuickAction icon="add-circle" label="Add Listing" path="/listings/new" />
            <QuickAction icon="business" label="Manage Listings" path="/(provider)/listings" />
            <QuickAction icon="calendar" label="Calendar" path="/(provider)/analytics" />
            <QuickAction icon="chatbubbles" label="Messages" path="/(provider)/channels" badge={unreadMessages} />
            <QuickAction icon="wallet" label="Payouts" path="/wallet" />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // Header
  headerInner: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20,
  },
  logo: { width: 100, height: 36 },
  headerGreeting: { fontSize: 17, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3 },

  scroll: { padding: 16, gap: 20 },

  // Overview card
  overviewCard: {
    backgroundColor: "#fff", borderRadius: 20,
    padding: 18, borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  overviewHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 16,
  },
  overviewTitle: { fontSize: 17, fontWeight: "800", color: TEXT },
  monthPicker: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: BORDER, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  monthPickerText: { fontSize: 13, fontWeight: "600", color: TEXT },
  metricsRow: { flexDirection: "row", gap: 10 },
  insightBanner: {
    flexDirection: "row", alignItems: "center",
    marginTop: 14, backgroundColor: GREEN_LT,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: GREEN_BD,
  },
  insightIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: GREEN_ACC, alignItems: "center", justifyContent: "center",
  },
  insightTitle: { fontSize: 13, fontWeight: "700", color: TEXT, marginBottom: 2 },
  insightSub: { fontSize: 12, color: MUTED, lineHeight: 17 },
  insightBtn: {
    borderWidth: 1.5, borderColor: GREEN_ACC, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  insightBtnText: { fontSize: 12, fontWeight: "700", color: GREEN_ACC },

  section: {},
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },

  availGrid: { gap: 10 },
  availRow: { flexDirection: "row", gap: 10 },

  qaRow: { flexDirection: "row", justifyContent: "space-between" },

  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  emptySub: { fontSize: 12, color: MUTED, textAlign: "center" },
});
