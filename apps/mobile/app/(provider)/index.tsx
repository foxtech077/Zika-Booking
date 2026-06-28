import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { AppLayout } from "../../components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { Ionicons, Feather } from "@expo/vector-icons";
import { ListingImage } from "../../components/ListingImage";
import { K } from "../../constants/theme";

const { width: W } = Dimensions.get("window");
const CARD_HALF = (W - 48) / 2;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentBooking {
  id: string; reference: string; listingTitle: string; listingCategory: string;
  guestName: string; guestCount?: number;
  checkIn: string | null; checkOut: string | null;
  pickupDatetime: string | null; returnDatetime: string | null;
  totalAmount: number; providerPayout: number; currency: string; status: string;
  primaryPhotoUrl?: string | null;
}
interface MonthlyRevenue { month: string; revenue: number; bookings: number }
interface DashboardData {
  totalEarnings: number; thisMonthEarnings: number; activeListingsCount: number;
  pendingBookingsCount: number; completedBookingsCount: number; unreadMessages: number;
  pendingReviews: number; recentBookings: RecentBooking[]; monthlyRevenue: MonthlyRevenue[];
}
interface ReviewsData { averageRating: number | null; totalReviews: number }

interface ProviderListing {
  id: string;
  name?: string | null;
  title?: string | null;
  category: string;
  status: string;
  town?: string | null;
  country?: string | null;
  primaryPhotoUrl?: string | null;
  totalBookings?: number;
  averageRating?: number | null;
}

interface ProviderReview {
  id: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestName?: string;
  rating: number;
  comment?: string;
  review?: string;
  createdAt: string;
  reply?: string | null;
  listingTitle?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function momPct(cur: number, prev: number) {
  if (prev === 0) return { label: cur > 0 ? "+100.0%" : "0.0%", up: cur > 0 };
  const d = ((cur - prev) / prev) * 100;
  return { label: `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`, up: d >= 0 };
}


const LISTING_STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  active:         { label: "ACTIVE",          bg: "#f0fdf4", text: "#16a34a" },
  pending_review: { label: "PENDING REVIEW",  bg: "#fffbeb", text: "#d97706" },
  draft:          { label: "DRAFT",           bg: "#f3f4f6", text: "#6b7280" },
  inactive:       { label: "INACTIVE",        bg: "#fef2f2", text: "#dc2626" },
  approved:       { label: "APPROVED",        bg: "#eff6ff", text: "#2563eb" },
};

const BOOKING_STATUS_CFG: Record<string, { label: string; color: string }> = {
  confirmed:        { label: "CONFIRMED", color: "#16a34a" },
  active:           { label: "ACTIVE",    color: "#2563eb" },
  pending_payment:  { label: "PENDING",   color: "#d97706" },
  completed:        { label: "COMPLETED", color: "#6b7280" },
  cancelled_by_guest:    { label: "CANCELLED", color: "#dc2626" },
  cancelled_by_provider: { label: "CANCELLED", color: "#dc2626" },
  cancelled_by_system:   { label: "CANCELLED", color: "#dc2626" },
};

// ── SparkLine (Financial Overview chart) ──────────────────────────────────────

function SparkLine({ values, color = "#16a34a", chartWidth, chartHeight }: {
  values: number[]; color?: string; chartWidth: number; chartHeight: number;
}) {
  if (values.length < 2) return <View style={{ width: chartWidth, height: chartHeight }} />;
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;
  const pad   = 8;
  const step  = (chartWidth - pad * 2) / (values.length - 1);
  const h     = chartHeight - pad * 2;

  const pts = values.map((v, i) => ({
    x: pad + i * step,
    y: pad + h - ((v - minV) / range) * h,
  }));

  const segments: { x: number; y: number; w: number; angle: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    segments.push({
      x: a.x + dx / 2 - Math.sqrt(dx * dx + dy * dy) / 2,
      y: a.y + dy / 2 - 1.5,
      w: Math.sqrt(dx * dx + dy * dy),
      angle: Math.atan2(dy, dx) * (180 / Math.PI),
    });
  }

  return (
    <View style={{ width: chartWidth, height: chartHeight }}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: seg.x,
            top:  seg.y,
            width: seg.w,
            height: 3,
            backgroundColor: color,
            borderRadius: 2,
            transform: [{ rotate: `${seg.angle}deg` }],
          }}
        />
      ))}
      {pts.map((pt, i) => (
        <View
          key={`d${i}`}
          style={{
            position: "absolute",
            left: pt.x - 4,
            top:  pt.y - 4,
            width: 8, height: 8,
            borderRadius: 4,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: "#1a2a1a",
          }}
        />
      ))}
    </View>
  );
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={sh.link}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "800", color: "#0D1F0D", letterSpacing: -0.3 },
  link:  { fontSize: 13, color: K.colors.accent, fontWeight: "700" },
});

