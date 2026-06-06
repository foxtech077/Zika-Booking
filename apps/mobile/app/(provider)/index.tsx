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

const W = Dimensions.get("window").width;
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import { Feather } from "@expo/vector-icons";


// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentBooking {
  id: string;
  reference: string;
  listingTitle: string;
  listingCategory: string;
  guestName: string;
  checkIn: string | null;
  checkOut: string | null;
  pickupDatetime: string | null;
  returnDatetime: string | null;
  totalAmount: number;
  providerPayout: number;
  currency: string;
  status: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  bookings: number;
}

interface DashboardData {
  totalEarnings: number;
  thisMonthEarnings: number;
  activeListingsCount: number;
  pendingBookingsCount: number;
  completedBookingsCount: number;
  unreadMessages: number;
  pendingReviews: number;
  recentBookings: RecentBooking[];
  monthlyRevenue: MonthlyRevenue[];
}

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  guestName: string;
  listingName: string;
  createdAt: string;
}

interface ReviewsData {
  averageRating: number | null;
  totalReviews: number;
  reviews: ReviewItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthShort(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y!, 10), parseInt(mo!, 10) - 1, 1)
    .toLocaleDateString("en", { month: "short" });
}

function momPct(cur: number, prev: number): { label: string; up: boolean } {
  if (prev === 0) return { label: cur > 0 ? "+100%" : "—", up: cur > 0 };
  const d = ((cur - prev) / prev) * 100;
  return { label: `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`, up: d >= 0 };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" });
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    confirmed: "Confirmed",
    pending_payment: "Pending",
    completed: "Completed",
    cancelled_by_guest: "Cancelled",
    cancelled_by_provider: "Cancelled",
    cancelled_by_system: "Cancelled",
  };
  return map[s] ?? s;
}

function statusColors(s: string) {
  if (s === "confirmed") return K.colors.confirmed;
  if (s === "pending_payment") return K.colors.pending;
  if (s === "completed") return K.colors.completed;
  return K.colors.cancelled;
}

function verificationBadge(status: string, emailVerified: boolean) {
  if (status === "active" && emailVerified)
    return { label: "✓ Verified", bg: "#D1FAE5", text: "#065F46" };
  if (status === "suspended")
    return { label: "Suspended", bg: "#FEE2E2", text: "#DC2626" };
  if (status === "banned")
    return { label: "Banned", bg: "#FEE2E2", text: "#DC2626" };
  return { label: "Pending Verification", bg: "#FEF3C7", text: "#92400E" };
}

function getStatusBadge(status: string) {
  if (status === "active") {
    return { label: "Approved", bg: "#D1FAE5", text: "#065F46" };
  } else if (status === "pending_verification") {
    return { label: "Pending Review", bg: "#FEF3C7", text: "#92400E" };
  } else if (status === "suspended" || status === "banned") {
    return { label: "Suspended", bg: "#FEE2E2", text: "#DC2626" };
  }
  return null;
}

function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return (name.slice(0, 2)).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <View style={st.avatar}>
      <Text style={st.avatarText}>{initials(name)}</Text>
    </View>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={{ fontSize: 12, color: n <= Math.round(rating) ? "#F59E0B" : "#D1D5DB" }}>
          ★
        </Text>
      ))}
    </View>
  );
}

function Skel({ w, h, r = K.radius.md }: { w: number | string; h: number; r?: number }) {
  return (
    <View style={{ width: w as any, height: h, backgroundColor: "#1A5C42", borderRadius: r, opacity: 0.55 }} />
  );
}

