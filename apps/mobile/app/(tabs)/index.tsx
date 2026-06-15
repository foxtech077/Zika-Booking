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
import { K } from "../../constants/theme";

const { width: W } = Dimensions.get("window");

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
  overlay: { flex: 1, backgroundColor: K.colors.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: K.colors.bgCard, borderTopLeftRadius: K.radius.xxl, borderTopRightRadius: K.radius.xxl, padding: K.spacing.xxl, paddingBottom: 40, borderWidth: 1, borderColor: K.colors.border },
  title: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, textAlign: "center", marginBottom: K.spacing.lg },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: K.spacing.md },
  navBtn: { padding: K.spacing.sm },
  navArrow: { fontSize: K.font.xl + 2, color: K.colors.accent, fontWeight: "700" },
  monthLabel: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  dowRow: { flexDirection: "row", marginBottom: K.spacing.sm },
  dow: { width: "14.28%", textAlign: "center", fontSize: K.font.xs, fontWeight: "600", color: K.colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  emptyCell: { width: "14.28%", height: 40 },
  cell: { width: "14.28%", height: 40, alignItems: "center", justifyContent: "center", borderRadius: K.radius.full },
  cellDisabled: { opacity: 0.3 },
  cellText: { fontSize: K.font.sm + 1, fontWeight: "500", color: K.colors.textDark },
  cellTextDisabled: { color: K.colors.textSubtle },
  cancelBtn: { marginTop: K.spacing.lg, alignItems: "center", paddingVertical: K.spacing.md },
  cancelText: { fontSize: K.font.base, color: K.colors.textMuted, fontWeight: "600" },
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
          <View style={[c.photo, { backgroundColor: K.colors.darkGreenMid, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ fontSize: 28 }}>{isCar ? "🚗" : "🏨"}</Text>
          </View>
        )}
        {badgeLabel ? (
          <View style={[c.badge, { backgroundColor: badgeColor ?? K.colors.accent }]}>
            <Text style={c.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
        {item.starRating != null && item.starRating > 0 ? (
          <View style={c.ratingBadge}>
            <Ionicons name="star" size={10} color={K.colors.warning} />
            <Text style={c.ratingText}>{item.starRating}</Text>
          </View>
        ) : null}
      </View>
      <View style={c.body}>
        <Text style={c.title} numberOfLines={1}>{item.title}</Text>
        <View style={c.row}>
          <Ionicons name="location-outline" size={11} color={K.colors.textMuted} />
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
    backgroundColor: K.colors.bgCard, borderRadius: K.radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  photo: { width: "100%", height: 130 },
  badge: {
    position: "absolute", top: 10, left: 10,
    borderRadius: K.radius.full, paddingHorizontal: K.spacing.sm, paddingVertical: 4,
  },
  badgeText: { color: "#051008", fontSize: K.font.xs, fontWeight: "700" },
  ratingBadge: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: K.colors.overlay, borderRadius: K.radius.sm,
    paddingHorizontal: 6, paddingVertical: 3,
    flexDirection: "row", alignItems: "center", gap: 3,
  },
  ratingText: { color: K.colors.textLight, fontSize: K.font.xs, fontWeight: "700" },
  body: { padding: K.spacing.sm + 2 },
  title: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 5 },
  loc: { fontSize: K.font.xs, color: K.colors.textMuted, flex: 1 },
  price: { fontSize: K.font.sm + 1, fontWeight: "800", color: K.colors.accent },
  priceUnit: { fontSize: K.font.xs, fontWeight: "400", color: K.colors.textMuted },
});

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {onMore ? (
        <TouchableOpacity onPress={onMore}>
          <Text style={sh.more}>View More</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: K.spacing.md, paddingHorizontal: K.spacing.lg },
  title: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark },
  more: { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "700" },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalISOString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const offset = -d.getTimezoneOffset();
  if (offset === 0) return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`;
  const sign = offset > 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(absOffset % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${offsetHours}:${offsetMinutes}`;
}

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "hotels", label: "Hotel", icon: "business" },
  { key: "apartments", label: "Apartment", icon: "home" },
  { key: "cars", label: "Car", icon: "car" },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const firstName = user?.firstName ?? "Explorer";
  const lastName = (user as any)?.lastName ?? "";
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
  const [showSearchModal, setShowSearchModal] = useState(false);

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

  const bestOffers = [
    ...(hotelsData ?? []).filter((h) => h.listingType !== "car" && h.nightlyRate != null && h.nightlyRate <= 15000),
    ...(apartmentsData ?? []).filter((a) => a.listingType !== "car" && a.longStayDiscountEnabled),
  ].slice(0, 8);

  const recommended = [
    ...(hotelsData ?? []).filter((h) => h.listingType !== "car" && ((h.starRating ?? 0) >= 4 || h.isAccredited)),
    ...(apartmentsData ?? []).filter((a) => a.listingType !== "car" && a.isAccredited),
  ].slice(0, 8);

  // The hero featured listing — best available
  const featuredListing = recommended[0] ?? bestOffers[0] ?? hotelsData?.[0] ?? null;

  const displayedIds = useMemo(() => {
    const ids = new Set<string>();
    [...bestOffers, ...recommended].forEach((item) => ids.add(item.id));
    if (featuredListing) ids.add(featuredListing.id);
    return Array.from(ids);
  }, [bestOffers, recommended, featuredListing]);

  const photoQueries = useQueries({
    queries: displayedIds.map((id) => ({
      queryKey: ["photo-v2", id],
      queryFn: async (): Promise<string | null> => {
        try {
          const res = await listingApi.get<{ data: { primaryPhotoUrl?: string; photos: Array<{ cdnUrl: string }> } }>(
            `/listings/${id}/public`
          );
          return res.data.data?.primaryPhotoUrl ?? res.data.data?.photos?.[0]?.cdnUrl ?? null;
        } catch {
          return null;
        }
      },
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
      if (checkIn) params.checkIn = formatLocalDate(checkIn);
      if (checkOut) params.checkOut = formatLocalDate(checkOut);
      params.guests = String(guests);
    } else {
      if (pickupDate) params.pickupDatetime = formatLocalISOString(pickupDate);
      if (returnDate) params.returnDatetime = formatLocalISOString(returnDate);
    }
    router.push({ pathname: `/listing/${id}` as any, params });
  }

  function handleSearch() {
    const apiCat = category === "cars" ? "car" : category === "apartments" ? "apartment" : "hotel";
    const params: Record<string, string> = { category: apiCat, guests: String(guests) };
    if (location.trim()) params.placeName = location.trim();
    if (category !== "cars") {
      if (checkIn) params.checkIn = formatLocalDate(checkIn);
      if (checkOut) params.checkOut = formatLocalDate(checkOut);
    } else {
      if (pickupDate) params.pickupDatetime = formatLocalISOString(pickupDate);
      if (returnDate) params.returnDatetime = formatLocalISOString(returnDate);
    }
    router.push({ pathname: "/search", params });
  }

  function detectUserLocation() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const apiCat = category === "cars" ? "car" : category === "apartments" ? "apartment" : "hotel";
          router.push({ pathname: "/search", params: { category: apiCat, guests: String(guests), geoLat: String(latitude), geoLng: String(longitude) } });
        },
        () => Alert.alert("Location Error", "Could not get your location.")
      );
    }
  }

  function getTierColor() {
    const map: Record<string, string> = {
      bronze: K.colors.tierBronze,
      silver: K.colors.tierSilver,
      gold: K.colors.tierGold,
      diamond: K.colors.tierDiamond,
    };
    return map[currentTier] ?? K.colors.tierSilver;
  }

  const allLoading = hotelsLoading || aptsLoading || carsLoading;

  return (
    <SafeAreaView style={s.container}>
      {/* ── Date Picker Modals ── */}
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
          const dt = new Date(d); dt.setHours(10, 0, 0, 0);
          setPickupDate(dt);
          if (returnDate && dt >= returnDate) setReturnDate(null);
        }}
        onClose={() => setDatePicker(null)}
      />
      <DatePickerModal
        visible={datePicker === "return"}
        title="Select Return Date"
        minDate={pickupDate ?? undefined}
        onSelect={d => { const dt = new Date(d); dt.setHours(10, 0, 0, 0); setReturnDate(dt); }}
        onClose={() => setDatePicker(null)}
      />

      {/* ── Search Bottom Sheet ── */}
      <Modal visible={showSearchModal} transparent animationType="slide" onRequestClose={() => setShowSearchModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: K.colors.overlay }} activeOpacity={1} onPress={() => setShowSearchModal(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Find your perfect stay</Text>

          {/* Location */}
          <View style={s.sheetRow}>
            <Ionicons name="location-outline" size={18} color={K.colors.accent} style={{ marginRight: 10 }} />
            <TextInput
              style={s.sheetInput}
              value={location}
              onChangeText={setLocation}
              placeholder="City, country…"
              placeholderTextColor={K.colors.textSubtle}
            />
            <TouchableOpacity onPress={detectUserLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="navigate" size={18} color={K.colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Dates */}
          {category !== "cars" ? (
            <View style={s.sheetDatesRow}>
              <TouchableOpacity style={s.sheetDateBtn} onPress={() => setDatePicker("checkIn")}>
                <Ionicons name="calendar-outline" size={15} color={K.colors.accent} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.sheetDateLabel}>Check-in</Text>
                  <Text style={s.sheetDateValue}>{fmtDate(checkIn)}</Text>
                </View>
              </TouchableOpacity>
              <View style={s.sheetDateGap} />
              <TouchableOpacity style={s.sheetDateBtn} onPress={() => setDatePicker("checkOut")}>
                <Ionicons name="calendar-outline" size={15} color={K.colors.accent} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.sheetDateLabel}>Check-out</Text>
                  <Text style={s.sheetDateValue}>{fmtDate(checkOut)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.sheetDatesRow}>
              <TouchableOpacity style={s.sheetDateBtn} onPress={() => setDatePicker("pickup")}>
                <Ionicons name="calendar-outline" size={15} color={K.colors.accent} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.sheetDateLabel}>Pickup</Text>
                  <Text style={s.sheetDateValue}>{fmtDate(pickupDate)}</Text>
                </View>
              </TouchableOpacity>
              <View style={s.sheetDateGap} />
              <TouchableOpacity style={s.sheetDateBtn} onPress={() => setDatePicker("return")}>
                <Ionicons name="calendar-outline" size={15} color={K.colors.accent} style={{ marginRight: 6 }} />
                <View>
                  <Text style={s.sheetDateLabel}>Return</Text>
                  <Text style={s.sheetDateValue}>{fmtDate(returnDate)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Guests */}
          <View style={s.sheetRow}>
            <Ionicons name="people-outline" size={16} color={K.colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={s.sheetGuestLabel}>Guests</Text>
            <View style={s.guestsCounter}>
              <TouchableOpacity style={s.guestBtn} onPress={() => setGuests(g => Math.max(1, g - 1))}>
                <Text style={s.guestBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.guestCount}>{guests}</Text>
              <TouchableOpacity style={s.guestBtn} onPress={() => setGuests(g => Math.min(20, g + 1))}>
                <Text style={s.guestBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search CTA */}
          <TouchableOpacity
            style={s.sheetSearchBtn}
            onPress={() => { setShowSearchModal(false); handleSearch(); }}
            activeOpacity={0.85}
          >
            <Ionicons name="search" size={18} color="#051008" style={{ marginRight: 8 }} />
            <Text style={s.sheetSearchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.welcomeLabel}>Welcome Back 🔥</Text>
              <Text style={s.userName}>{firstName}{lastName ? ` ${lastName}` : ""}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.notifBtn}>
            <Ionicons name="notifications" size={20} color={K.colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* ── Search Bar ── */}
        <TouchableOpacity style={s.searchBar} onPress={() => setShowSearchModal(true)} activeOpacity={0.85}>
          <Ionicons name="search" size={18} color={K.colors.textMuted} style={{ marginRight: 10 }} />
          <Text style={s.searchBarText} numberOfLines={1}>
            {location.trim() ? location : "Search for places..."}
          </Text>
          <TouchableOpacity onPress={detectUserLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="mic" size={18} color={K.colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* ── Category Pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catPill, category === cat.key && s.catPillActive]}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={cat.icon}
                size={16}
                color={category === cat.key ? "#051008" : K.colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.catPillText, category === cat.key && s.catPillTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Featured Listing Card ── */}
        {allLoading ? (
          <View style={s.featuredSkeleton}>
            <ActivityIndicator color={K.colors.accent} size="large" />
          </View>
        ) : featuredListing ? (
          (() => {
            const isCar = featuredListing.listingType === "car";
            const rate = isCar ? featuredListing.dailyRate : featuredListing.nightlyRate;
            const photo = photoMap[featuredListing.id] ?? null;
            return (
              <TouchableOpacity
                style={s.featuredCard}
                onPress={() => navToListing(featuredListing.id, isCar)}
                activeOpacity={0.88}
              >
                {photo ? (
                  <ListingImage uri={photo} style={s.featuredImg} />
                ) : (
                  <View style={[s.featuredImg, { alignItems: "center", justifyContent: "center", backgroundColor: K.colors.darkGreenMid }]}>
                    <Text style={{ fontSize: 56 }}>{isCar ? "🚗" : "🏨"}</Text>
                  </View>
                )}
                {/* Heart */}
                <View style={s.heartBtn}>
                  <Ionicons name="heart-outline" size={18} color="#fff" />
                </View>
                {/* Info overlay */}
                <View style={s.featuredOverlay}>
                  <View style={s.featuredOverlayTop}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={s.featuredTitle} numberOfLines={1}>{featuredListing.title}</Text>
                      <Text style={s.featuredLoc} numberOfLines={1}>
                        {featuredListing.city}{featuredListing.countryCode ? `, ${featuredListing.countryCode}` : ""}
                      </Text>
                    </View>
                    {rate != null && (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={s.featuredPrice}>
                          {featuredListing.currency} {rate.toLocaleString()}
                        </Text>
                        <Text style={s.featuredPriceUnit}>/{isCar ? "day" : "night"}</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.featuredBadgesRow}>
                    <View style={s.featuredBadge}>
                      <Ionicons name="moon-outline" size={10} color={K.colors.accent} />
                      <Text style={s.featuredBadgeText}>Night</Text>
                    </View>
                    {featuredListing.starRating != null && featuredListing.starRating > 0 && (
                      <View style={s.featuredBadge}>
                        <Ionicons name="star" size={10} color={K.colors.warning} />
                        <Text style={[s.featuredBadgeText, { color: K.colors.textLightMuted }]}>
                          {featuredListing.starRating}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()
        ) : null}

        {/* ── Best Offers ── */}
        {bestOffers.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Best Offers" onMore={() => router.push("/browse/hotels" as any)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {bestOffers.map((item, idx) => (
                <View key={item.id} style={{ marginRight: idx < bestOffers.length - 1 ? 12 : 0 }}>
                  <ListingCard
                    item={item}
                    width={190}
                    badgeLabel={item.longStayDiscountEnabled ? "LONG STAY" : "DEAL"}
                    badgeColor={item.longStayDiscountEnabled ? "#8B5CF6" : K.colors.error}
                    photoUrl={photoMap[item.id]}
                    onPress={() => navToListing(item.id, false)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Recommended ── */}
        {recommended.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Recommended Stays" onMore={() => router.push("/browse/hotels" as any)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {recommended.map((item, idx) => (
                <View key={item.id} style={{ marginRight: idx < recommended.length - 1 ? 12 : 0 }}>
                  <ListingCard
                    item={item}
                    width={190}
                    badgeLabel="TOP RATED"
                    badgeColor={K.colors.warning}
                    photoUrl={photoMap[item.id]}
                    onPress={() => navToListing(item.id, false)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── KAI Points ── */}
        {user && (
          <View style={s.loyaltyCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.loyaltyLabel}>KAI-Points Balance</Text>
              <Text style={s.loyaltyPoints}>
                {loyaltyPoints.toLocaleString()}{" "}
                <Text style={s.loyaltyPtSuffix}>KAI-Points</Text>
              </Text>
              <View style={s.tierRow}>
                <View style={[s.tierDot, { backgroundColor: getTierColor() }]} />
                <Text style={s.tierLabel}>
                  {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Member
                </Text>
              </View>
            </View>
            <Ionicons name="diamond-outline" size={36} color="rgba(255,255,255,0.20)" />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgSubtle },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // ── Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: K.spacing.lg, paddingTop: K.spacing.md, paddingBottom: K.spacing.xl,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: K.spacing.md },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: K.colors.darkGreenCard,
    borderWidth: 2, borderColor: K.colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: K.font.xl, fontWeight: "900", color: K.colors.accent },
  welcomeLabel: { fontSize: K.font.xs, color: K.colors.textMuted, fontWeight: "500", marginBottom: 2 },
  userName: { fontSize: K.font.base + 1, fontWeight: "800", color: K.colors.textDark },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: K.colors.bgCard,
    borderWidth: 1, borderColor: K.colors.border,
    alignItems: "center", justifyContent: "center",
  },

  // ── Search bar
  searchBar: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: K.spacing.lg, marginBottom: K.spacing.xl,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.full,
    paddingHorizontal: K.spacing.lg, paddingVertical: K.spacing.md + 2,
    borderWidth: 1, borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  searchBarText: { flex: 1, fontSize: K.font.sm + 1, color: K.colors.textMuted, fontWeight: "500" },

  // ── Category pills
  catScroll: { paddingHorizontal: K.spacing.lg, paddingBottom: K.spacing.xl, gap: 10 },
  catPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: K.spacing.lg, paddingVertical: K.spacing.sm + 2,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgCard,
    borderWidth: 1, borderColor: K.colors.border,
  },
  catPillActive: { backgroundColor: K.colors.accent, borderColor: K.colors.accent },
  catPillText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textMuted },
  catPillTextActive: { color: "#051008" },

  // ── Featured card
  featuredCard: {
    marginHorizontal: K.spacing.lg,
    borderRadius: K.radius.xxl,
    overflow: "hidden",
    marginBottom: K.spacing.xxl,
    ...K.shadow.lg,
  },
  featuredSkeleton: {
    marginHorizontal: K.spacing.lg,
    height: 300, borderRadius: K.radius.xxl,
    backgroundColor: K.colors.bgCard,
    alignItems: "center", justifyContent: "center",
    marginBottom: K.spacing.xxl,
    borderWidth: 1, borderColor: K.colors.border,
  },
  featuredImg: { width: "100%", height: 300 },
  heartBtn: {
    position: "absolute", top: K.spacing.md, right: K.spacing.md,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1, borderColor: K.colors.glassBorder,
    alignItems: "center", justifyContent: "center",
  },
  featuredOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: K.colors.glassBgStrong,
    padding: K.spacing.lg,
    borderTopWidth: 1, borderTopColor: K.colors.glassBorder,
  },
  featuredOverlayTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: K.spacing.sm },
  featuredTitle: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textLight, marginBottom: 2 },
  featuredLoc: { fontSize: K.font.xs, color: K.colors.textLightMuted },
  featuredPrice: { fontSize: K.font.base + 1, fontWeight: "800", color: K.colors.textLight },
  featuredPriceUnit: { fontSize: K.font.xs, color: K.colors.textLightDim },
  featuredBadgesRow: { flexDirection: "row", gap: K.spacing.sm },
  featuredBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.full,
    paddingHorizontal: K.spacing.sm + 2, paddingVertical: 3,
    borderWidth: 1, borderColor: K.colors.glassBorder,
  },
  featuredBadgeText: { fontSize: K.font.xs, color: K.colors.accent, fontWeight: "700" },

  // ── Sections
  section: { marginBottom: K.spacing.xxl },
  carousel: { paddingHorizontal: K.spacing.lg, paddingBottom: 4 },

  // ── Loyalty card
  loyaltyCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: K.spacing.lg, marginBottom: K.spacing.lg,
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl, padding: K.spacing.xl,
    borderWidth: 1, borderColor: K.colors.border,
  },
  loyaltyLabel: { fontSize: K.font.xs, color: K.colors.textLightDim, fontWeight: "600", marginBottom: 4 },
  loyaltyPoints: { fontSize: K.font.xl + 2, fontWeight: "900", color: K.colors.textLight },
  loyaltyPtSuffix: { fontSize: K.font.xs, fontWeight: "500", color: K.colors.textLightMuted },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  tierDot: { width: 8, height: 8, borderRadius: K.radius.full },
  tierLabel: { fontSize: K.font.xs, color: K.colors.textLightMuted, fontWeight: "600" },

  // ── Search bottom sheet
  sheet: {
    backgroundColor: K.colors.bgCard,
    borderTopLeftRadius: K.radius.xxl, borderTopRightRadius: K.radius.xxl,
    padding: K.spacing.xxl, paddingBottom: 44,
    borderWidth: 1, borderColor: K.colors.border,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: K.colors.border,
    alignSelf: "center", marginBottom: K.spacing.xl,
  },
  sheetTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: K.spacing.lg },
  sheetRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: K.colors.bgSection,
    borderRadius: K.radius.lg,
    paddingHorizontal: K.spacing.lg, paddingVertical: K.spacing.md + 2,
    marginBottom: K.spacing.md,
    borderWidth: 1, borderColor: K.colors.border,
  },
  sheetInput: { flex: 1, fontSize: K.font.base, color: K.colors.textDark, fontWeight: "500" },
  sheetDatesRow: { flexDirection: "row", marginBottom: K.spacing.md },
  sheetDateBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: K.colors.bgSection,
    borderRadius: K.radius.lg,
    paddingHorizontal: K.spacing.md, paddingVertical: K.spacing.md,
    borderWidth: 1, borderColor: K.colors.border,
  },
  sheetDateGap: { width: K.spacing.sm },
  sheetDateLabel: { fontSize: K.font.xs, color: K.colors.textMuted, fontWeight: "600", marginBottom: 2 },
  sheetDateValue: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark },
  sheetGuestLabel: { flex: 1, fontSize: K.font.sm + 1, color: K.colors.textDark, fontWeight: "500" },
  guestsCounter: { flexDirection: "row", alignItems: "center", gap: K.spacing.lg },
  guestBtn: {
    width: 32, height: 32, borderRadius: K.radius.full,
    backgroundColor: K.colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  guestBtnText: { fontSize: K.font.xl, color: "#051008", fontWeight: "700", lineHeight: 24 },
  guestCount: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, minWidth: 20, textAlign: "center" },
  sheetSearchBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: K.spacing.sm,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.lg,
    paddingVertical: K.spacing.lg,
  },
  sheetSearchBtnText: { color: "#051008", fontSize: K.font.lg, fontWeight: "800" },
});