// ── Listing Card ──────────────────────────────────────────────────────────────

function ListingCard({ item }: { item: ProviderListing }) {
  const name   = item.title ?? item.name ?? "Untitled";
  const loc    = [item.town, item.country].filter(Boolean).join(", ");
  const status = LISTING_STATUS_CFG[item.status] ?? LISTING_STATUS_CFG.draft!;
  const rating = item.averageRating;

  return (
    <View style={lc.card}>
      <View style={lc.thumb}>
        {item.primaryPhotoUrl ? (
          <ListingImage uri={item.primaryPhotoUrl} style={lc.thumbImg} />
        ) : (
          <View style={[lc.thumbImg, lc.thumbFallback]}>
            <Ionicons name="business-outline" size={24} color="#b0b8b4" />
          </View>
        )}
      </View>
      <View style={lc.body}>
        <View style={lc.nameRow}>
          <Text style={lc.name} numberOfLines={1}>{name}</Text>
          {rating != null && (
            <View style={lc.ratingRow}>
              <Ionicons name="star" size={11} color="#f59e0b" />
              <Text style={lc.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        {loc ? <Text style={lc.loc}>{loc}{item.totalBookings ? ` · ${item.totalBookings} bookings` : ""}</Text> : null}
        <View style={lc.statusBadge}>
          <Text style={[lc.statusText, { color: status.text, backgroundColor: status.bg }]}>
            {status.label}
          </Text>
        </View>
        <View style={lc.actions}>
          {item.status === "active" ? (
            <>
              <TouchableOpacity
                style={lc.btnOutline}
                onPress={() => router.push(`/listings/${item.id}` as any)}
              >
                <Text style={lc.btnOutlineText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={lc.btnFill}
                onPress={() => router.push("/(provider)/analytics" as any)}
              >
                <Text style={lc.btnFillText}>Analytics</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={lc.btnWide}
              onPress={() => router.push(`/listings/${item.id}` as any)}
            >
              <Text style={lc.btnWideText}>Manage Availability</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const lc = StyleSheet.create({
  card:  { flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0EDE8" },
  thumb: { width: 80, height: 80, borderRadius: 12, overflow: "hidden", flexShrink: 0 },
  thumbImg: { width: "100%", height: "100%" },
  thumbFallback: { backgroundColor: "#F0EDE8", alignItems: "center", justifyContent: "center" },
  body:  { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  name:  { fontSize: 14, fontWeight: "700", color: "#0D1F0D", flex: 1, marginRight: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingText: { fontSize: 11, fontWeight: "700", color: "#f59e0b" },
  loc:   { fontSize: 11, color: "#7a8c82", marginBottom: 8 },
  statusBadge: { alignSelf: "flex-start", marginBottom: 10 },
  statusText: { fontSize: 10, fontWeight: "800", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden", letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 8 },
  btnOutline: { borderWidth: 1.5, borderColor: K.colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  btnOutlineText: { fontSize: 12, fontWeight: "700", color: K.colors.accent },
  btnFill: { backgroundColor: K.colors.darkGreen, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  btnFillText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  btnWide: { flex: 1, backgroundColor: K.colors.accent + "18", borderRadius: 8, paddingVertical: 7, alignItems: "center", borderWidth: 1, borderColor: K.colors.accent + "40" },
  btnWideText: { fontSize: 12, fontWeight: "700", color: K.colors.accent },
});

// ── Booking Row ───────────────────────────────────────────────────────────────

function BookingRow({ booking, isLast }: { booking: RecentBooking; isLast: boolean }) {
  const st = BOOKING_STATUS_CFG[booking.status] ?? { label: "UNKNOWN", color: "#9ca3af" };
  const firstName = booking.guestName?.split(" ")[0] ?? "Guest";
  const initial   = firstName[0]?.toUpperCase() ?? "G";
  const dateStr   = booking.checkIn
    ? new Date(booking.checkIn).toLocaleDateString("en", { month: "short", day: "numeric" })
    : "";

  return (
    <TouchableOpacity
      style={[brow.row, !isLast && brow.border]}
      onPress={() => router.push(`/provider/booking/${booking.id}` as any)}
      activeOpacity={0.75}
    >
      <View style={brow.avatar}>
        <Text style={brow.avatarText}>{initial}</Text>
      </View>
      <View style={brow.info}>
        <Text style={brow.name}>{booking.guestName ?? "Guest"}</Text>
        <Text style={brow.sub}>
          {dateStr ? `${dateStr} · ` : ""}{booking.listingTitle}
        </Text>
      </View>
      <View style={brow.right}>
        <Text style={brow.amount}>${fmtMoney(booking.providerPayout)}</Text>
        <Text style={[brow.status, { color: st.color }]}>{st.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const brow = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  border:     { borderBottomWidth: 1, borderBottomColor: "#F0EDE8" },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e8f5e9", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "800", color: K.colors.darkGreen },
  info:       { flex: 1 },
  name:       { fontSize: 14, fontWeight: "700", color: "#0D1F0D", marginBottom: 3 },
  sub:        { fontSize: 12, color: "#7a8c82" },
  right:      { alignItems: "flex-end" },
  amount:     { fontSize: 15, fontWeight: "800", color: "#0D1F0D", marginBottom: 4 },
  status:     { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
});

// ── Quick Action Item ──────────────────────────────────────────────────────────

const ITEM_W = (W - 32 - 32 - 24) / 3;

function QAItem({ icon, label, path }: { icon: string; label: string; path: string }) {
  return (
    <TouchableOpacity
      style={[qai.wrap, { width: ITEM_W }]}
      onPress={() => router.push(path as any)}
      activeOpacity={0.75}
    >
      <View style={qai.circle}>
        <Ionicons name={icon as any} size={22} color={K.colors.darkGreen} />
      </View>
      <Text style={qai.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const qai = StyleSheet.create({
  wrap:   { alignItems: "center", gap: 8 },
  circle: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#F0F7F2", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D8EDE0" },
  label:  { fontSize: 11, fontWeight: "600", color: "#4a6150", textAlign: "center" },
});

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: ProviderReview }) {
  const combined = `${review.guestFirstName ?? ""} ${review.guestLastName ?? ""}`.trim();
  const name    = review.guestName ?? (combined || "Guest");
  const initial = name[0]?.toUpperCase() ?? "G";
  const text    = review.comment ?? review.review ?? "";
  return (
    <View style={rv.card}>
      <View style={rv.header}>
        <View style={rv.avatar}>
          <Text style={rv.avatarText}>{initial}</Text>
        </View>
        <View style={rv.headerInfo}>
          <Text style={rv.name}>{name}</Text>
          <View style={rv.stars}>
            {[1,2,3,4,5].map(i => (
              <Ionicons key={i} name={i <= review.rating ? "star" : "star-outline"} size={12} color="#f59e0b" />
            ))}
          </View>
        </View>
        <TouchableOpacity style={rv.replyBtn} onPress={() => router.push("/(provider)/reviews" as any)}>
          <Text style={rv.replyText}>REPLY</Text>
        </TouchableOpacity>
      </View>
      {text ? <Text style={rv.comment} numberOfLines={3}>{`"${text}"`}</Text> : null}
    </View>
  );
}

const rv = StyleSheet.create({
  card:       { backgroundColor: "#F8FBF9", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E5EDE8" },
  header:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: K.colors.darkGreen, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  headerInfo: { flex: 1 },
  name:       { fontSize: 14, fontWeight: "700", color: "#0D1F0D", marginBottom: 3 },
  stars:      { flexDirection: "row", gap: 2 },
  replyBtn:   { backgroundColor: K.colors.darkGreen, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  replyText:  { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  comment:    { fontSize: 13, color: "#4a6150", lineHeight: 19, fontStyle: "italic" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

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
      const res = await listingApi.get<{ data: ReviewsData }>("/provider/reviews", { params: { limit: 1 } });
      return res.data.data;
    },
    enabled: !!user,
  });

  const { data: listingsRaw } = useQuery<ProviderListing[]>({
    queryKey: ["providerDashListings"],
    queryFn: async () => {
      const res = await listingApi.get("/provider/listings", { params: { limit: 3 } });
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : (d?.listings ?? []);
    },
    enabled: !!user,
  });

  const { data: reviewsList } = useQuery<ProviderReview[]>({
    queryKey: ["providerDashReviews"],
    queryFn: async () => {
      const res = await listingApi.get("/provider/reviews", { params: { limit: 2 } });
      const d = res.data?.data ?? res.data;
      return Array.isArray(d) ? d : (d?.reviews ?? []);
    },
    enabled: !!user,
  });

  const recentBookings = Array.isArray(data?.recentBookings) ? data.recentBookings.slice(0, 3) : [];
  const listings       = Array.isArray(listingsRaw) ? listingsRaw.slice(0, 3) : [];
  const reviews        = Array.isArray(reviewsList) ? reviewsList.slice(0, 2) : [];
  const monthlyRevenue = Array.isArray(data?.monthlyRevenue) ? data.monthlyRevenue : [];
  const revenueValues  = monthlyRevenue.slice(-6).map(m => m.revenue);
  const lastMonthRev   = monthlyRevenue.length >= 2 ? (monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0) : 0;
  const mom            = data && monthlyRevenue.length >= 2 ? momPct(data.thisMonthEarnings, lastMonthRev) : null;
  const occupancyPct   = data
    ? Math.min(99, Math.round((data.pendingBookingsCount / Math.max(data.activeListingsCount, 1)) * 100))
    : 0;
  const avgRating = reviewsData?.averageRating ?? null;

  if (isLoading) {
    return (
      <AppLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="cloud-offline-outline" size={52} color="#c8d4cc" />
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0D1F0D", marginTop: 14, marginBottom: 18 }}>
            Could not load dashboard
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: K.colors.darkGreen, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }}
            onPress={() => refetch()}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />}
      >
        {/* ── Metric Cards ── */}
        <View style={s.metricsRow}>
          {/* Total Revenue */}
          <View style={[s.metricCard, { width: CARD_HALF }]}>
            <Text style={s.metricLabel}>Total Revenue</Text>
            <Text style={s.metricValue}>${fmtMoney(data?.totalEarnings ?? 0)}</Text>
            {mom && (
              <View style={s.metricTrend}>
                <Ionicons name={mom.up ? "trending-up" : "trending-down"} size={12} color={mom.up ? "#16a34a" : "#dc2626"} />
                <Text style={[s.metricTrendText, { color: mom.up ? "#16a34a" : "#dc2626" }]}>{mom.label}</Text>
              </View>
            )}
          </View>

          {/* Active Listings */}
          <View style={[s.metricCard, { width: CARD_HALF }]}>
            <Text style={s.metricLabel}>Active Listings</Text>
            <Text style={s.metricValue}>{data?.activeListingsCount ?? 0}</Text>
            <Text style={s.metricSub}>
              {(data?.activeListingsCount ?? 0) > 0 ? "Full capacity" : "No active listings"}
            </Text>
          </View>
        </View>

        {/* ── Revenue This Month (dark green card) ── */}
        <View style={s.revenueCard}>
          {/* Wave decoration */}
          <View style={s.waveDeco} pointerEvents="none">
            <View style={s.wave1} />
            <View style={s.wave2} />
          </View>

          {/* Top row */}
          <View style={s.revenueTopRow}>
            <Text style={s.revenueLabelSmall}>Revenue This Month</Text>
            <TouchableOpacity
              style={s.revenueChartBtn}
              onPress={() => router.push("/(provider)/analytics" as any)}
            >
              <Ionicons name="bar-chart" size={18} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <Text style={s.revenueAmount}>${fmtMoney(data?.thisMonthEarnings ?? 0)}</Text>

          {/* Bottom stats */}
          <View style={s.revenueBottomRow}>
            <View style={s.revenueStat}>
              <View style={s.revenueStatIconWrap}>
                <Ionicons name="pie-chart-outline" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={s.revenueStatPct}>{occupancyPct}%</Text>
              </View>
              <Text style={s.revenueStatLabel}>Occupancy{"\n"}Rate</Text>
            </View>

            <View style={s.revenueStatDivider} />

            <View style={s.revenueStat}>
              <View style={s.revenueStatIconWrap}>
                <Ionicons name="close-circle-outline" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={s.revenueStatPct}>
                  {data && data.pendingReviews != null ? `${data.pendingReviews}` : "0"}
                </Text>
              </View>
              <Text style={s.revenueStatLabel}>Pending{"\n"}Reviews</Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={s.sectionCard}>
          <Text style={s.sectionCardTitle}>Quick Actions</Text>
          <View style={s.qaGrid}>
            <QAItem icon="add-circle-outline"   label="Add Listing"  path="/listings/new"           />
            <QAItem icon="calendar-outline"     label="Calendar"     path="/(provider)/channels"     />
            <QAItem icon="cash-outline"         label="Earnings"     path="/(provider)/analytics"    />
            <QAItem icon="star-outline"         label="Reviews"      path="/(provider)/reviews"      />
            <QAItem icon="sync-circle-outline"  label="Sync"         path="/(provider)/channels"     />
            <QAItem icon="settings-outline"     label="Settings"     path="/(provider)/profile"      />
          </View>
        </View>

        {/* ── My Listings ── */}
        {listings.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="My Listings"
              onSeeAll={() => router.push("/(provider)/listings" as any)}
            />
            <View style={s.whiteCard}>
              {listings.map((item, i) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </View>
          </View>
        )}

        {/* ── Recent Bookings ── */}
        <View style={s.section}>
          <SectionHeader
            title="Recent Bookings"
            onSeeAll={() => router.push("/(provider)/bookings" as any)}
          />
          <View style={s.whiteCard}>
            {recentBookings.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="calendar-outline" size={32} color="#c8d4cc" />
                <Text style={s.emptyTitle}>No recent bookings</Text>
                <Text style={s.emptySub}>Your confirmed reservations will appear here.</Text>
              </View>
            ) : (
              recentBookings.map((b, i) => (
                <BookingRow key={b.id} booking={b} isLast={i === recentBookings.length - 1} />
              ))
            )}
          </View>
        </View>

        {/* ── Financial Overview (dark card) ── */}
        <View style={s.finCard}>
          <Text style={s.finLabel}>FINANCIAL OVERVIEW</Text>
          <View style={s.finRow}>
            <View style={s.finItem}>
              <Text style={s.finItemLabel}>Current Balance</Text>
              <Text style={s.finBalance}>${fmtMoney(data?.thisMonthEarnings ?? 0)}</Text>
            </View>
            <View style={s.finItem}>
              <Text style={s.finItemLabel}>Pending Payout</Text>
              <Text style={s.finPending}>
                ${fmtMoney((data?.pendingBookingsCount ?? 0) > 0 ? (data?.thisMonthEarnings ?? 0) * 0.2 : 0)}
              </Text>
            </View>
          </View>

          {/* Mini Line Chart */}
          <View style={s.finChartWrap}>
            {revenueValues.length > 1 ? (
              <SparkLine
                values={revenueValues}
                color="#16a34a"
                chartWidth={W - 64}
                chartHeight={70}
              />
            ) : (
              <View style={{ height: 70 }} />
            )}
          </View>

          <View style={s.finBottom}>
            <View>
              <Text style={s.finLifetimeLabel}>Lifetime Earnings</Text>
              <Text style={s.finLifetime}>${fmtMoney(data?.totalEarnings ?? 0)}</Text>
            </View>
            <TouchableOpacity
              style={s.withdrawBtn}
              onPress={() => router.push("/(provider)/payouts" as any)}
            >
              <Text style={s.withdrawText}>Withdraw Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Calendar & Channel Sync ── */}
        <View style={s.section}>
          <SectionHeader
            title="Calendar & Channel Sync"
            onSeeAll={() => router.push("/(provider)/channels" as any)}
          />
          <View style={s.whiteCard}>
            {[
              { icon: "home",        color: "#FF5A5F", name: "Airbnb",       sub: "External calendar sync" },
              { icon: "bed-outline", color: "#003580", name: "Booking.com",  sub: "External calendar sync" },
            ].map((ch, i, arr) => (
              <TouchableOpacity
                key={ch.name}
                style={[s.channelRow, i < arr.length - 1 && s.channelBorder]}
                onPress={() => router.push("/(provider)/channels" as any)}
                activeOpacity={0.75}
              >
                <View style={[s.channelIcon, { backgroundColor: ch.color + "18" }]}>
                  <Ionicons name={ch.icon as any} size={20} color={ch.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.channelName}>{ch.name}</Text>
                  <Text style={s.channelSub}>{ch.sub}</Text>
                </View>
                <TouchableOpacity
                  style={s.channelManageBtn}
                  onPress={() => router.push("/(provider)/channels" as any)}
                >
                  <Text style={s.channelManageText}>Manage</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Recent Reviews ── */}
        {(reviews.length > 0 || avgRating != null) && (
          <View style={s.section}>
            <SectionHeader
              title="Recent Reviews"
              onSeeAll={() => router.push("/(provider)/reviews" as any)}
            />
            {reviews.length > 0 ? (
              <View style={{ gap: 10 }}>
                {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
              </View>
            ) : (
              <View style={s.whiteCard}>
                <View style={s.emptyBox}>
                  <Ionicons name="star-outline" size={32} color="#c8d4cc" />
                  <Text style={s.emptyTitle}>No reviews yet</Text>
                  <Text style={s.emptySub}>Guest reviews will appear here.</Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </AppLayout>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Scroll
  scroll: { backgroundColor: "#F5F4F1", padding: 16, gap: 16 },

  // Metric cards
  metricsRow:    { flexDirection: "row", gap: 14 },
  metricCard:    { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EDE9", ...K.shadow.sm },
  metricLabel:   { fontSize: 11, color: "#7a8c82", fontWeight: "600", marginBottom: 8 },
  metricValue:   { fontSize: 22, fontWeight: "900", color: "#0D1F0D", letterSpacing: -0.5, marginBottom: 6 },
  metricTrend:   { flexDirection: "row", alignItems: "center", gap: 4 },
  metricTrendText:{ fontSize: 12, fontWeight: "700" },
  metricSub:     { fontSize: 11, color: "#7a8c82", fontWeight: "500" },

  // Revenue card (dark green)
  revenueCard: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    ...K.shadow.brand,
  },
  waveDeco:  { position: "absolute", left: 0, right: 0, top: 40, bottom: 0, overflow: "hidden" },
  wave1: {
    position: "absolute",
    width: W * 1.3,
    height: W * 1.0,
    borderRadius: W * 0.65,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    left: -W * 0.2,
    top: 10,
  },
  wave2: {
    position: "absolute",
    width: W * 1.1,
    height: W * 0.8,
    borderRadius: W * 0.55,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    left: W * 0.05,
    top: 50,
  },
  revenueTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  revenueLabelSmall: { fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
  revenueChartBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center", justifyContent: "center",
  },
  revenueAmount: { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: -1, marginBottom: 24 },
  revenueBottomRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  revenueStat:  { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  revenueStatIconWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  revenueStatPct: { fontSize: 20, fontWeight: "900", color: "#fff" },
  revenueStatLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "500", lineHeight: 15 },
  revenueStatDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.2)" },

  // Quick actions card
  sectionCard:      { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EDE9", ...K.shadow.sm },
  sectionCardTitle: { fontSize: 15, fontWeight: "800", color: "#0D1F0D", marginBottom: 16, letterSpacing: -0.2 },
  qaGrid:           { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "space-between" },

  // Generic sections
  section:  {},
  whiteCard:{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EDE9", ...K.shadow.sm },

  // Empty states
  emptyBox:  { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyTitle:{ fontSize: 14, fontWeight: "700", color: "#2e4035" },
  emptySub:  { fontSize: 12, color: "#7a8c82", textAlign: "center", lineHeight: 17 },

  // Financial Overview
  finCard: {
    backgroundColor: "#0e1f0e",
    borderRadius: 20,
    padding: 20,
    ...K.shadow.md,
    overflow: "hidden",
  },
  finLabel:      { fontSize: 10, fontWeight: "800", color: K.colors.accent, letterSpacing: 1.5, marginBottom: 14 },
  finRow:        { flexDirection: "row", gap: 20, marginBottom: 4 },
  finItem:       { flex: 1 },
  finItemLabel:  { fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: "600", marginBottom: 6 },
  finBalance:    { fontSize: 24, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  finPending:    { fontSize: 24, fontWeight: "900", color: "rgba(255,255,255,0.45)", letterSpacing: -0.5 },
  finChartWrap:  { marginVertical: 12, marginHorizontal: -4 },
  finBottom:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  finLifetimeLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 },
  finLifetime:   { fontSize: 18, fontWeight: "800", color: "#fff" },
  withdrawBtn:   { backgroundColor: K.colors.accent, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  withdrawText:  { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Channel rows
  channelRow:   { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  channelBorder:{ borderBottomWidth: 1, borderBottomColor: "#F0EDE8" },
  channelIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  channelName:  { fontSize: 14, fontWeight: "700", color: "#0D1F0D", marginBottom: 2 },
  channelSub:   { fontSize: 11, color: "#7a8c82" },
  channelManageBtn: { backgroundColor: "#F0F5F1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#D8EDE0" },
  channelManageText: { fontSize: 12, fontWeight: "700", color: K.colors.darkGreen },
});
