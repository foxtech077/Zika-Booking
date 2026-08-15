import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { ListingImage } from "../../components/ListingImage";
import { K } from "../../constants/theme";
import { useAuthStore } from "../../store/auth";
import { SignInRequired } from "../../components/SignInRequired";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { useReadableWidth } from "../../lib/responsive";

const { width: W } = Dimensions.get("window");
// 56% of a phone's width is a pleasant hero; 56% of a tablet's is a wall of
// photo. The list is width-capped on tablets, so cap the photo to match.
const PHOTO_H = Math.round(Math.min(W, 720) * 0.56);

// ── Types ─────────────────────────────────────────────────────────────────────

// Booking record status values (what the API returns inside booking objects)
type BookingStatus = string; // e.g. "confirmed" | "active" | "completed" | "cancelled_by_guest" | ...

// The API's ?status= filter only accepts these 3 named view-filters (not booking record statuses)
type ApiStatusFilter = "upcoming" | "completed" | "cancelled";

// UI chips — "all" shows upcoming split by dates; others map 1-to-1 to API filters
type ChipKey = "all" | "upcoming" | "completed" | "cancelled";

function chipToApiStatus(chip: Exclude<ChipKey, "all">): ApiStatusFilter {
  return chip as ApiStatusFilter;
}

interface BookingSummary {
  id: string;
  reference: string;
  status: BookingStatus;
  listingType: string;
  listingTitle: string;
  listingPrimaryPhotoUrl: string | null;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  confirmedAt?: string;
  listingId?: string;
  listingTown?: string;
  listingCountry?: string;
}

interface BookingsResponse {
  total: number;
  nextCursor: number | null;
  bookings: BookingSummary[];
}

type ListItem =
  | { _type: "section_header"; title: string; liveNow?: boolean }
  | { _type: "active_card"; booking: BookingSummary }
  | { _type: "upcoming_card"; booking: BookingSummary }
  | { _type: "compact_card"; booking: BookingSummary }
  | { _type: "empty"; chipKey: ChipKey }
  | { _type: "shimmer"; key: string };

// ── Photo resolution via /listings/{id}/public ────────────────────────────────

// Extract listing UUID from an S3 photo URL like:
// https://zika-storage.s3.af-south-1.amazonaws.com/listings/{id}/photos/...
function extractListingId(b: BookingSummary): string | null {
  if (b.listingId) return b.listingId;
  const url = b.listingPrimaryPhotoUrl;
  if (!url) return null;
  const m = url.match(/\/listings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i);
  return m?.[1] ?? null;
}

// Finds or creates the conversation for this booking's listing (mirrors the
// same POST /conversations flow used from the listing detail page's "Message
// Host" button) and opens it — used by the "Message Host" button below, which
// previously just linked to the booking detail screen instead of messaging.
async function goToMessageHost(booking: BookingSummary, router: ReturnType<typeof useRouter>) {
  const listingId = extractListingId(booking);
  if (!listingId) {
    Alert.alert("Unable to Open Chat", "We couldn't find the listing for this booking.");
    return;
  }
  try {
    const res = await listingApi.post<{ data: { conversationId: string } }>("/conversations", {
      listingId,
      bookingId: booking.id,
    });
    router.push(`/conversation/${res.data.data.conversationId}` as any);
  } catch (err: any) {
    const message = err?.response?.data?.error?.message ?? "Could not open the conversation. Please try again.";
    Alert.alert("Error", message);
  }
}