function RevenueChart({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  const slice = data.slice(-6);
  const maxRev = Math.max(...slice.map((d) => d.revenue), 1);
  const hasAnyRevenue = slice.some((d) => d.revenue > 0);
  const BAR_MAX = 88;

  if (!hasAnyRevenue) return null;

  return (
    <View style={st.chartCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
        <View>
          <Text style={st.chartTitle}>Revenue Growth</Text>
          <Text style={st.chartSub}>Past 6 months performance</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(provider)/analytics" as any)}>
          <Text style={st.chartLink}>···</Text>
        </TouchableOpacity>
      </View>
      <View style={st.chartBars}>
        {slice.map((item, idx) => {
          const barH = Math.max(6, Math.round(BAR_MAX * (item.revenue / maxRev)));
          const isLast = idx === slice.length - 1;
          return (
            <View key={item.month} style={st.chartCol}>
              {item.revenue > 0 && (
                <Text style={st.chartValLabel}>
                  {item.revenue >= 1000 ? `${currency} ${(item.revenue / 1000).toFixed(0)}K` : `${currency} ${item.revenue}`}
                </Text>
              )}
              <View style={st.chartTrack}>
                <View
                  style={[
                    st.chartBar,
                    {
                      height: barH,
                      backgroundColor: isLast ? K.colors.accent : K.colors.accentDim,
                    },
                    isLast && { shadowColor: K.colors.accent, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
                  ]}
                />
              </View>
              <Text style={st.chartXLabel}>{monthShort(item.month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProviderHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const localCurrency = useAuthStore((s) => s.localCurrency);
  const currency = localCurrency ?? "USD";

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["providerDashboard"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: DashboardData }>("/provider/dashboard");
      return res.data.data;
    },
  });

  const { data: reviewsData } = useQuery<ReviewsData>({
    queryKey: ["providerReviewsSnippet"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ReviewsData }>("/provider/reviews", {
        params: { limit: 2 },
      });
      return res.data.data;
    },
    enabled: !isLoading,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const fullName = user ? `${user.firstName} ${user.lastName}` : "Partner";
  const badge = user ? getStatusBadge(user.status) : null;

  // ── Channels & Calendar Sync queries ─────────────────────────────────────────
  const { data: listingsData } = useQuery({
    queryKey: ["providerListingsForSync"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { listings: Array<{ id: string; name: string | null }> } }>("/listings", {
        params: { limit: "1" },
      });
      return res.data.data.listings;
    },
  });

  const firstListingId = listingsData?.[0]?.id;

  const { data: feedsData } = useQuery({
    queryKey: ["providerFeeds", firstListingId],
    queryFn: async () => {
      if (!firstListingId) return null;
      const res = await listingApi.get<{ data: { feeds: any[] } }>(`/listings/${firstListingId}/ical-feeds`);
      return res.data.data.feeds;
    },
    enabled: !!firstListingId,
  });

  const { data: blockedDatesData } = useQuery({
    queryKey: ["providerBlockedDates", firstListingId],
    queryFn: async () => {
      if (!firstListingId) return null;
      const res = await listingApi.get<{ data: { blockedDates: any[] } }>(`/listings/${firstListingId}/blocked-dates`);
      return res.data.data.blockedDates;
    },
    enabled: !!firstListingId,
  });

  const connectedFeedsCount = feedsData?.filter(f => f.isActive).length ?? 0;

  const getLastSyncTime = () => {
    if (!feedsData || feedsData.length === 0) return "Never";
    const times = feedsData
      .map(f => f.lastSyncedAt ? new Date(f.lastSyncedAt).getTime() : 0)
      .filter(t => t > 0);
    if (times.length === 0) return "Never";
    const latest = new Date(Math.max(...times));
    const diffMs = new Date().getTime() - latest.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return latest.toLocaleDateString("en", { day: "numeric", month: "short" });
  };

  const getSyncHealth = () => {
    if (!feedsData || feedsData.length === 0) return { label: "No Channels", color: K.colors.textMuted, status: "inactive" };
    const hasError = feedsData.some(f => f.isActive && f.lastError);
    if (hasError) return { label: "Action Required", color: "#EF4444", status: "error" };
    return { label: "Healthy & Syncing", color: K.colors.accent, status: "healthy" };
  };

  const health = getSyncHealth();

  const rev = data?.monthlyRevenue ?? [];
  const lastMonthRev = rev.length >= 2 ? (rev[rev.length - 2]?.revenue ?? 0) : 0;
  const mom = data && rev.length >= 2 ? momPct(data.thisMonthEarnings, lastMonthRev) : null;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={st.container}>
        <SafeAreaView edges={["top"]} style={st.header}>
          <View style={st.headerRowRedesign}>
            <View style={st.headerLeft}>
              <Skel w={100} h={36} r={4} />
            </View>
            <View style={st.headerRightRedesign}>
              <Skel w={100} h={13} />
              <View style={{ marginTop: 4 }}>
                <Skel w={120} h={24} r={6} />
              </View>
              <View style={{ marginTop: 6 }}>
                <Skel w={80} h={18} r={K.radius.full} />
              </View>
            </View>
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, padding: 16, gap: 14 }}>
          <Skel w="100%" h={190} r={K.radius.xl} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[0, 1, 2, 3].map((i) => <Skel key={i} w={(W - 56) / 4} h={80} r={K.radius.lg} />)}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Skel w={(W - 44) / 2} h={100} r={K.radius.xl} />
            <Skel w={(W - 44) / 2} h={100} r={K.radius.xl} />
          </View>
          <Skel w="100%" h={200} r={K.radius.xl} />
        </View>
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <View style={st.container}>
        <SafeAreaView edges={["top"]} style={st.header}>
          <View style={st.headerRowRedesign}>
            <View style={st.headerLeft}>
              <Image
                source={require("../../assets/logo.png")}
                style={st.logoRedesign}
                resizeMode="contain"
              />
            </View>
            <View style={st.headerRightRedesign}>
              <Text style={st.greeting}>{greeting()},</Text>
              <Text style={st.name}>{user?.firstName ?? "Partner"}</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={st.center}>
          <Text style={{ fontSize: 48 }}>⚠️</Text>
          <Text style={st.errTitle}>Could not load dashboard</Text>
          <Text style={st.errSub}>Check your connection and try again</Text>
          <TouchableOpacity style={st.retryBtn} onPress={() => refetch()}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={st.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={st.container}>
      {/* ── Header ────────────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={st.header}>
        <View style={st.headerRowRedesign}>
          <View style={st.headerLeft}>
            <Image
              source={require("../../assets/logo.png")}
              style={st.logoRedesign}
              resizeMode="contain"
            />
          </View>
          <View style={st.headerRightRedesign}>
            <Text style={st.greeting}>{greeting()},</Text>
            <Text style={st.name} numberOfLines={1}>{user?.firstName ?? "Partner"}</Text>
            {badge && (
              <View style={[st.verBadge, { backgroundColor: badge.bg }]}>
                <Text style={[st.verBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
        }
      >
        {/* ── Earnings Hero Card ─────────────────────────── */}
        <View style={st.earningsCard}>
          <View style={st.earningsHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.earningsLabel}>↗  Estimated Earnings</Text>
              <Text style={st.earningsValue}>
                {fmtMoney(data?.totalEarnings ?? 0, currency)}
              </Text>
              {mom && (
                <Text style={[st.earningsMom, { color: mom.up ? K.colors.accentLight : "#FCA5A5" }]}>
                  {mom.label} from last month
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={st.earningsArrow}
              onPress={() => router.push("/(provider)/analytics" as any)}
            >
              <Text style={st.earningsArrowTxt}>↗</Text>
            </TouchableOpacity>
          </View>
          <View style={st.earningsDivider} />
          <View style={st.earningsFooter}>
            <View style={st.earningsFoot}>
              <Text style={st.earningsFootLabel}>Active Bookings</Text>
              <Text style={st.earningsFootValue}>{data?.pendingBookingsCount ?? 0}</Text>
            </View>
            <View style={st.earningsFootDivider} />
            <View style={st.earningsFoot}>
              <Text style={st.earningsFootLabel}>Payout Status</Text>
              <Text style={[st.earningsFootValue, st.earningsFootAccent]}>
                {(data?.thisMonthEarnings ?? 0) > 0 ? "Active" : "Pending"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions ──────────────────────────────── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={st.qaGrid}>
          {[
            { icon: "➕", label: "Add\nListing", path: "/listings/new" },
            { icon: "📅", label: "Availability", path: "/(provider)/bookings" },
            { icon: "💵", label: "Set\nRates", path: "/(provider)/listings" },
            { icon: "👥", label: "Guests", path: "/(provider)/bookings" },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={st.qaItem}
              onPress={() => router.push(a.path as any)}
              activeOpacity={0.75}
            >
              <View style={st.qaIcon}>
                <Text style={st.qaEmoji}>{a.icon}</Text>
              </View>
              <Text style={st.qaLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stats Row ──────────────────────────────────── */}
        <View style={st.statsRow}>
          <TouchableOpacity
            style={st.statCard}
            onPress={() => router.push("/(provider)/bookings" as any)}
            activeOpacity={0.85}
          >
            <View style={st.statTop}>
              <View style={[st.statIconWrap, { backgroundColor: "#DCFCE7" }]}>
                <Text style={st.statIconEmoji}>📋</Text>
              </View>
              <View style={[st.statBadge, { backgroundColor: "#DCFCE7" }]}>
                <Text style={[st.statBadgeTxt, { color: "#16A34A" }]}>
                  +{data?.pendingBookingsCount ?? 0}
                </Text>
              </View>
            </View>
            <Text style={st.statValue}>{data?.completedBookingsCount ?? 0}</Text>
            <Text style={st.statLabel}>Bookings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={st.statCard}
            onPress={() => router.push("/(provider)/listings" as any)}
            activeOpacity={0.85}
          >
            <View style={st.statTop}>
              <View style={[st.statIconWrap, { backgroundColor: K.colors.accentDim }]}>
                <Text style={st.statIconEmoji}>🏠</Text>
              </View>
              <View style={[st.statBadge, { backgroundColor: K.colors.accentDim }]}>
                <Text style={[st.statBadgeTxt, { color: K.colors.accent }]}>
                  {data?.activeListingsCount ?? 0} active
                </Text>
              </View>
            </View>
            <Text style={st.statValue}>{data?.activeListingsCount ?? 0}</Text>
            <Text style={st.statLabel}>Listings</Text>
          </TouchableOpacity>
        </View>

        {/* ── Channel Sync Card ─────────────────────────── */}
        <TouchableOpacity
          style={st.syncCard}
          onPress={() => router.push("/(provider)/channels" as any)}
          activeOpacity={0.85}
        >
          <View style={st.syncCardTop}>
            <View style={st.syncCardLeft}>
              <View style={[st.syncIconWrap, { backgroundColor: health.status === "error" ? "#FEE2E2" : health.status === "healthy" ? K.colors.accentDim : "#E2E8F0" }]}>
                <Feather
                  name="refresh-cw"
                  size={18}
                  color={health.status === "error" ? "#EF4444" : health.status === "healthy" ? K.colors.accent : "#64748B"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.syncCardTitle}>Channel Sync</Text>
                <Text style={st.syncCardSub}>Synchronize calendar with Airbnb & Booking.com</Text>
              </View>
            </View>
            <View style={[st.healthBadge, { backgroundColor: health.status === "error" ? "#FEE2E2" : health.status === "healthy" ? "#D1FAE5" : "#E2E8F0" }]}>
              {health.status === "healthy" && <View style={st.pulsingDot} />}
              <Text style={[st.healthBadgeTxt, { color: health.color }]}>{health.label}</Text>
            </View>
          </View>
          <View style={st.syncCardDivider} />
          <View style={st.syncCardBottom}>
            <View style={st.syncStatItem}>
              <Text style={st.syncStatVal}>{connectedFeedsCount} Connected</Text>
              <Text style={st.syncStatLbl}>Active Channels</Text>
            </View>
            <View style={st.syncStatDivider} />
            <View style={st.syncStatItem}>
              <Text style={st.syncStatVal}>{getLastSyncTime()}</Text>
              <Text style={st.syncStatLbl}>Last Sync Time</Text>
            </View>
            <View style={st.syncStatDivider} />
            <View style={st.syncStatItem}>
              <Text style={st.syncStatVal}>{blockedDatesData?.length ?? 0}</Text>
              <Text style={st.syncStatLbl}>Blocked Dates</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Pending reviews alert ──────────────────────── */}
        {(data?.pendingReviews ?? 0) > 0 && (
          <TouchableOpacity style={st.alertCard} activeOpacity={0.85}>
            <Text style={st.alertEmoji}>💬</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.alertTitle}>
                {data!.pendingReviews} review{data!.pendingReviews > 1 ? "s" : ""} awaiting reply
              </Text>
              <Text style={st.alertSub}>Respond to build trust with guests</Text>
            </View>
            <Text style={st.alertArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Revenue chart ──────────────────────────────── */}
        {(data?.monthlyRevenue?.length ?? 0) > 0 && (
          <RevenueChart data={data!.monthlyRevenue} currency={currency} />
        )}

        {/* ── Recent Bookings ────────────────────────────── */}
        <View style={st.card}>
          <View style={st.cardHeader}>
            <Text style={st.cardTitle}>Recent Bookings</Text>
            <TouchableOpacity onPress={() => router.push("/(provider)/bookings" as any)}>
              <Text style={st.viewAllLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {!data?.recentBookings?.length ? (
            <View style={st.emptyBox}>
              <Text style={st.emptyIcon}>📋</Text>
              <Text style={st.emptyText}>No bookings yet</Text>
            </View>
          ) : (
            data.recentBookings.map((b, i) => {
              const sc = statusColors(b.status);
              const dateStr = b.checkIn
                ? `${fmtDate(b.checkIn)} – ${b.checkOut ? fmtDate(b.checkOut) : "?"}`
                : b.pickupDatetime
                ? fmtDate(b.pickupDatetime)
                : "—";
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[st.bookingRow, i > 0 && st.bookingRowBorder]}
                  onPress={() => router.push(`/provider/booking/${b.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={st.guestAvatar}>
                    <Text style={st.guestAvatarTxt}>{initials(b.guestName)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={st.bookingGuest} numberOfLines={1}>{b.guestName}</Text>
                    <Text style={st.bookingListing} numberOfLines={1}>{b.listingTitle}</Text>
                    <Text style={st.bookingDate}>⏱ {dateStr}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={st.bookingAmt}>
                      {b.currency} {b.providerPayout.toLocaleString()}
                    </Text>
                    <View style={[st.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[st.statusPillTxt, { color: sc.text }]}>
                        {statusLabel(b.status)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Reviews Snippet ────────────────────────────── */}
        {reviewsData && (
          <View style={st.card}>
            <View style={st.cardHeader}>
              <Text style={st.cardTitle}>Guest Reviews</Text>
              <TouchableOpacity onPress={() => router.push("/(provider)/analytics" as any)}>
                <Text style={st.viewAllLink}>See All</Text>
              </TouchableOpacity>
            </View>

            {reviewsData.averageRating !== null ? (
              <View style={st.ratingHero}>
                <Text style={st.ratingBig}>{reviewsData.averageRating.toFixed(1)}</Text>
                <View style={{ gap: 4 }}>
                  <StarRow rating={reviewsData.averageRating} />
                  <Text style={st.ratingCount}>{reviewsData.totalReviews} total review{reviewsData.totalReviews !== 1 ? "s" : ""}</Text>
                </View>
              </View>
            ) : null}

            {reviewsData.reviews.slice(0, 2).map((r, i) => (
              <View key={r.id} style={[st.reviewRow, i > 0 && st.reviewRowBorder]}>
                <View style={st.reviewTop}>
                  <Text style={st.reviewGuest}>{r.guestName}</Text>
                  <StarRow rating={r.rating} />
                </View>
                <Text style={st.reviewListing}>{r.listingName}</Text>
                <Text style={st.reviewBody} numberOfLines={2}>{r.body}</Text>
              </View>
            ))}

            {reviewsData.totalReviews === 0 && (
              <View style={st.emptyBox}>
                <Text style={st.emptyIcon}>⭐</Text>
                <Text style={st.emptyText}>No reviews yet</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Earnings Preview strip ─────────────────────── */}
        <View style={st.earningsStrip}>
          <View style={st.earningsStripItem}>
            <Text style={st.earningsStripLabel}>This Month</Text>
            <Text style={st.earningsStripValue}>{fmtMoney(data?.thisMonthEarnings ?? 0, currency)}</Text>
          </View>
          <View style={st.earningsStripDivider} />
          <View style={st.earningsStripItem}>
            <Text style={st.earningsStripLabel}>All Time</Text>
            <Text style={st.earningsStripValue}>{fmtMoney(data?.totalEarnings ?? 0, currency)}</Text>
          </View>
          <View style={st.earningsStripDivider} />
          <TouchableOpacity
            style={st.earningsStripItem}
            onPress={() => router.push("/wallet" as any)}
          >
            <Text style={st.earningsStripLabel}>Wallet</Text>
            <Text style={[st.earningsStripValue, { color: K.colors.accent }]}>→ View</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  // Header
  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  logo: { width: 80, height: 28, marginBottom: 14 },

  headerRowRedesign: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  logoRedesign: {
    width: 100,
    height: 36,
  },
  headerLeft: {
    justifyContent: "center",
  },
  headerRightRedesign: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },

  syncCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  syncCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  syncCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  syncIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  syncCardTitle: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  syncCardSub: {
    fontSize: 11,
    color: K.colors.textMuted,
    marginTop: 2,
  },
  healthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  healthBadgeTxt: {
    fontSize: 10,
    fontWeight: "700",
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.colors.accent,
  },
  syncCardDivider: {
    height: 1,
    backgroundColor: K.colors.border,
    marginVertical: 14,
  },
  syncCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  syncStatItem: {
    flex: 1,
    alignItems: "center",
  },
  syncStatVal: {
    fontSize: K.font.sm,
    fontWeight: "800",
    color: K.colors.textDark,
  },
  syncStatLbl: {
    fontSize: 9,
    color: K.colors.textMuted,
    marginTop: 4,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  syncStatDivider: {
    width: 1,
    backgroundColor: K.colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  greeting: { fontSize: K.font.sm, color: K.colors.textLightMuted, fontWeight: "500", marginBottom: 2 },
  name: { fontSize: K.font.xxl, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  bizName: { fontSize: K.font.sm, color: K.colors.textLightMuted, marginTop: 2 },
  verBadge: {
    alignSelf: "flex-start",
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  verBadgeText: { fontSize: K.font.xs, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  notifIcon: { fontSize: 17 },
  notifDot: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifDotTxt: { fontSize: 9, color: "#fff", fontWeight: "800" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: K.colors.accentLight,
  },
  avatarText: { fontSize: K.font.sm, fontWeight: "800", color: "#fff" },

  // Scroll
  scroll: { padding: 16, gap: 14 },

  // Earnings hero card
  earningsCard: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    padding: 22,
    ...K.shadow.md,
  },
  earningsHead: { flexDirection: "row", alignItems: "flex-start" },
  earningsLabel: {
    fontSize: K.font.sm,
    color: K.colors.textLightMuted,
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  earningsValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
    marginBottom: 4,
  },
  earningsMom: { fontSize: K.font.sm, fontWeight: "600" },
  earningsArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  earningsArrowTxt: { fontSize: 16, color: "#fff", fontWeight: "700" },
  earningsDivider: { height: 1, backgroundColor: K.colors.glassBorder, marginVertical: 16 },
  earningsFooter: { flexDirection: "row", gap: 12 },
  earningsFoot: { flex: 1 },
  earningsFootLabel: {
    fontSize: K.font.xs,
    color: K.colors.textLightDim,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  earningsFootValue: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },
  earningsFootAccent: { color: K.colors.accentLight },
  earningsFootDivider: { width: 1, backgroundColor: K.colors.glassBorder },

  // Quick Actions
  section: { marginBottom: -4 },
  sectionTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  qaGrid: { flexDirection: "row", gap: 10 },
  qaItem: { flex: 1, alignItems: "center", gap: 6 },
  qaIcon: {
    width: 56,
    height: 56,
    borderRadius: K.radius.lg,
    backgroundColor: K.colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  qaEmoji: { fontSize: 22 },
  qaLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: K.colors.textMid,
    textAlign: "center",
    lineHeight: 14,
  },

  // Stats
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: K.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statIconEmoji: { fontSize: 18 },
  statBadge: { borderRadius: K.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statBadgeTxt: { fontSize: 10, fontWeight: "700" },
  statValue: {
    fontSize: K.font.xxxl,
    fontWeight: "900",
    color: K.colors.textDark,
    letterSpacing: -1,
    marginBottom: 2,
  },
  statLabel: { fontSize: K.font.sm, color: K.colors.textMuted, fontWeight: "500" },

  // Alert
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: K.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertEmoji: { fontSize: 22 },
  alertTitle: { fontSize: K.font.base, fontWeight: "700", color: "#92400E" },
  alertSub: { fontSize: K.font.sm, color: "#B45309", marginTop: 2 },
  alertArrow: { fontSize: 24, color: "#B45309", fontWeight: "300" },

  // Chart
  chartCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  chartTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  chartSub: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 2 },
  chartLink: { fontSize: K.font.lg, color: K.colors.textMuted, fontWeight: "700" },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 130,
  },
  chartCol: { flex: 1, alignItems: "center" },
  chartValLabel: { fontSize: 8, color: K.colors.textMuted, marginBottom: 4, textAlign: "center" },
  chartTrack: { height: 88, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  chartBar: { width: "52%", borderRadius: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartXLabel: { fontSize: 10, color: K.colors.textMuted, marginTop: 6, fontWeight: "500" },

  // Generic card
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  viewAllLink: { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "600" },

  // Recent Bookings
  bookingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  bookingRowBorder: { borderTopWidth: 1, borderTopColor: K.colors.border },
  guestAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  guestAvatarTxt: { fontSize: K.font.base, fontWeight: "800", color: "#fff" },
  bookingGuest: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  bookingListing: { fontSize: K.font.xs, color: K.colors.textMid, marginTop: 2 },
  bookingDate: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 2 },
  bookingAmt: { fontSize: K.font.sm, fontWeight: "800", color: K.colors.textDark },
  statusPill: {
    borderRadius: K.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusPillTxt: { fontSize: 10, fontWeight: "700" },

  // Reviews
  ratingHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    marginBottom: 12,
  },
  ratingBig: {
    fontSize: 48,
    fontWeight: "900",
    color: K.colors.textDark,
    letterSpacing: -2,
  },
  ratingCount: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 4 },
  reviewRow: { paddingVertical: 12 },
  reviewRowBorder: { borderTopWidth: 1, borderTopColor: K.colors.border },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  reviewGuest: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  reviewListing: { fontSize: K.font.xs, color: K.colors.textMid, marginBottom: 4 },
  reviewBody: { fontSize: K.font.sm, color: K.colors.textMuted, lineHeight: 20 },

  // Earnings strip
  earningsStrip: {
    flexDirection: "row",
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    padding: 18,
    ...K.shadow.md,
  },
  earningsStripItem: { flex: 1, alignItems: "center" },
  earningsStripLabel: {
    fontSize: K.font.xs,
    color: K.colors.textLightDim,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  earningsStripValue: { fontSize: K.font.sm, fontWeight: "800", color: "#fff" },
  earningsStripDivider: { width: 1, backgroundColor: K.colors.glassBorder },

  // Misc
  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: K.font.sm, color: K.colors.textMuted },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errTitle: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  errSub: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 24,
    paddingVertical: 11,
    marginTop: 8,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
});
