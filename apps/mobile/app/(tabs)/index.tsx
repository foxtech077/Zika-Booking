import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { listingApi } from "../../lib/listing-api";
import { ListingImage } from "../../components/ListingImage";

const { width: W } = Dimensions.get("window");
const GREEN = "#1B5E20";
const GREEN_LIGHT = "#F0FFF4";
const GREEN_BORDER = "#BBF7D0";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

type Category = "hotels" | "apartments" | "cars";

interface SearchResult {
  id: string;
  listingType: string;
  title: string;
  city: string;
  countryCode: string;
  distanceKm: number;
  primaryPhotoUrl: string | null;
  nightlyRate: number | null;
  dailyRate: number | null;
  currency: string;
  starRating: number | null;
  isAccredited: boolean;
  longStayDiscountEnabled?: boolean;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  transmission: string | null;
  seats: number | null;
}

interface SearchResponse {
  data: { totalCount: number; nextCursor: string | null; results: SearchResult[] };
}

function fmtPrice(n: number | null, currency: string): string {
  if (!n) return "";
  return `${currency} ${n.toLocaleString()}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return "Select date";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Inline Date Picker Modal ──────────────────────────────────────────────────

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function DatePickerModal({
  visible, title, minDate, onSelect, onClose,
}: {
  visible: boolean; title: string; minDate?: Date;
  onSelect: (d: Date) => void; onClose: () => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());

  function prevMonth() { if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1); }
  function nextMonth() { if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1); }

  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isDisabled(day: number) {
    const d = new Date(yr, mo, day); d.setHours(0, 0, 0, 0);
    if (d < today) return true;
    if (minDate) { const m = new Date(minDate); m.setHours(0, 0, 0, 0); if (d <= m) return true; }
    return false;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={dp.sheet} activeOpacity={1} onPress={() => { }}>
          <Text style={dp.title}>{title}</Text>
          <View style={dp.navRow}>
            <TouchableOpacity onPress={prevMonth} style={dp.navBtn}><Text style={dp.navArrow}>‹</Text></TouchableOpacity>
            <Text style={dp.monthLabel}>{MONTHS[mo]} {yr}</Text>
            <TouchableOpacity onPress={nextMonth} style={dp.navBtn}><Text style={dp.navArrow}>›</Text></TouchableOpacity>
          </View>
          <View style={dp.dowRow}>
            {DAYS.map(d => <Text key={d} style={dp.dow}>{d}</Text>)}
          </View>
          <View style={dp.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={dp.emptyCell} />;
              const disabled = isDisabled(day);
              return (
                <TouchableOpacity
                  key={day} style={[dp.cell, disabled && dp.cellDisabled]}
                  onPress={() => { if (!disabled) { onSelect(new Date(yr, mo, day)); onClose(); } }}
                  disabled={disabled}
                >
                  <Text style={[dp.cellText, disabled && dp.cellTextDisabled]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={dp.cancelBtn} onPress={onClose}>
            <Text style={dp.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const dp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 16 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 22, color: "#1B5E20", fontWeight: "700" },
  monthLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  dowRow: { flexDirection: "row", marginBottom: 8 },
  dow: { width: "14.28%", textAlign: "center", fontSize: 12, fontWeight: "600", color: "#6B7280" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  emptyCell: { width: "14.28%", height: 40 },
  cell: { width: "14.28%", height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  cellDisabled: { opacity: 0.3 },
  cellText: { fontSize: 14, fontWeight: "500", color: "#111827" },
  cellTextDisabled: { color: "#9CA3AF" },
  cancelBtn: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
});

// ── Listing Card ──────────────────────────────────────────────────────────────

function ListingCard({
  item, onPress, width = 200, badgeLabel, badgeColor, photoUrl,
}: {
  item: SearchResult; onPress: () => void; width?: number;
  badgeLabel?: string; badgeColor?: string; photoUrl?: string | null;
}) {
  const isCar = item.listingType === "car";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  const unit = isCar ? "day" : "night";
  const [imgError, setImgError] = useState(false);
  const displayPhoto = photoUrl ?? item.primaryPhotoUrl;
  return (
    <TouchableOpacity style={[c.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View>
        {!imgError && displayPhoto ? (
          <ListingImage uri={displayPhoto} style={c.photo} onError={() => setImgError(true)} />
        ) : (
          <View style={[c.photo, { backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ fontSize: 28 }}>{isCar ? "🚗" : "🏨"}</Text>
          </View>
        )}
        {badgeLabel ? (
          <View style={[c.badge, { backgroundColor: badgeColor ?? GREEN }]}>
            <Text style={c.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
        {item.starRating != null && item.starRating > 0 ? (
          <View style={c.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={c.ratingText}>{item.starRating}</Text>
          </View>
        ) : null}
      </View>
      <View style={c.body}>
        <Text style={c.title} numberOfLines={1}>{item.title}</Text>
        <View style={c.row}>
          <Ionicons name="location-outline" size={11} color={MUTED} />
          <Text style={c.loc} numberOfLines={1}>
            {item.city}{item.distanceKm != null ? ` · ${item.distanceKm.toFixed(1)}km` : ""}
          </Text>
        </View>
        <Text style={c.price}>
          {fmtPrice(rate, item.currency)}<Text style={c.priceUnit}>/{unit}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  photo: { width: "100%", height: 130 },
  badge: {
    position: "absolute", top: 10, left: 10,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  ratingBadge: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 3,
    flexDirection: "row", alignItems: "center", gap: 3,
  },
  ratingText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  body: { padding: 10 },
  title: { fontSize: 13, fontWeight: "700", color: TEXT, marginBottom: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 5 },
  loc: { fontSize: 11, color: MUTED, flex: 1 },
  price: { fontSize: 14, fontWeight: "800", color: GREEN },
  priceUnit: { fontSize: 10, fontWeight: "400", color: MUTED },
});

// ── Nearby Row ────────────────────────────────────────────────────────────────

function NearbyCard({ item, onPress, photoUrl }: { item: SearchResult; onPress: () => void; photoUrl?: string | null }) {
  const isCar = item.listingType === "car";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  const [imgError, setImgError] = useState(false);
  const displayPhoto = photoUrl ?? item.primaryPhotoUrl;
  return (
    <TouchableOpacity style={nb.card} onPress={onPress} activeOpacity={0.85}>
      {!imgError && displayPhoto ? (
        <ListingImage uri={displayPhoto} style={nb.photo} onError={() => setImgError(true)} />
      ) : (
        <View style={[nb.photo, { backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 22 }}>{isCar ? "🚗" : "🏨"}</Text>
        </View>
      )}
      <View style={nb.info}>
        <Text style={nb.title} numberOfLines={1}>{item.title}</Text>
        <View style={nb.row}>
          <Ionicons name="location-outline" size={12} color={MUTED} />
          <Text style={nb.loc}>{item.city} · {item.distanceKm?.toFixed(1)}km away</Text>
        </View>
        <Text style={nb.price}>
          {fmtPrice(rate, item.currency)}<Text style={nb.unit}>/{isCar ? "day" : "night"}</Text>
        </Text>
      </View>
      {item.starRating != null && item.starRating > 0 ? (
        <View style={nb.star}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={nb.starText}>{item.starRating}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const nb = StyleSheet.create({
  card: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 14,
    overflow: "hidden", borderWidth: 1, borderColor: BORDER, marginBottom: 10,
  },
  photo: { width: 80, height: 80 },
  info: { flex: 1, padding: 10, justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "700", color: TEXT, marginBottom: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 4 },
  loc: { fontSize: 11, color: MUTED },
  price: { fontSize: 13, fontWeight: "800", color: GREEN },
  unit: { fontSize: 10, fontWeight: "400", color: MUTED },
  star: { paddingRight: 12, alignItems: "center", justifyContent: "center", gap: 2 },
  starText: { fontSize: 12, fontWeight: "700", color: TEXT },
});

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, onMore }: {
  title: string; subtitle?: string; onMore?: () => void;
}) {
  return (
    <View style={sh.row}>
      <View style={{ flex: 1 }}>
        <Text style={sh.title}>{title}</Text>
        {subtitle ? <Text style={sh.sub}>{subtitle}</Text> : null}
      </View>
      {onMore ? (
        <TouchableOpacity onPress={onMore}>
          <Text style={sh.more}>View More</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingHorizontal: 16 },
  title: { fontSize: 17, fontWeight: "800", color: TEXT },
  sub: { fontSize: 12, color: MUTED, marginTop: 2 },
  more: { fontSize: 13, color: GREEN, fontWeight: "700" },
});

// ── Featured Card ─────────────────────────────────────────────────────────────
function FeaturedCard({
  item, onPress, photoUrl,
}: {
  item: SearchResult; onPress: () => void; photoUrl?: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const displayPhoto = photoUrl ?? item.primaryPhotoUrl;
  return (
    <TouchableOpacity style={s.featuredCard} onPress={onPress} activeOpacity={0.88}>
      {!imgError && displayPhoto ? (
        <ListingImage uri={displayPhoto} style={s.featuredPhoto} onError={() => setImgError(true)} />
      ) : (
        <View style={[s.featuredPhoto, { backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 36 }}>🏨</Text>
        </View>
      )}
      <View style={s.featuredOverlay}>
        <View style={s.featuredBadgeWrap}>
          <Text style={s.featuredBadgeText}>FEATURED & EXCLUSIVE</Text>
        </View>
        <Text style={s.featuredTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={s.featuredLoc}>{item.city}, {item.countryCode}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={s.featuredPrice}>
            {fmtPrice(item.nightlyRate, item.currency)}<Text style={{ fontSize: 12, fontWeight: "400" }}>/night</Text>
          </Text>
          <View style={s.featuredBtn}>
            <Text style={s.featuredBtnText}>Book</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Premium Car Card ──────────────────────────────────────────────────────────
function PremiumCarCard({
  item, onPress, photoUrl, isLast,
}: {
  item: SearchResult; onPress: () => void; photoUrl?: string | null; isLast: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const displayPhoto = photoUrl ?? item.primaryPhotoUrl;
  return (
    <TouchableOpacity
      style={[c.card, { width: 220, marginRight: isLast ? 0 : 12 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {!imgError && displayPhoto ? (
        <ListingImage uri={displayPhoto} style={[c.photo, { height: 140 }]} onError={() => setImgError(true)} />
      ) : (
        <View style={[c.photo, { height: 140, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 28 }}>🚗</Text>
        </View>
      )}
      <View style={c.body}>
        <View style={s.carBadge}><Text style={s.carBadgeText}>LUXURY</Text></View>
        <Text style={c.title} numberOfLines={1}>{item.carMake} {item.carModel} {item.carYear}</Text>
        <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{item.transmission} · {item.seats} seats</Text>
        <Text style={c.price}>{fmtPrice(item.dailyRate, item.currency)}<Text style={c.priceUnit}>/day</Text></Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Trending Card ─────────────────────────────────────────────────────────────
function TrendingCard({
  item, onPress, photoUrl,
}: {
  item: SearchResult; onPress: () => void; photoUrl?: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const displayPhoto = photoUrl ?? item.primaryPhotoUrl;
  return (
    <TouchableOpacity style={s.trendCard} onPress={onPress} activeOpacity={0.85}>
      {!imgError && displayPhoto ? (
        <ListingImage uri={displayPhoto} style={s.trendPhoto} onError={() => setImgError(true)} />
      ) : (
        <View style={[s.trendPhoto, { backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 24 }}>🏨</Text>
        </View>
      )}
      <View style={s.trendOverlay}>
        <Text style={s.trendTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.trendPrice}>{fmtPrice(item.nightlyRate ?? item.dailyRate, item.currency)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.firstName ?? "Explorer";
  const loyaltyPoints = user?.loyaltyPoints ?? 0;
  const currentTier = user?.currentTier ?? "bronze";

  const [category, setCategory] = useState<Category>("hotels");
  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(1);
  const [datePicker, setDatePicker] = useState<"checkIn" | "checkOut" | "pickup" | "return" | null>(null);

  // ── API Queries ──────────────────────────────────────────────────────────
  const { data: hotelsData, isLoading: hotelsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-hotels"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=hotel&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  const { data: apartmentsData, isLoading: aptsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-apartments"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=apartment&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  const { data: carsData, isLoading: carsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-cars"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=car&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  // ── Curated segments ─────────────────────────────────────────────────────
  // listingType guard prevents mis-categorised listings (e.g. a listing whose
  // name is "car") from polluting hotel / apartment sections.
  const bestOffers = [
    ...(hotelsData ?? []).filter((h) => h.listingType !== "car" && h.nightlyRate != null && h.nightlyRate <= 15000),
    ...(apartmentsData ?? []).filter((a) => a.listingType !== "car" && a.longStayDiscountEnabled),
  ].slice(0, 8);

  const recommended = [
    ...(hotelsData ?? []).filter((h) => h.listingType !== "car" && ((h.starRating ?? 0) >= 4 || h.isAccredited)),
    ...(apartmentsData ?? []).filter((a) => a.listingType !== "car" && a.isAccredited),
  ].slice(0, 8);

  const featured = (hotelsData ?? [])
    .filter((h) => h.listingType !== "car" && (h.isAccredited || (h.starRating ?? 0) >= 5))
    .slice(0, 3);

  const nearbyAll = [
    ...(hotelsData ?? []).filter((h) => h.listingType !== "car"),
    ...(apartmentsData ?? []).filter((a) => a.listingType !== "car"),
  ].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5);

  const premiumCars = (carsData ?? []).filter((c) => c.listingType === "car").slice(0, 6);

  const trending = [
    ...(hotelsData ?? []).filter((h) => h.listingType !== "car").slice(0, 2),
    ...(apartmentsData ?? []).filter((a) => a.listingType !== "car").slice(0, 2),
  ].slice(0, 4);

  // ── Batch-fetch fresh photo URLs ─────────────────────────────────────────
  // POST /listings/batch-summary is the public "Search" API designed for card
  // display. It does not require provider auth, so traveler guests can call it.
  // We fall back to individual GET /listings/{id}/public calls if the batch
  // endpoint fails or returns no photo data.
  const displayedIds = useMemo(() => {
    const ids = new Set<string>();
    [...bestOffers, ...recommended, ...featured, ...nearbyAll, ...premiumCars, ...trending]
      .forEach((item) => ids.add(item.id));
    return Array.from(ids);
  }, [bestOffers, recommended, featured, nearbyAll, premiumCars, trending]);

  const photoQueries = useQueries({
    queries: displayedIds.map((id) => ({
      // "photo-v2" key — avoids stale cache from previous attempts
      queryKey: ["photo-v2", id],
      queryFn: async (): Promise<string | null> => {
        const endpoint = `/listings/${id}/public`;
        console.log(`[Home Listing Cards] API Endpoint Called: ${endpoint}`);
        console.log(`[Home Listing Cards] Listing ID: ${id}`);
        try {
          const res = await listingApi.get<{ data: { primaryPhotoUrl?: string; photos: Array<{ cdnUrl: string }> } }>(endpoint);
          const returnedPrimaryPhotoUrl = res.data.data?.primaryPhotoUrl ?? res.data.data?.photos?.[0]?.cdnUrl ?? null;
          const returnedPhotoGalleryUrls = res.data.data?.photos?.map((p) => p.cdnUrl) ?? [];
          console.log(`[Home Listing Cards] Returned primaryPhotoUrl: ${returnedPrimaryPhotoUrl}`);
          console.log(`[Home Listing Cards] Returned photo gallery URLs:`, returnedPhotoGalleryUrls);
          return returnedPrimaryPhotoUrl;
        } catch (error) {
          console.error(`[Home Listing Cards] Error fetching from ${endpoint}:`, error);
          return null;
        }
      },
      // staleTime: 0 so each session gets fresh presigned URLs (they expire)
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: 0,
    })),
  });

  const photoMap: Record<string, string> = Object.fromEntries(
    displayedIds.flatMap((id, i) => {
      const url = photoQueries[i]?.data;
      return url ? [[id, url]] : [];
    })
  );

  function navToListing(id: string, isCar?: boolean) {
    const params: Record<string, string> = {};
    if (!isCar) {
      if (checkIn) params.checkIn = checkIn.toISOString().split("T")[0]!;
      if (checkOut) params.checkOut = checkOut.toISOString().split("T")[0]!;
      params.guests = String(guests);
    } else {
      if (pickupDate) params.pickupDatetime = pickupDate.toISOString();
      if (returnDate) params.returnDatetime = returnDate.toISOString();
    }
    router.push({ pathname: `/listing/${id}` as any, params });
  }

  function handleSearch() {
    const apiCat = category === "cars" ? "car" : category === "apartments" ? "apartment" : "hotel";
    const params: Record<string, string> = { category: apiCat, guests: String(guests) };
    if (location.trim()) params.placeName = location.trim();
    if (category !== "cars") {
      if (checkIn) params.checkIn = checkIn.toISOString().split("T")[0]!;
      if (checkOut) params.checkOut = checkOut.toISOString().split("T")[0]!;
    } else {
      if (pickupDate) params.pickupDatetime = pickupDate.toISOString();
      if (returnDate) params.returnDatetime = returnDate.toISOString();
    }
    router.push({ pathname: "/search", params });
  }

  function detectUserLocation() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const apiCat = category === "cars" ? "car" : category === "apartments" ? "apartment" : "hotel";
          const params: Record<string, string> = {
            category: apiCat,
            guests: String(guests),
            geoLat: String(latitude),
            geoLng: String(longitude),
          };
          if (category !== "cars") {
            if (checkIn) params.checkIn = checkIn.toISOString().split("T")[0]!;
            if (checkOut) params.checkOut = checkOut.toISOString().split("T")[0]!;
          } else {
            if (pickupDate) params.pickupDatetime = pickupDate.toISOString();
            if (returnDate) params.returnDatetime = returnDate.toISOString();
          }
          router.push({ pathname: "/search", params });
        },
        () => Alert.alert("Location Error", "Could not get your location. Please enable location services.")
      );
    } else {
      Alert.alert("Not supported", "Location detection is not available on this device.");
    }
  }

  function tierColor() {
    const map: Record<string, string> = { bronze: "#CD7F32", silver: "#9CA3AF", gold: "#F59E0B", diamond: "#60A5FA" };
    return map[currentTier] ?? "#9CA3AF";
  }

  const allLoading = hotelsLoading || aptsLoading || carsLoading;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>KAINOOK</Text>
            <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
          </View>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>

        {/* ── Category Tabs ── */}
        <View style={s.tabsRow}>
          {(["hotels", "apartments", "cars"] as Category[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.tab, category === cat && s.tabActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[s.tabText, category === cat && s.tabTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Search Card ── */}
        <View style={s.searchCard}>
          {/* Location */}
          <View style={s.searchRow}>
            <Ionicons name="location-outline" size={18} color={GREEN} style={{ marginRight: 10 }} />
            <TextInput
              style={s.locationInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Anywhere (city, country…)"
              placeholderTextColor={MUTED}
            />
            <TouchableOpacity onPress={detectUserLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="navigate" size={18} color={GREEN} />
            </TouchableOpacity>
          </View>

          {/* Dates — Stays vs Cars */}
          {category !== "cars" ? (
            <View style={s.datesRow}>
              <TouchableOpacity style={s.dateBtn} onPress={() => setDatePicker("checkIn")} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={15} color={GREEN} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.dateBtnLabel}>Check-in</Text>
                  <Text style={[s.dateBtnValue, !checkIn && s.dateBtnPlaceholder]}>{fmtDate(checkIn)}</Text>
                </View>
              </TouchableOpacity>
              <View style={s.dateDivider} />
              <TouchableOpacity style={s.dateBtn} onPress={() => setDatePicker("checkOut")} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={15} color={GREEN} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.dateBtnLabel}>Check-out</Text>
                  <Text style={[s.dateBtnValue, !checkOut && s.dateBtnPlaceholder]}>{fmtDate(checkOut)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.datesRow}>
              <TouchableOpacity style={s.dateBtn} onPress={() => setDatePicker("pickup")} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={15} color={GREEN} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.dateBtnLabel}>Pickup Date</Text>
                  <Text style={[s.dateBtnValue, !pickupDate && s.dateBtnPlaceholder]}>{fmtDate(pickupDate)}</Text>
                </View>
              </TouchableOpacity>
              <View style={s.dateDivider} />
              <TouchableOpacity style={s.dateBtn} onPress={() => setDatePicker("return")} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={15} color={GREEN} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.dateBtnLabel}>Return Date</Text>
                  <Text style={[s.dateBtnValue, !returnDate && s.dateBtnPlaceholder]}>{fmtDate(returnDate)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Guests */}
          <View style={s.guestsRow}>
            <Ionicons name="people-outline" size={16} color={MUTED} style={{ marginRight: 8 }} />
            <Text style={s.guestsLabel}>Guests</Text>
            <View style={s.guestsCounter}>
              <TouchableOpacity
                style={s.guestBtn}
                onPress={() => setGuests(g => Math.max(1, g - 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.guestBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.guestCount}>{guests}</Text>
              <TouchableOpacity
                style={s.guestBtn}
                onPress={() => setGuests(g => Math.min(20, g + 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.guestBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
          <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.searchBtnText}>
            {location.trim()
              ? `Search ${category === "cars" ? "Cars" : "Stays"} in ${location}`
              : `Browse All ${category === "cars" ? "Cars" : "Stays"}`}
          </Text>
        </TouchableOpacity>

        {/* Date picker modals */}
        <DatePickerModal
          visible={datePicker === "checkIn"}
          title="Select Check-in Date"
          onSelect={d => { setCheckIn(d); if (checkOut && d >= checkOut) setCheckOut(null); }}
          onClose={() => setDatePicker(null)}
        />
        <DatePickerModal
          visible={datePicker === "checkOut"}
          title="Select Check-out Date"
          minDate={checkIn ?? undefined}
          onSelect={d => setCheckOut(d)}
          onClose={() => setDatePicker(null)}
        />
        <DatePickerModal
          visible={datePicker === "pickup"}
          title="Select Pickup Date"
          onSelect={d => {
            const dateWithTime = new Date(d);
            dateWithTime.setHours(10, 0, 0, 0); // default to 10:00 AM
            setPickupDate(dateWithTime);
            if (returnDate && dateWithTime >= returnDate) setReturnDate(null);
          }}
          onClose={() => setDatePicker(null)}
        />
        <DatePickerModal
          visible={datePicker === "return"}
          title="Select Return Date"
          minDate={pickupDate ?? undefined}
          onSelect={d => {
            const dateWithTime = new Date(d);
            dateWithTime.setHours(10, 0, 0, 0); // default to 10:00 AM
            setReturnDate(dateWithTime);
          }}
          onClose={() => setDatePicker(null)}
        />

        {/* ── KAI-Points ── */}
        {user ? (
          <View style={s.loyaltyCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.loyaltyLabel}>KAI-Points Balance</Text>
              <Text style={s.loyaltyPoints}>{loyaltyPoints.toLocaleString()} <Text style={s.loyaltyPtSuffix}>KAI-Points</Text></Text>
              <View style={s.tierRow}>
                <View style={[s.tierDot, { backgroundColor: tierColor() }]} />
                <Text style={s.tierLabel}>{currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Member</Text>
              </View>
            </View>
            <Ionicons name="diamond-outline" size={32} color="rgba(255,255,255,0.25)" />
          </View>
        ) : null}

        {/* ── Promo Banner ── */}
        <View style={s.promoBanner}>
          <View style={s.promoTag}><Text style={s.promoTagText}>Exclusive Reward</Text></View>
          <Text style={s.promoTitle}>15% Off Your Next Stay</Text>
          <TouchableOpacity onPress={() => Alert.alert("Voucher Copied!", 'Use code "EXPLORER24" at checkout.')}>
            <Text style={s.promoCode}>Use Code: EXPLORER24</Text>
          </TouchableOpacity>
        </View>

        {/* ── Best Offers ── */}
        <View style={s.section}>
          <SectionHeader
            title="Best Offers & Deals"
            onMore={() => router.push({ pathname: "/search", params: { category: "hotel", placeName: location } })}
          />
          {allLoading ? (
            <ActivityIndicator color={GREEN} style={{ marginLeft: 16 }} />
          ) : bestOffers.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {bestOffers.map((item, idx) => (
                <View key={item.id} style={{ marginRight: idx < bestOffers.length - 1 ? 12 : 0 }}>
                  <ListingCard
                    item={item} width={200}
                    badgeLabel={item.longStayDiscountEnabled ? "LONG STAY" : "BEST DEAL"}
                    badgeColor={item.longStayDiscountEnabled ? "#8B5CF6" : "#DC2626"}
                    photoUrl={photoMap[item.id]}
                    onPress={() => navToListing(item.id, false)}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* ── Recommended Stays ── */}
        <View style={s.section}>
          <SectionHeader
            title="Recommended Stays"
            subtitle="Top-rated gems selected just for you"
            onMore={() => router.push({ pathname: "/search", params: { category: "hotel", placeName: location } })}
          />
          {hotelsLoading ? (
            <ActivityIndicator color={GREEN} style={{ marginLeft: 16 }} />
          ) : recommended.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {recommended.map((item, idx) => (
                <View key={item.id} style={{ marginRight: idx < recommended.length - 1 ? 12 : 0 }}>
                  <ListingCard item={item} width={210} badgeLabel="TOP RATED" badgeColor="#F59E0B"
                    photoUrl={photoMap[item.id]}
                    onPress={() => navToListing(item.id, false)} />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {/* ── Featured Stays ── */}
        {featured.length > 0 ? (
          <View style={s.section}>
            <SectionHeader title="Featured Stays" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {featured.map((item) => (
                <FeaturedCard
                  key={item.id}
                  item={item}
                  photoUrl={photoMap[item.id]}
                  onPress={() => navToListing(item.id, false)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Stays Nearby ── */}
        <View style={s.section}>
          <SectionHeader
            title="Stays Nearby"
            subtitle="Based on your location"
            onMore={() => router.push({ pathname: "/search", params: { category: "hotel", placeName: location } })}
          />
          {hotelsLoading || aptsLoading ? (
            <ActivityIndicator color={GREEN} style={{ marginLeft: 16 }} />
          ) : nearbyAll.length > 0 ? (
            <View style={{ paddingHorizontal: 16 }}>
              {nearbyAll.map((item) => (
                <NearbyCard key={item.id} item={item} photoUrl={photoMap[item.id]} onPress={() => navToListing(item.id, item.listingType === "car")} />
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Premium Cars ── */}
        {premiumCars.length > 0 ? (
          <View style={s.section}>
            <SectionHeader
              title="Premium Rental Cars"
              subtitle="Arrive in style with our luxury fleet"
              onMore={() => router.push({ pathname: "/search", params: { category: "car", placeName: location } })}
            />
            {carsLoading ? (
              <ActivityIndicator color={GREEN} style={{ marginLeft: 16 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
                {premiumCars.map((item, idx) => (
                  <PremiumCarCard
                    key={item.id}
                    item={item}
                    photoUrl={photoMap[item.id]}
                    onPress={() => navToListing(item.id, true)}
                    isLast={idx === premiumCars.length - 1}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {/* ── Trending Now ── */}
        {trending.length > 0 ? (
          <View style={s.section}>
            <SectionHeader title="Trending Now" />
            <View style={s.trendGrid}>
              {trending.map((item) => (
                <TrendingCard
                  key={item.id}
                  item={item}
                  photoUrl={photoMap[item.id]}
                  onPress={() => navToListing(item.id, false)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ── CTA Banner ── */}
        <View style={s.ctaBanner}>
          <Text style={s.ctaTitle}>Unlock the{"\n"}Extraordinary</Text>
          <Text style={s.ctaSub}>Kainook members enjoy exclusive stay credits and access to over 1,000 properties worldwide.</Text>
          <TouchableOpacity style={s.ctaBtn}>
            <Text style={s.ctaBtnText}>Explore Member Perks</Text>
            <Ionicons name="arrow-forward" size={14} color={GREEN} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, backgroundColor: "#fff",
  },
  brand: { fontSize: 22, fontWeight: "900", color: GREEN, letterSpacing: 1 },
  greeting: { fontSize: 13, color: MUTED, marginTop: 2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#F9FAFB",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER,
  },

  tabsRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  tab: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: GREEN, borderColor: GREEN },
  tabText: { fontSize: 13, fontWeight: "600", color: MUTED },
  tabTextActive: { color: "#fff" },

  searchCard: {
    marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  locationInput: { flex: 1, fontSize: 15, color: TEXT, fontWeight: "500" },

  datesRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  dateBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dateDivider: { width: 1, backgroundColor: BORDER, marginVertical: 8 },
  dateBtnLabel: { fontSize: 11, color: MUTED, fontWeight: "600", marginBottom: 2 },
  dateBtnValue: { fontSize: 13, fontWeight: "600", color: TEXT },
  dateBtnPlaceholder: { color: MUTED, fontWeight: "400" },

  guestsRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  guestsLabel: { flex: 1, fontSize: 14, color: TEXT, fontWeight: "500" },
  guestsCounter: { flexDirection: "row", alignItems: "center", gap: 16 },
  guestBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: GREEN,
    alignItems: "center", justifyContent: "center",
  },
  guestBtnText: { fontSize: 20, color: "#fff", fontWeight: "700", lineHeight: 24 },
  guestCount: { fontSize: 16, fontWeight: "700", color: TEXT, minWidth: 20, textAlign: "center" },

  searchBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 16, marginTop: 10, backgroundColor: GREEN,
    borderRadius: 14, paddingVertical: 14,
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  loyaltyCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: "#0D3B1E", borderRadius: 18, padding: 18,
  },
  loyaltyLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "600", marginBottom: 4 },
  loyaltyPoints: { fontSize: 22, fontWeight: "900", color: "#fff" },
  loyaltyPtSuffix: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "600" },

  promoBanner: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: GREEN_LIGHT,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: GREEN_BORDER,
  },
  promoTag: {
    backgroundColor: "#D1FAE5", borderRadius: 20, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  promoTagText: { fontSize: 10, fontWeight: "700", color: "#2E7D32" },
  promoTitle: { fontSize: 20, fontWeight: "800", color: GREEN, marginBottom: 8 },
  promoCode: {
    fontSize: 14, fontWeight: "700", color: GREEN, backgroundColor: "#D1FAE5",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start",
    overflow: "hidden",
  },

  section: { marginTop: 24 },
  carousel: { paddingHorizontal: 16, paddingBottom: 4 },

  featuredCard: {
    width: W - 56, borderRadius: 20, overflow: "hidden", marginRight: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  featuredPhoto: { width: "100%", height: 240 },
  featuredOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.55)", padding: 16,
  },
  featuredBadgeWrap: {
    backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "flex-start",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
  },
  featuredBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 1 },
  featuredTitle: { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 4 },
  featuredLoc: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 10 },
  featuredPrice: { fontSize: 18, fontWeight: "800", color: "#fff" },
  featuredBtn: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  featuredBtnText: { fontSize: 12, fontWeight: "700", color: GREEN },

  trendGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10 },
  trendCard: { width: (W - 48) / 2, borderRadius: 14, overflow: "hidden" },
  trendPhoto: { width: "100%", height: 140 },
  trendOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", padding: 10,
  },
  trendTitle: { color: "#fff", fontWeight: "700", fontSize: 12 },
  trendPrice: { color: "#BBF7D0", fontWeight: "700", fontSize: 12, marginTop: 2 },

  carBadge: {
    backgroundColor: GREEN_LIGHT, borderRadius: 6, alignSelf: "flex-start",
    paddingHorizontal: 7, paddingVertical: 3, marginBottom: 6,
    borderWidth: 1, borderColor: GREEN_BORDER,
  },
  carBadgeText: { fontSize: 9, fontWeight: "800", color: "#2E7D32", letterSpacing: 0.8 },

  ctaBanner: {
    marginHorizontal: 16, marginTop: 24, backgroundColor: "#0D3B1E",
    borderRadius: 20, padding: 24,
  },
  ctaTitle: { fontSize: 24, fontWeight: "900", color: "#fff", lineHeight: 30, marginBottom: 10 },
  ctaSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 19, marginBottom: 20 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  },
  ctaBtnText: { fontSize: 13, fontWeight: "700", color: GREEN },
});