// Fetch the first photo cdnUrl from the public listing endpoint.
// Called inside each card — React Query caches per listingId so no duplicate requests.
function useListingPhoto(booking: BookingSummary): string | null {
  const listingId = extractListingId(booking);
  const { data } = useQuery<string | null>({
    queryKey: ["listing-photo", listingId ?? ""],
    queryFn: async () => {
      const res = await listingApi.get<{
        data: { photos: { cdnUrl: string; position: number }[] };
      }>(`/listings/${listingId}/public`);
      const sorted = [...(res.data.data.photos ?? [])].sort((a, b) => a.position - b.position);
      return sorted[0]?.cdnUrl ?? null;
    },
    enabled: !!listingId,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  return data ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function daysUntil(iso?: string): number {
  if (!iso) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}
function remainingNights(checkOut?: string): number {
  if (!checkOut) return 0;
  return Math.max(0, daysUntil(checkOut));
}
function nightsLabel(n: number, type: string): string {
  return type === "car" ? `${n} day${n !== 1 ? "s" : ""}` : `${n} night${n !== 1 ? "s" : ""}`;
}
function statusCfg(status: BookingStatus) {
  switch (status) {
    case "confirmed": return { label: "Confirmed", ...K.colors.confirmed };
    case "pending_payment": return { label: "Pending", ...K.colors.pending };
    case "completed": return { label: "Completed", ...K.colors.completed };
    case "refunded": return { label: "Refunded", bg: "#f0fdf4", text: "#16a34a", dot: "#16a34a", stripe: "#16a34a" };
    default: return { label: "Cancelled", ...K.colors.cancelled };
  }
}

// Check if a booking's dates straddle today (guest is currently staying / car is active)
function isCurrentlyStaying(b: BookingSummary): boolean {
  const now = Date.now();
  const startIso = b.checkIn ?? b.pickupDatetime;
  const endIso = b.checkOut ?? b.returnDatetime;
  if (!startIso || !endIso) return false;
  return new Date(startIso).getTime() <= now && new Date(endIso).getTime() >= now;
}
function locationLabel(b: BookingSummary): string {
  if (b.listingTown && b.listingCountry) return `${b.listingTown}, ${b.listingCountry}`;
  if (b.listingTown) return b.listingTown;
  return "";
}
function typeLabel(type: string): string {
  if (type === "hotel") return "Hotel";
  if (type === "apartment") return "Apartment";
  if (type === "car") return "Car";
  return type.charAt(0).toUpperCase() + type.slice(1);
}
function typeIcon(type: string): string {
  if (type === "car") return "car-outline";
  if (type === "apartment") return "home-outline";
  return "business-outline";
}

// ── Shimmer ───────────────────────────────────────────────────────────────────

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

function TripSkeleton() {
  const opacity = useShimmer();
  return (
    <Animated.View style={[sk.card, { opacity }]}>
      <View style={sk.photo} />
      <View style={sk.body}>
        <View style={sk.line1} />
        <View style={sk.line2} />
        <View style={sk.line3} />
        <View style={sk.btnRow}>
          <View style={sk.btn} />
          <View style={sk.btn} />
        </View>
      </View>
    </Animated.View>
  );
}

// ── Stats Banner ──────────────────────────────────────────────────────────────

function StatsCard({ upcoming, completed, cancelled }: { upcoming: number; completed: number; cancelled: number }) {
  return (
    <View style={st.card}>
      <View style={st.col}>
        <Text style={st.num}>{upcoming}</Text>
        <Text style={st.label}>UPCOMING</Text>
      </View>
      <View style={st.divider} />
      <View style={st.col}>
        <Text style={st.num}>{completed}</Text>
        <Text style={st.label}>COMPLETED</Text>
      </View>
      <View style={st.divider} />
      <View style={st.col}>
        <Text style={st.num}>{cancelled}</Text>
        <Text style={st.label}>CANCELLED</Text>
      </View>
    </View>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, liveNow }: { title: string; liveNow?: boolean }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {liveNow && (
        <View style={sh.liveWrap}>
          <View style={sh.liveDot} />
          <Text style={sh.liveText}>Live Now</Text>
        </View>
      )}
    </View>
  );
}

// ── Active Stay Card ──────────────────────────────────────────────────────────

const ActiveStayCard = memo(function ActiveStayCard({ booking }: { booking: BookingSummary }) {
  const router = useRouter();
  const photoUrl = useListingPhoto(booking);
  const remaining = remainingNights(booking.checkOut);
  const loc = locationLabel(booking);
  const badge = loc ? loc.split(",")[0].toUpperCase() : typeLabel(booking.listingType).toUpperCase();

  return (
    <View style={ac.card}>
      {/* Photo */}
      <View style={ac.photoWrap}>
        <ListingImage uri={photoUrl} style={StyleSheet.absoluteFill} />
        <View style={ac.badge}>
          <Text style={ac.badgeText}>{badge}</Text>
        </View>
      </View>

      <View style={ac.body}>
        <Text style={ac.title} numberOfLines={1}>{booking.listingTitle}</Text>
        <Text style={ac.ref}>{booking.reference}</Text>

        {/* Stat chips */}
        <View style={ac.statsRow}>
          <View style={ac.statBox}>
            <Text style={ac.statLabel}>REMAINING</Text>
            <Text style={ac.statValue}>{remaining} Night{remaining !== 1 ? "s" : ""}</Text>
          </View>
          <View style={ac.statDivider} />
          <View style={ac.statBox}>
            <Text style={ac.statLabel}>CHECK OUT</Text>
            <Text style={ac.statValue}>{fmtShort(booking.checkOut)}</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={ac.extendBtn}
          activeOpacity={0.8}
          onPress={() => Alert.alert(
            "Extend Stay",
            "To extend your stay, please view your booking and contact the host.",
            [
              { text: "View Booking", onPress: () => router.push(`/booking/${booking.id}` as any) },
              { text: "Cancel", style: "cancel" },
            ]
          )}
        >
          <Ionicons name="add-circle-outline" size={16} color={K.colors.accent} />
          <Text style={ac.extendBtnText}>Extend Stay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ── Upcoming Trip Card ────────────────────────────────────────────────────────

const UpcomingCard = memo(function UpcomingCard({ booking }: { booking: BookingSummary }) {
  const router = useRouter();
  const photoUrl = useListingPhoto(booking);
  const cfg = statusCfg(booking.status);
  const [isMessaging, setIsMessaging] = useState(false);
  const days = daysUntil(booking.checkIn);
  const loc = locationLabel(booking);
  const checkDate = booking.checkIn ? fmtDate(booking.checkIn) : booking.pickupDatetime ? fmtDate(booking.pickupDatetime) : "";
  const checkoutDate = booking.checkOut ?? booking.returnDatetime;
  const confirmedDate = booking.confirmedAt ? fmtShort(booking.confirmedAt) : booking.createdAt ? fmtShort(booking.createdAt) : "";

  return (
    <View style={uc.card}>
      {/* Hero photo */}
      <View style={uc.photoWrap}>
        <ListingImage uri={photoUrl} style={StyleSheet.absoluteFill} />
        {/* Overlay gradient effect */}
        <View style={uc.photoOverlay} />

        {/* Status + days badges */}
        <View style={uc.photoTopRow}>
          <View style={[uc.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[uc.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
          {days > 0 && (
            <View style={uc.daysBadge}>
              <Text style={uc.daysBadgeText}>Starts in {days} day{days !== 1 ? "s" : ""}</Text>
            </View>
          )}
          {days === 0 && <View style={uc.daysBadge}><Text style={uc.daysBadgeText}>Today</Text></View>}
        </View>

        {/* Favorite placeholder */}
        <TouchableOpacity
          style={uc.heartBtn}
          activeOpacity={0.8}
          onPress={() => router.push(`/booking/${booking.id}` as any)}
        >
          <Ionicons name="heart-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={uc.body}>
        {loc ? (
          <View style={uc.locationRow}>
            <Ionicons name="location-sharp" size={12} color={K.colors.textMuted} />
            <Text style={uc.locationText}>{loc}</Text>
          </View>
        ) : null}

        <Text style={uc.title} numberOfLines={2}>{booking.listingTitle}</Text>
        <Text style={uc.bookingId}>Booking ID: {booking.reference}</Text>

        {/* Check-in / Duration row */}
        <View style={uc.infoRow}>
          <View style={uc.infoCol}>
            <Text style={uc.infoLabel}>CHECK-IN</Text>
            <Text style={uc.infoValue}>{checkDate}</Text>
          </View>
          <View style={uc.infoColDivider} />
          <View style={uc.infoCol}>
            <Text style={uc.infoLabel}>DURATION</Text>
            <Text style={uc.infoValue}>{nightsLabel(booking.nightsOrDays, booking.listingType)}</Text>
            {checkoutDate && <Text style={uc.infoSub}>Until {fmtShort(checkoutDate)}</Text>}
          </View>
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={uc.primaryBtn}
          activeOpacity={0.85}
          onPress={() => router.push(`/booking/${booking.id}` as any)}
        >
          <Text style={uc.primaryBtnText}>View Booking</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={uc.secondaryBtn}
          activeOpacity={0.8}
          disabled={isMessaging}
          onPress={async () => {
            if (isMessaging) return;
            setIsMessaging(true);
            await goToMessageHost(booking, router);
            setIsMessaging(false);
          }}
        >
          <Text style={uc.secondaryBtnText}>{isMessaging ? "Opening…" : "Message Host"}</Text>
        </TouchableOpacity>

        {/* Payment status row */}
        <TouchableOpacity
          style={uc.paymentRow}
          activeOpacity={0.75}
          onPress={() => router.push(`/booking/${booking.id}` as any)}
        >
          <View style={uc.paymentIconWrap}>
            <Ionicons name="checkmark-circle" size={20} color={K.colors.accent} />
          </View>
          <View style={uc.paymentText}>
            <Text style={uc.paymentTitle}>Payment Received</Text>
            {confirmedDate ? <Text style={uc.paymentSub}>Confirmed on {confirmedDate}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={K.colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ── Compact Card (Completed / Cancelled) ──────────────────────────────────────

const CompactCard = memo(function CompactCard({ booking }: { booking: BookingSummary }) {
  const router = useRouter();
  const photoUrl = useListingPhoto(booking);
  const cfg = statusCfg(booking.status);
  const dateRange = booking.checkIn && booking.checkOut
    ? `${fmtShort(booking.checkIn)} – ${fmtShort(booking.checkOut)}`
    : booking.pickupDatetime && booking.returnDatetime
      ? `${fmtShort(booking.pickupDatetime)} – ${fmtShort(booking.returnDatetime)}`
      : "";

  return (
    <TouchableOpacity
      style={cc.card}
      onPress={() => router.push(`/booking/${booking.id}` as any)}
      activeOpacity={0.8}
    >
      <View style={[cc.stripe, { backgroundColor: cfg.stripe }]} />

      {/* Thumbnail */}
      <View style={cc.thumb}>
        {photoUrl ? (
          <ListingImage uri={photoUrl} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={cc.thumbFallback}>
            <Ionicons name={typeIcon(booking.listingType) as any} size={22} color={K.colors.textMuted} />
          </View>
        )}
        <View style={[cc.typeTag]}>
          <Text style={cc.typeTagText}>{typeLabel(booking.listingType)}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={cc.content}>
        <View style={cc.topRow}>
          <Text style={cc.title} numberOfLines={1}>{booking.listingTitle}</Text>
          <View style={[cc.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[cc.statusText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={cc.ref}>{booking.reference}</Text>
        {dateRange ? <Text style={cc.dates}>{dateRange}</Text> : null}
        <View style={cc.footer}>
          <Text style={cc.amount}>{booking.currency} {booking.totalAmount.toLocaleString()}</Text>
          <Text style={cc.nights}>{nightsLabel(booking.nightsOrDays, booking.listingType)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyTripsState({ chipKey }: { chipKey: ChipKey }) {
  const router = useRouter();
  const cfg: Record<ChipKey, { icon: string; title: string; sub: string }> = {
    all: { icon: "airplane-outline", title: "No trips yet", sub: "Your bookings will appear here once you make your first reservation." },
    upcoming: { icon: "calendar-outline", title: "No upcoming trips", sub: "Book a stay or car rental to see it here." },
    completed: { icon: "checkmark-circle-outline", title: "No completed trips", sub: "Your past journeys will appear here." },
    cancelled: { icon: "close-circle-outline", title: "No cancelled bookings", sub: "Cancelled bookings would appear here." },
  };
  const c = cfg[chipKey];

  return (
    <View style={em.wrap}>
      <View style={em.iconWrap}>
        <Ionicons name={c.icon as any} size={44} color={K.colors.textMuted} />
      </View>
      <Text style={em.title}>{c.title}</Text>
      <Text style={em.sub}>{c.sub}</Text>
      {(chipKey === "all" || chipKey === "upcoming") && (
        <TouchableOpacity
          style={em.exploreBtn}
          onPress={() => router.push("/" as any)}
          activeOpacity={0.85}
        >
          <Text style={em.exploreBtnText}>Explore Destinations</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── List Header ───────────────────────────────────────────────────────────────

interface HeaderProps {
  stats: { upcoming: number; completed: number; cancelled: number };
  search: string;
  onSearchChange: (v: string) => void;
  activeChip: ChipKey;
  onChipChange: (c: ChipKey) => void;
}

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "Currently Staying" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function ListHeader({ stats, search, onSearchChange, activeChip, onChipChange }: HeaderProps) {
  const router = useRouter();
  return (
    <View>
      {/* Top bar */}
      <View style={h.header}>
        <TouchableOpacity style={h.iconBtn} activeOpacity={0.7} onPress={() => router.push("/search" as any)}>
          <Ionicons name="search-outline" size={22} color={K.colors.textDark} />
        </TouchableOpacity>
        <View style={h.center}>
          <Text style={h.title}>My Trips</Text>
        </View>
        {/* <TouchableOpacity style={h.iconBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={K.colors.textDark} />
        </TouchableOpacity> */}
      </View>

      <Text style={h.subtitle}>Manage your upcoming and past journeys.</Text>

      {/* Stats banner */}
      <View style={h.statsWrap}>
        <StatsCard {...stats} />
      </View>

      {/* Search bar */}
      <View style={h.searchWrap}>
        <Ionicons name="search" size={16} color={K.colors.textMuted} />
        <TextInput
          style={h.searchInput}
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search destinations or bookings..."
          placeholderTextColor={K.colors.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={h.chipsScroll}
        contentContainerStyle={h.chipsContent}
      >
        {CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[h.chip, activeChip === chip.key && h.chipActive]}
            onPress={() => onChipChange(chip.key)}
            activeOpacity={0.75}
          >
            <Text style={[h.chipText, activeChip === chip.key && h.chipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

const FETCH_KEY = (status: string) => ["myBookings", status, 0] as const;

export default function BookingsScreen() {
  // Guests can browse and book; this screen is account-only. Returned
  // before any other hook — the tab layout remounts on session change so
  // the hook count never shifts under React.
  const authedUser = useAuthStore((s) => s.user);
  if (!authedUser) {
    return <SignInRequired icon="airplane-outline" title="Sign in to see your trips" message="Your bookings and trip history live in your account. Guests can still book without signing in — you will get a confirmation by email." />;
  }

  // Tablet: keep this list at a readable width instead of letting rows
  // stretch edge to edge. No-op on phones.
  const readable = useReadableWidth();
  const [activeChip, setActiveChip] = useState<ChipKey>("all");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  // Load first page of each status for stats + overview sections
  const qOpts = (status: string) => ({
    queryKey: FETCH_KEY(status),
    queryFn: async (): Promise<BookingsResponse> => {
      const res = await listingApi.get<{ data: BookingsResponse }>(
        `/guests/me/bookings?status=${status}&cursor=0`
      );
      return res.data.data;
    },
    staleTime: 0,
  });

  // "upcoming" is the only valid API filter for future/current bookings — split by date client-side
  const { data: upcomingResult, isLoading: loadUpcoming, refetch: refetchUpcoming } = useQuery(qOpts("upcoming"));
  const { data: completedResult, refetch: refetchCompleted } = useQuery(qOpts("completed"));
  const { data: cancelledResult, refetch: refetchCancelled } = useQuery(qOpts("cancelled"));

  // Infinite query for specific filter chips (not "all")
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: pagedData,
    isLoading: loadPaged,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchPaged,
  } = useInfiniteQuery<BookingsResponse>({
    queryKey: ["myBookings", "paged", activeChip],
    queryFn: async ({ pageParam }) => {
      const cursor = (pageParam as number) ?? 0;
      const apiStatus = chipToApiStatus(activeChip as Exclude<ChipKey, "all">);
      const res = await listingApi.get<{ data: BookingsResponse }>(
        `/guests/me/bookings?status=${apiStatus}&cursor=${cursor}`
      );
      return res.data.data;
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: activeChip !== "all",
    staleTime: 0,
  });

  useRefreshOnFocus(useCallback(() => {
    void refetchUpcoming();
    void refetchCompleted();
    void refetchCancelled();
    if (activeChip !== "all") void refetchPaged();
  }, [refetchUpcoming, refetchCompleted, refetchCancelled, refetchPaged, activeChip]));

  const stats = {
    upcoming: upcomingResult?.total ?? 0,
    completed: completedResult?.total ?? 0,
    cancelled: cancelledResult?.total ?? 0,
  };

  // Split the "upcoming" API response by date: past-checkin = currently staying, future = upcoming
  const allUpcoming = upcomingResult?.bookings ?? [];
  const currentlyStaying = allUpcoming.filter(isCurrentlyStaying);
  const upcomingBookings = allUpcoming.filter((b) => !isCurrentlyStaying(b));
  const pagedBookings = pagedData?.pages.flatMap((p) => p.bookings) ?? [];

  const isLoading = activeChip === "all" ? loadUpcoming : loadPaged;

  function applySearch(list: BookingSummary[]): BookingSummary[] {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (b) =>
        b.listingTitle.toLowerCase().includes(q) ||
        b.reference.toLowerCase().includes(q) ||
        (b.listingTown ?? "").toLowerCase().includes(q) ||
        (b.listingCountry ?? "").toLowerCase().includes(q)
    );
  }

  const listItems = useMemo((): ListItem[] => {
    if (isLoading) {
      return [
        { _type: "shimmer", key: "s1" },
        { _type: "shimmer", key: "s2" },
        { _type: "shimmer", key: "s3" },
      ];
    }

    const items: ListItem[] = [];

    if (activeChip === "all") {
      const visStaying = applySearch(currentlyStaying);
      const visUpcoming = applySearch(upcomingBookings);

      if (visStaying.length > 0) {
        items.push({ _type: "section_header", title: "Currently Staying", liveNow: true });
        visStaying.forEach((b) => items.push({ _type: "active_card", booking: b }));
      }

      if (visUpcoming.length > 0) {
        items.push({ _type: "section_header", title: "Upcoming Trips" });
        visUpcoming.forEach((b) => items.push({ _type: "upcoming_card", booking: b }));
      }

      if (visStaying.length === 0 && visUpcoming.length === 0) {
        items.push({ _type: "empty", chipKey: "all" });
      }
    } else {
      const visible = applySearch(pagedBookings);

      visible.forEach((b) => {
        // Upcoming: hero card layout; completed/cancelled: compact horizontal card
        if (activeChip === "upcoming") items.push({ _type: "upcoming_card", booking: b });
        else items.push({ _type: "compact_card", booking: b });
      });

      if (visible.length === 0 && !loadPaged) {
        items.push({ _type: "empty", chipKey: activeChip });
      }
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChip, search, currentlyStaying, upcomingBookings, pagedBookings, isLoading, loadPaged]);

  const handleEndReached = useCallback(() => {
    if (activeChip !== "all" && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [activeChip, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void qc.invalidateQueries({ queryKey: ["myBookings"] }).then(() => {
      setTimeout(() => setRefreshing(false), 600);
    });
  }, [qc]);

  const handleChipChange = useCallback((chip: ChipKey) => {
    setActiveChip(chip);
    setSearch("");
  }, []);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <FlatList
        data={listItems}
        keyExtractor={(item, i) => `${item._type}_${"booking" in item ? item.booking.id : i}`}
        ListHeaderComponent={
          <ListHeader
            stats={stats}
            search={search}
            onSearchChange={setSearch}
            activeChip={activeChip}
            onChipChange={handleChipChange}
          />
        }
        renderItem={({ item }) => {
          switch (item._type) {
            case "shimmer":
              return <View style={{ paddingHorizontal: K.spacing.screen, paddingTop: K.spacing.screen }}><TripSkeleton /></View>;
            case "section_header":
              return <View style={s.sectionWrap}><SectionHeader title={item.title} liveNow={item.liveNow} /></View>;
            case "active_card":
              return <View style={s.cardWrap}><ActiveStayCard booking={item.booking} /></View>;
            case "upcoming_card":
              return <View style={s.cardWrap}><UpcomingCard booking={item.booking} /></View>;
            case "compact_card":
              return <View style={s.cardWrap}><CompactCard booking={item.booking} /></View>;
            case "empty":
              return <EmptyTripsState chipKey={item.chipKey} />;
          }
        }}
        contentContainerStyle={[s.listContent, readable]}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={s.footerLoader}>
              <View style={s.footerLoaderDot} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={K.colors.accent}
          />
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  listContent: { paddingBottom: 24 },
  sectionWrap: { paddingHorizontal: K.spacing.screen, paddingTop: K.spacing.xl, paddingBottom: K.spacing.md },
  cardWrap: { paddingHorizontal: K.spacing.screen, marginBottom: K.spacing.md },
  footerLoader: { alignItems: "center", paddingVertical: 20 },
  footerLoaderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: K.colors.accent, opacity: 0.6 },
  footerHint: { textAlign: "center", fontSize: K.font.sm, color: K.colors.textMuted, fontStyle: "italic", paddingVertical: 16 },
});

// Header styles
const h = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: K.spacing.screen,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: K.colors.bgCard,
  },
  center: { flex: 1, alignItems: "center" },
  title: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: K.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  subtitle: {
    fontSize: K.font.sm,
    color: K.colors.textMuted,
    paddingHorizontal: K.spacing.screen,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  statsWrap: { paddingHorizontal: K.spacing.screen, paddingVertical: 16, backgroundColor: K.colors.bgApp },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: K.spacing.screen,
    marginBottom: 14,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.full,
    borderWidth: 1,
    borderColor: K.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    ...K.shadow.xs,
  },
  searchInput: { flex: 1, fontSize: K.font.base, color: K.colors.textDark, padding: 0 },
  chipsScroll: { flexGrow: 0, marginBottom: 8 },
  chipsContent: { paddingHorizontal: K.spacing.screen, gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgCard,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  chipActive: {
    backgroundColor: K.colors.darkGreen,
    borderColor: K.colors.darkGreen,
  },
  chipText: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMid },
  chipTextActive: { color: "#fff" },
});

// Stats card styles
const st = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    paddingVertical: 20,
    ...K.shadow.md,
  },
  col: { flex: 1, alignItems: "center", gap: 4 },
  num: { fontSize: K.font.xxxl, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  label: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.65)", letterSpacing: 1.2 },
  divider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 6 },
});

// Section header styles
const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.4 },
  liveWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  liveText: { fontSize: K.font.sm, fontWeight: "700", color: "#22c55e" },
});

// Active Stay Card styles
const ac = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    overflow: "hidden",
    ...K.shadow.md,
  },
  photoWrap: { height: 190, position: "relative" },
  badge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: K.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: K.colors.textDark, letterSpacing: 1.4 },
  body: { padding: 16 },
  title: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, marginBottom: 3 },
  ref: { fontSize: 11, color: K.colors.textMuted, marginBottom: 14 },
  statsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: K.radius.md,
    overflow: "hidden",
    marginBottom: 14,
  },
  statBox: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  statDivider: { width: 1, backgroundColor: K.colors.border },
  statLabel: { fontSize: 10, fontWeight: "700", color: K.colors.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  statValue: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.accent },
  extendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: K.colors.bgTint,
    borderRadius: K.radius.button,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: K.colors.accentDim,
  },
  extendBtnText: { fontSize: K.font.base, fontWeight: "700", color: K.colors.accent },
});

// Upcoming Card styles
const uc = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    overflow: "hidden",
    ...K.shadow.md,
  },
  photoWrap: { height: PHOTO_H, position: "relative" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  photoTopRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 54,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: K.radius.full,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "800" },
  daysBadge: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: K.radius.full,
  },
  daysBadgeText: { fontSize: 11, fontWeight: "700", color: K.colors.textDark },
  heartBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: K.radius.full,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 16, gap: 10 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: K.font.sm, color: K.colors.textMuted, fontWeight: "500" },
  title: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.3, lineHeight: 26 },
  bookingId: { fontSize: 11, color: K.colors.textMuted },
  infoRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: K.radius.md,
    overflow: "hidden",
  },
  infoCol: { flex: 1, padding: 12, gap: 2 },
  infoColDivider: { width: 1, backgroundColor: K.colors.border },
  infoLabel: { fontSize: 10, fontWeight: "700", color: K.colors.textMuted, letterSpacing: 0.8 },
  infoValue: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  infoSub: { fontSize: 11, color: K.colors.textMuted },
  primaryBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingVertical: 14,
    alignItems: "center",
    ...K.shadow.brand,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
  secondaryBtn: {
    borderRadius: K.radius.button,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: K.colors.border,
    backgroundColor: K.colors.bgSubtle,
  },
  secondaryBtnText: { color: K.colors.textDark, fontWeight: "600", fontSize: K.font.base },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  paymentIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center" },
  paymentText: { flex: 1 },
  paymentTitle: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  paymentSub: { fontSize: 11, color: K.colors.textMuted, marginTop: 2 },
});

// Compact Card styles
const cc = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  stripe: { width: 4 },
  thumb: { width: 90, height: 110, position: "relative", backgroundColor: K.colors.bgSubtle },
  thumbFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  typeTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: K.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  typeTagText: { fontSize: 9, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  content: { flex: 1, padding: 12, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 3 },
  title: { flex: 1, fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: K.radius.full },
  statusText: { fontSize: 10, fontWeight: "700" },
  ref: { fontSize: 10, color: K.colors.textMuted, marginBottom: 4 },
  dates: { fontSize: 11, color: K.colors.textMid, marginBottom: 6 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amount: { fontSize: K.font.base, fontWeight: "800", color: K.colors.textDark },
  nights: { fontSize: 11, color: K.colors.textMuted },
});

// Empty state styles
const em = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingVertical: 48,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: 10, textAlign: "center" },
  sub: { fontSize: K.font.base, color: K.colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  exploreBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingHorizontal: 32,
    paddingVertical: 14,
    ...K.shadow.brand,
  },
  exploreBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
});

// Skeleton styles
const sk = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    overflow: "hidden",
    ...K.shadow.sm,
    marginBottom: K.spacing.md,
  },
  photo: { height: 180, backgroundColor: K.colors.border },
  body: { padding: 16, gap: 12 },
  line1: { height: 16, width: "60%", backgroundColor: K.colors.border, borderRadius: 4 },
  line2: { height: 12, width: "40%", backgroundColor: K.colors.border, borderRadius: 4 },
  line3: { height: 12, width: "75%", backgroundColor: K.colors.border, borderRadius: 4 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 44, backgroundColor: K.colors.border, borderRadius: K.radius.button },
});
