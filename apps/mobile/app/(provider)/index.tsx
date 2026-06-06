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
  Platform,
} from "react-native";

const W = Dimensions.get("window").width;
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import { Feather } from "@expo/vector-icons";

// ── Design tokens ─────────────────────────────────────────────────────────────
const GREEN    = "#00A86B";
const GREEN_LT = "#E8F7F0";
const GREEN_MD = "#C8EFDE";
const BG       = "#F6F8F7";
const CARD     = "#FFFFFF";
const BORDER   = "#E5EEE9";
const TEXT     = "#0F1F17";
const MUTED    = "#6B8A7A";
const MID      = "#3D5A4C";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RecentBooking {
  id: string; reference: string; listingTitle: string; listingCategory: string;
  guestName: string; checkIn: string | null; checkOut: string | null;
  pickupDatetime: string | null; returnDatetime: string | null;
  totalAmount: number; providerPayout: number; currency: string; status: string;
}
interface MonthlyRevenue { month: string; revenue: number; bookings: number; }
interface DashboardData {
  totalEarnings: number; thisMonthEarnings: number; activeListingsCount: number;
  pendingBookingsCount: number; completedBookingsCount: number; unreadMessages: number;
  pendingReviews: number; recentBookings: RecentBooking[]; monthlyRevenue: MonthlyRevenue[];
}
interface ReviewItem {
  id: string; rating: number; title: string | null; body: string;
  guestName: string; listingName: string; createdAt: string;
}
interface ReviewsData { averageRating: number | null; totalReviews: number; reviews: ReviewItem[]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function monthShort(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y!, 10), parseInt(mo!, 10) - 1, 1).toLocaleDateString("en", { month: "short" });
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
    confirmed: "Confirmed", pending_payment: "Pending", completed: "Completed",
    cancelled_by_guest: "Cancelled", cancelled_by_provider: "Cancelled", cancelled_by_system: "Cancelled",
  };
  return map[s] ?? s;
}
function statusColors(s: string) {
  if (s === "confirmed") return { bg: "#DCFCE7", text: "#16A34A" };
  if (s === "pending_payment") return { bg: "#FEF9C3", text: "#854D0E" };
  if (s === "completed") return { bg: "#F3F4F6", text: "#4B5563" };
  return { bg: "#FEE2E2", text: "#DC2626" };
}
function initials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
function getStatusBadge(status: string) {
  if (status === "active") return { label: "✓ Verified", bg: GREEN_LT, text: GREEN };
  if (status === "pending_verification") return { label: "Pending Review", bg: "#FEF9C3", text: "#854D0E" };
  if (status === "suspended" || status === "banned") return { label: "Suspended", bg: "#FEE2E2", text: "#DC2626" };
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ title, linkLabel, onLink }: { title: string; linkLabel?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {linkLabel && onLink && (
        <TouchableOpacity onPress={onLink}>
          <Text style={s.sectionLink}>{linkLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1,2,3,4,5].map(n => (
        <Text key={n} style={{ fontSize: size, color: n <= Math.round(rating) ? "#F59E0B" : "#D1D5DB" }}>★</Text>
      ))}
    </View>
  );
}

function StatCard({
  icon, label, value, badge, badgeColor, onPress,
}: {
  icon: string; label: string; value: string | number;
  badge?: string; badgeColor?: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.statCard} onPress={onPress} activeOpacity={0.88}>
      <View style={s.statIconWrap}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {badge ? (
        <View style={[s.statBadge, { backgroundColor: badgeColor ?? GREEN_LT }]}>
          <Text style={[s.statBadgeText, { color: badgeColor ? "#fff" : GREEN }]}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, path }: { icon: string; label: string; path: string }) {
  return (
    <TouchableOpacity style={s.qaItem} onPress={() => router.push(path as any)} activeOpacity={0.8}>
      <View style={s.qaIcon}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={s.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function RevenueBar({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  const slice = data.slice(-6);
  const maxRev = Math.max(...slice.map(d => d.revenue), 1);
  if (!slice.some(d => d.revenue > 0)) return null;
  const BAR_MAX = 72;

  return (
    <View>
      <SectionLabel title="Revenue Trend" linkLabel="Analytics →" onLink={() => router.push("/(provider)/analytics" as any)} />
      <View style={s.chartCard}>
        <View style={s.chartBars}>
          {slice.map((item, idx) => {
            const barH = Math.max(6, Math.round(BAR_MAX * (item.revenue / maxRev)));
            const isLast = idx === slice.length - 1;
            return (
              <View key={item.month} style={s.chartCol}>
                {item.revenue > 0 && (
                  <Text style={s.chartVal}>
                    {item.revenue >= 1000 ? `${(item.revenue / 1000).toFixed(0)}K` : `${item.revenue}`}
                  </Text>
                )}
                <View style={s.chartTrack}>
                  <View style={[
                    s.chartBar,
                    { height: barH, backgroundColor: isLast ? GREEN : GREEN_MD },
                    isLast && { shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
                  ]} />
                </View>
                <Text style={s.chartX}>{monthShort(item.month)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skel({ w, h, r = 12 }: { w: number | string; h: number; r?: number }) {
  return <View style={{ width: w as any, height: h, backgroundColor: "#E5EEE9", borderRadius: r }} />;
}

function LoadingSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <Skel w={110} h={34} r={6} />
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Skel w={90} h={12} r={4} />
            <Skel w={120} h={22} r={6} />
          </View>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Skel w="100%" h={160} r={20} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[0,1,2,3].map(i => <Skel key={i} w={(W - 62) / 4} h={90} r={14} />)}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[0,1,2,3].map(i => <Skel key={i} w={(W - 62) / 4} h={100} r={14} />)}
        </View>
        <Skel w="100%" h={180} r={20} />
        <Skel w="100%" h={220} r={20} />
      </ScrollView>
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
  });

  const { data: reviewsData } = useQuery<ReviewsData>({
    queryKey: ["providerReviewsSnippet"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ReviewsData }>("/provider/reviews", { params: { limit: 2 } });
      return res.data.data;
    },
    enabled: !isLoading,
  });

  const { data: listingsData } = useQuery({
    queryKey: ["providerListingsForSync"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { listings: Array<{ id: string; name: string | null }> } }>("/listings", { params: { limit: "1" } });
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const connectedFeedsCount = feedsData?.filter((f: any) => f.isActive).length ?? 0;
  const getLastSyncTime = () => {
    if (!feedsData || feedsData.length === 0) return "Never";
    const times = feedsData.map((f: any) => f.lastSyncedAt ? new Date(f.lastSyncedAt).getTime() : 0).filter((t: number) => t > 0);
    if (times.length === 0) return "Never";
    const latest = new Date(Math.max(...times));
    const diff = Math.floor((Date.now() - latest.getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return latest.toLocaleDateString("en", { day: "numeric", month: "short" });
  };
  const getSyncHealth = () => {
    if (!feedsData || feedsData.length === 0) return { label: "Not Connected", color: MUTED, status: "inactive" };
    if (feedsData.some((f: any) => f.isActive && f.lastError)) return { label: "Action Needed", color: "#DC2626", status: "error" };
    return { label: "Syncing", color: GREEN, status: "healthy" };
  };
  const health = getSyncHealth();

  const rev = data?.monthlyRevenue ?? [];
  const lastMonthRev = rev.length >= 2 ? (rev[rev.length - 2]?.revenue ?? 0) : 0;
  const mom = data && rev.length >= 2 ? momPct(data.thisMonthEarnings, lastMonthRev) : null;
  const badge = user ? getStatusBadge(user.status) : null;

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={["top"]} style={s.header}>
          <View style={s.headerRow}>
            <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
            <Text style={s.greeting}>{greeting()}, {user?.firstName ?? "Partner"}</Text>
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT, marginBottom: 6 }}>Could not load dashboard</Text>
          <Text style={{ fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 20 }}>Check your connection and try again</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          {/* Logo */}
          <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />

          {/* Greeting + badge */}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.greeting}>{greeting()}</Text>
            <Text style={s.headerName} numberOfLines={1}>{user?.firstName ?? "Partner"} 👋</Text>
            {badge && (
              <View style={[s.verBadge, { backgroundColor: badge.bg }]}>
                <Text style={[s.verBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={GREEN} />}
      >

        {/* ── Earnings Hero ──────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.earningsCard}
          onPress={() => router.push("/(provider)/analytics" as any)}
          activeOpacity={0.96}
        >
          {/* Decorative accent bar */}
          <View style={s.earningsAccentBar} />

          <View style={s.earningsBody}>
            <View style={{ flex: 1 }}>
              <Text style={s.earningsLabel}>TOTAL EARNINGS</Text>
              <Text style={s.earningsValue}>{fmtMoney(data?.totalEarnings ?? 0, currency)}</Text>
              {mom && (
                <View style={[s.momBadge, { backgroundColor: mom.up ? GREEN_LT : "#FEE2E2" }]}>
                  <Text style={[s.momText, { color: mom.up ? GREEN : "#DC2626" }]}>
                    {mom.up ? "↑" : "↓"} {mom.label} vs last month
                  </Text>
                </View>
              )}
            </View>
            <View style={s.earningsArrow}>
              <Feather name="arrow-up-right" size={20} color={GREEN} />
            </View>
          </View>

          <View style={s.earningsDivider} />

          {/* Footer stats */}
          <View style={s.earningsFooter}>
            <View style={s.earningsFoot}>
              <Text style={s.earningsFootLabel}>This Month</Text>
              <Text style={s.earningsFootValue}>{fmtMoney(data?.thisMonthEarnings ?? 0, currency)}</Text>
            </View>
            <View style={s.earningsFootDivider} />
            <View style={s.earningsFoot}>
              <Text style={s.earningsFootLabel}>Active Bookings</Text>
              <Text style={s.earningsFootValue}>{data?.pendingBookingsCount ?? 0}</Text>
            </View>
            <View style={s.earningsFootDivider} />
            <View style={s.earningsFoot}>
              <Text style={s.earningsFootLabel}>Payout</Text>
              <Text style={[s.earningsFootValue, { color: (data?.thisMonthEarnings ?? 0) > 0 ? GREEN : MUTED }]}>
                {(data?.thisMonthEarnings ?? 0) > 0 ? "Active" : "Pending"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Quick Actions ───────────────────────────────────────────── */}
        <View>
          <SectionLabel title="Quick Actions" />
          <View style={s.qaRow}>
            <QuickAction icon="➕" label="New Listing"  path="/listings/new" />
            <QuickAction icon="📅" label="Bookings"    path="/(provider)/bookings" />
            <QuickAction icon="🏠" label="My Listings" path="/(provider)/listings" />
            <QuickAction icon="💰" label="Wallet"      path="/wallet" />
          </View>
        </View>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <View>
          <SectionLabel title="Overview" />
          <View style={s.statsRow}>
            <StatCard
              icon="📋"
              label="Bookings"
              value={data?.completedBookingsCount ?? 0}
              badge={`+${data?.pendingBookingsCount ?? 0} pending`}
              onPress={() => router.push("/(provider)/bookings" as any)}
            />
            <StatCard
              icon="🏠"
              label="Listings"
              value={data?.activeListingsCount ?? 0}
              badge={`${data?.activeListingsCount ?? 0} active`}
              onPress={() => router.push("/(provider)/listings" as any)}
            />
            <StatCard
              icon="⭐"
              label="Reviews"
              value={reviewsData?.totalReviews ?? 0}
              badge={reviewsData?.averageRating ? `${reviewsData.averageRating.toFixed(1)} ★` : undefined}
              onPress={() => router.push("/(provider)/analytics" as any)}
            />
            <StatCard
              icon="💬"
              label="Messages"
              value={data?.unreadMessages ?? 0}
              badge={data?.unreadMessages ? "Unread" : undefined}
              badgeColor={(data?.unreadMessages ?? 0) > 0 ? "#EF4444" : undefined}
            />
          </View>
        </View>

        {/* ── Pending reviews alert ────────────────────────────────────── */}
        {(data?.pendingReviews ?? 0) > 0 && (
          <View style={s.alertCard}>
            <View style={s.alertIcon}>
              <Text style={{ fontSize: 18 }}>💬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{data!.pendingReviews} review{data!.pendingReviews > 1 ? "s" : ""} awaiting your reply</Text>
              <Text style={s.alertSub}>Responding builds trust and improves your rating</Text>
            </View>
            <Feather name="chevron-right" size={18} color={MUTED} />
          </View>
        )}

        {/* ── Revenue chart ─────────────────────────────────────────────── */}
        {(data?.monthlyRevenue?.length ?? 0) > 0 && (
          <RevenueBar data={data!.monthlyRevenue} currency={currency} />
        )}

        {/* ── Channel sync ─────────────────────────────────────────────── */}
        <View>
          <SectionLabel title="Calendar Sync" linkLabel="Manage →" onLink={() => router.push("/(provider)/channels" as any)} />
          <TouchableOpacity style={s.syncCard} onPress={() => router.push("/(provider)/channels" as any)} activeOpacity={0.88}>
            <View style={s.syncTop}>
              <View style={[s.syncIconWrap, {
                backgroundColor: health.status === "error" ? "#FEE2E2" : health.status === "healthy" ? GREEN_LT : "#F3F4F6"
              }]}>
                <Feather name="refresh-cw" size={18} color={health.status === "error" ? "#DC2626" : health.status === "healthy" ? GREEN : MUTED} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.syncTitle}>Airbnb & Booking.com</Text>
                <Text style={s.syncSub}>Keep calendars in sync automatically</Text>
              </View>
              <View style={[s.syncStatusBadge, {
                backgroundColor: health.status === "error" ? "#FEE2E2" : health.status === "healthy" ? GREEN_LT : "#F3F4F6"
              }]}>
                {health.status === "healthy" && <View style={s.syncDot} />}
                <Text style={[s.syncStatusText, { color: health.color }]}>{health.label}</Text>
              </View>
            </View>
            <View style={s.syncStatsRow}>
              <View style={s.syncStat}>
                <Text style={s.syncStatVal}>{connectedFeedsCount}</Text>
                <Text style={s.syncStatLabel}>Channels</Text>
              </View>
              <View style={s.syncStatDivider} />
              <View style={s.syncStat}>
                <Text style={s.syncStatVal}>{getLastSyncTime()}</Text>
                <Text style={s.syncStatLabel}>Last Sync</Text>
              </View>
              <View style={s.syncStatDivider} />
              <View style={s.syncStat}>
                <Text style={s.syncStatVal}>{blockedDatesData?.length ?? 0}</Text>
                <Text style={s.syncStatLabel}>Blocked Dates</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Recent Bookings ───────────────────────────────────────────── */}
        <View>
          <SectionLabel title="Recent Bookings" linkLabel="View All →" onLink={() => router.push("/(provider)/bookings" as any)} />
          <View style={s.card}>
            {!data?.recentBookings?.length ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                <Text style={s.emptyTitle}>No bookings yet</Text>
                <Text style={s.emptySub}>Your upcoming bookings will appear here</Text>
              </View>
            ) : data.recentBookings.map((b, i) => {
              const sc = statusColors(b.status);
              const dateStr = b.checkIn
                ? `${fmtDate(b.checkIn)} – ${b.checkOut ? fmtDate(b.checkOut) : "?"}`
                : b.pickupDatetime ? fmtDate(b.pickupDatetime) : "—";
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[s.bookingRow, i > 0 && s.bookingBorder]}
                  onPress={() => router.push(`/provider/booking/${b.id}` as any)}
                  activeOpacity={0.75}
                >
                  {/* Avatar */}
                  <View style={s.bookingAvatar}>
                    <Text style={s.bookingAvatarText}>{initials(b.guestName)}</Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.bookingGuest} numberOfLines={1}>{b.guestName}</Text>
                    <Text style={s.bookingListing} numberOfLines={1}>{b.listingTitle}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <Feather name="calendar" size={10} color={MUTED} />
                      <Text style={s.bookingDate}>{dateStr}</Text>
                    </View>
                  </View>

                  {/* Amount + status */}
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <Text style={s.bookingAmount}>{b.currency} {b.providerPayout.toLocaleString()}</Text>
                    <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[s.statusPillText, { color: sc.text }]}>{statusLabel(b.status)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Guest Reviews ─────────────────────────────────────────────── */}
        {reviewsData && (
          <View>
            <SectionLabel title="Guest Reviews" linkLabel="See All →" onLink={() => router.push("/(provider)/analytics" as any)} />
            <View style={s.card}>
              {reviewsData.averageRating !== null && reviewsData.totalReviews > 0 ? (
                <View style={s.ratingHero}>
                  <View style={s.ratingScoreWrap}>
                    <Text style={s.ratingBig}>{reviewsData.averageRating.toFixed(1)}</Text>
                    <Stars rating={reviewsData.averageRating} size={14} />
                    <Text style={s.ratingCount}>{reviewsData.totalReviews} review{reviewsData.totalReviews !== 1 ? "s" : ""}</Text>
                  </View>
                  {/* Rating bars */}
                  <View style={{ flex: 1, gap: 4 }}>
                    {[5,4,3,2,1].map(star => {
                      const cnt = reviewsData.reviews.filter(r => r.rating === star).length;
                      const pct = reviewsData.reviews.length > 0 ? (cnt / reviewsData.reviews.length) * 100 : star === 5 ? 70 : 10;
                      return (
                        <View key={star} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontSize: 10, color: MUTED, width: 14, textAlign: "right" }}>{star}</Text>
                          <View style={{ flex: 1, height: 5, backgroundColor: "#F3F4F6", borderRadius: 3 }}>
                            <View style={{ width: `${pct}%`, height: 5, backgroundColor: "#F59E0B", borderRadius: 3 }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {reviewsData.reviews.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>⭐</Text>
                  <Text style={s.emptyTitle}>No reviews yet</Text>
                  <Text style={s.emptySub}>Your first guest reviews will appear here</Text>
                </View>
              ) : reviewsData.reviews.slice(0, 2).map((r, i) => (
                <View key={r.id} style={[s.reviewRow, i > 0 && s.reviewBorder]}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={s.reviewGuest}>{r.guestName}</Text>
                    <Stars rating={r.rating} />
                  </View>
                  <Text style={s.reviewListing} numberOfLines={1}>{r.listingName}</Text>
                  <Text style={s.reviewBody} numberOfLines={2}>{r.body}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Header — white, clean
  header: {
    backgroundColor: CARD,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  logo: { width: 110, height: 36 },
  greeting: { fontSize: 12, color: MUTED, fontWeight: "500" },
  headerName: { fontSize: 17, fontWeight: "800", color: TEXT, marginTop: 1 },
  verBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  verBadgeText: { fontSize: 11, fontWeight: "700" },

  // Scroll
  scroll: { padding: 16, gap: 20 },

  // Section label
  sectionTitle: { fontSize: 15, fontWeight: "800", color: TEXT, letterSpacing: -0.2 },
  sectionLink: { fontSize: 13, fontWeight: "600", color: GREEN },

  // Earnings hero — white card with green accent
  earningsCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#00A86B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  earningsAccentBar: {
    height: 4,
    backgroundColor: GREEN,
  },
  earningsBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
  },
  earningsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  earningsValue: {
    fontSize: 34,
    fontWeight: "900",
    color: TEXT,
    letterSpacing: -1,
    marginBottom: 10,
  },
  momBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  momText: { fontSize: 11, fontWeight: "700" },
  earningsArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_LT,
    alignItems: "center",
    justifyContent: "center",
  },
  earningsDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 20 },
  earningsFooter: { flexDirection: "row", padding: 16, paddingTop: 14 },
  earningsFoot: { flex: 1, alignItems: "center" },
  earningsFootDivider: { width: 1, backgroundColor: BORDER },
  earningsFootLabel: { fontSize: 10, color: MUTED, fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  earningsFootValue: { fontSize: 16, fontWeight: "800", color: TEXT },

  // Quick Actions
  qaRow: { flexDirection: "row", gap: 10 },
  qaItem: { flex: 1, alignItems: "center", gap: 7 },
  qaIcon: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: CARD, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  qaLabel: { fontSize: 10, fontWeight: "600", color: MID, textAlign: "center" },

  // Stats row — 4 small cards
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: BORDER, alignItems: "center", gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: GREEN_LT,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  statValue: { fontSize: 20, fontWeight: "900", color: TEXT, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: MUTED, fontWeight: "500", textAlign: "center" },
  statBadge: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: GREEN_LT },
  statBadgeText: { fontSize: 9, fontWeight: "700", color: GREEN, textAlign: "center" },

  // Alert
  alertCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#FFFBEB", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  alertIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  alertSub: { fontSize: 11, color: "#B45309", marginTop: 2 },

  // Revenue chart
  chartCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  chartBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 100 },
  chartCol: { flex: 1, alignItems: "center" },
  chartVal: { fontSize: 8, color: MUTED, marginBottom: 3, textAlign: "center" },
  chartTrack: { height: 72, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  chartBar: { width: "55%", borderRadius: 5, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  chartX: { fontSize: 9, color: MUTED, marginTop: 6, fontWeight: "500" },

  // Channel sync
  syncCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  syncTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  syncIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  syncTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  syncSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  syncStatusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  syncStatusText: { fontSize: 11, fontWeight: "700" },
  syncStatsRow: { flexDirection: "row", paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER },
  syncStat: { flex: 1, alignItems: "center" },
  syncStatVal: { fontSize: 14, fontWeight: "800", color: TEXT, marginBottom: 3 },
  syncStatLabel: { fontSize: 9, color: MUTED, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  syncStatDivider: { width: 1, backgroundColor: BORDER },

  // Generic card
  card: {
    backgroundColor: CARD, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },

  // Bookings
  bookingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  bookingBorder: { borderTopWidth: 1, borderTopColor: BORDER },
  bookingAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: GREEN_LT, alignItems: "center", justifyContent: "center",
  },
  bookingAvatarText: { fontSize: 14, fontWeight: "800", color: GREEN },
  bookingGuest: { fontSize: 13, fontWeight: "700", color: TEXT },
  bookingListing: { fontSize: 11, color: MID, marginTop: 1 },
  bookingDate: { fontSize: 11, color: MUTED },
  bookingAmount: { fontSize: 13, fontWeight: "800", color: TEXT },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "700" },

  // Reviews
  ratingHero: { flexDirection: "row", alignItems: "center", gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 12 },
  ratingScoreWrap: { alignItems: "center", width: 70 },
  ratingBig: { fontSize: 40, fontWeight: "900", color: TEXT, letterSpacing: -2 },
  ratingCount: { fontSize: 10, color: MUTED, marginTop: 4, textAlign: "center" },
  reviewRow: { paddingVertical: 12 },
  reviewBorder: { borderTopWidth: 1, borderTopColor: BORDER },
  reviewGuest: { fontSize: 13, fontWeight: "700", color: TEXT },
  reviewListing: { fontSize: 11, color: MID, marginBottom: 4 },
  reviewBody: { fontSize: 13, color: MUTED, lineHeight: 19 },

  // Empty
  emptyBox: { alignItems: "center", paddingVertical: 28 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: MID },
  emptySub: { fontSize: 12, color: MUTED, marginTop: 4, textAlign: "center" },

  // Misc
  retryBtn: { backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
