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

const GREEN = "#024622";
const GREEN_MID = "#015428";
const GREEN_ACCENT = "#1D8D2B";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";

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
        <TouchableOpacity style={dp.sheet} activeOpacity={1} onPress={() => {}}>
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
  title: { fontSize: 17, fontWeight: "700", color: TEXT, textAlign: "center", marginBottom: 16 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 22, color: GREEN, fontWeight: "700" },
  monthLabel: { fontSize: 16, fontWeight: "700", color: TEXT },
  dowRow: { flexDirection: "row", marginBottom: 8 },
  dow: { width: "14.28%", textAlign: "center", fontSize: 12, fontWeight: "600", color: MUTED },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  emptyCell: { width: "14.28%", height: 40 },
  cell: { width: "14.28%", height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  cellDisabled: { opacity: 0.3 },
  cellText: { fontSize: 14, fontWeight: "500", color: TEXT },
  cellTextDisabled: { color: MUTED },
  cancelBtn: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, color: MUTED, fontWeight: "600" },
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
    <TouchableOpacity style={[lc.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View>
        {!imgError && displayPhoto ? (
          <ListingImage uri={displayPhoto} style={lc.photo} onError={() => setImgError(true)} />
        ) : (
          <View style={[lc.photo, { backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ fontSize: 28 }}>{isCar ? "🚗" : "🏨"}</Text>
          </View>
        )}
        {badgeLabel ? (
          <View style={[lc.badge, { backgroundColor: badgeColor ?? GREEN_ACCENT }]}>
            <Text style={lc.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
        {item.starRating != null && item.starRating > 0 ? (
          <View style={lc.ratingBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={lc.ratingText}>{item.starRating}</Text>
          </View>
        ) : null}
      </View>
      <View style={lc.body}>
        <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
        <View style={lc.row}>
          <Ionicons name="location-outline" size={11} color={MUTED} />
          <Text style={lc.loc} numberOfLines={1}>
            {item.city}{item.distanceKm != null ? ` · ${item.distanceKm.toFixed(1)}km` : ""}
          </Text>
        </View>
        <Text style={lc.price}>
          {fmtPrice(rate, item.currency)}<Text style={lc.priceUnit}>/{unit}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const lc = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  photo: { width: "100%", height: 130 },
  badge: { position: "absolute", top: 10, left: 10, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
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
  price: { fontSize: 14, fontWeight: "800", color: GREEN_ACCENT },
  priceUnit: { fontSize: 10, fontWeight: "400", color: MUTED },
});

// ── Destination Card ──────────────────────────────────────────────────────────

function DestinationCard({ name, country, from, photoUri, onPress }: {
  name: string; country: string; from: string; photoUri?: string | null; onPress: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <TouchableOpacity style={dc.card} onPress={onPress} activeOpacity={0.85}>
      {!imgError && photoUri ? (
        <ListingImage uri={photoUri} style={dc.photo} onError={() => setImgError(true)} />
      ) : (
        <View style={[dc.photo, { backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 28 }}>🏖️</Text>
        </View>
      )}
      <View style={dc.overlay}>
        <Text style={dc.name}>{name}</Text>
        <Text style={dc.country}>{country}</Text>
        <Text style={dc.from}>{from}</Text>
      </View>
    </TouchableOpacity>
  );
}

const dc = StyleSheet.create({
  card: { width: (W - 48) / 3, borderRadius: 12, overflow: "hidden", marginRight: 8 },
  photo: { width: "100%", height: 120 },
  overlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", padding: 8,
  },
  name: { color: "#fff", fontWeight: "700", fontSize: 12 },
  country: { color: "rgba(255,255,255,0.8)", fontSize: 10 },
  from: { color: "#BBF7D0", fontSize: 10, fontWeight: "600", marginTop: 2 },
});

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const firstName = user?.firstName ?? "Explorer";

  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [datePicker, setDatePicker] = useState<"checkIn" | "checkOut" | null>(null);

  const { data: hotelsData, isLoading: hotelsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-hotels"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=hotel&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30");
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  const { data: apartmentsData, isLoading: aptsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-apartments"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=apartment&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30");
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  const { data: carsData } = useQuery<SearchResult[]>({
    queryKey: ["home-cars"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=car&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30");
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  const bestOffers = [
    ...(hotelsData ?? []).filter((h) => h.listingType !== "car" && h.nightlyRate != null),
    ...(apartmentsData ?? []).filter((a) => a.listingType !== "car"),
  ].slice(0, 8);

  const popularHotels = (hotelsData ?? []).filter((h) => h.listingType !== "car").slice(0, 3);

  const displayedIds = useMemo(() => {
    const ids = new Set<string>();
    [...bestOffers, ...popularHotels].forEach((item) => ids.add(item.id));
    return Array.from(ids);
  }, [bestOffers, popularHotels]);

  const photoQueries = useQueries({
    queries: displayedIds.map((id) => ({
      queryKey: ["photo-v2", id],
      queryFn: async (): Promise<string | null> => {
        try {
          const res = await listingApi.get<{ data: { primaryPhotoUrl?: string; photos: Array<{ cdnUrl: string }> } }>(`/listings/${id}/public`);
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

  function navToListing(id: string) {
    const params: Record<string, string> = {};
    if (checkIn) params.checkIn = formatLocalDate(checkIn);
    if (checkOut) params.checkOut = formatLocalDate(checkOut);
    params.guests = String(guests);
    router.push({ pathname: `/listing/${id}` as any, params });
  }

  function handleSearch() {
    const params: Record<string, string> = { category: "hotel", guests: String(guests) };
    if (location.trim()) params.placeName = location.trim();
    if (checkIn) params.checkIn = formatLocalDate(checkIn);
    if (checkOut) params.checkOut = formatLocalDate(checkOut);
    router.push({ pathname: "/search", params });
  }

  const allLoading = hotelsLoading || aptsLoading;

  const hotelCount = (hotelsData ?? []).length;
  const aptCount = (apartmentsData ?? []).length;
  const carCount = (carsData ?? []).length;

  return (
    <SafeAreaView style={s.safeArea} edges={["top"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Dark Green Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <TouchableOpacity style={s.menuBtn}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={s.headerText}>
              <Text style={s.greeting}>Hi, {firstName} 👋</Text>
              <Text style={s.subGreeting}>Where do you want to go?</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.notifBtn}
            onPress={() => router.push("/notifications" as any)}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Search Card ── */}
        <View style={s.searchCardWrap}>
          <View style={s.searchCard}>
            {/* Where to */}
            <View style={s.searchRow}>
              <Ionicons name="location-outline" size={20} color={GREEN_ACCENT} style={{ marginRight: 10 }} />
              <TextInput
                style={s.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Where to?"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={s.divider} />

            {/* Dates */}
            <View style={s.datesRow}>
              <TouchableOpacity style={s.dateField} onPress={() => setDatePicker("checkIn")} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={16} color={GREEN_ACCENT} style={{ marginRight: 8 }} />
                <View>
                  <Text style={s.fieldLabel}>Check-in</Text>
                  <Text style={[s.fieldValue, !checkIn && s.fieldPlaceholder]}>
                    {checkIn ? fmtDate(checkIn) : "May 20, 2025"}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={s.vertDivider} />
              <TouchableOpacity style={s.dateField} onPress={() => setDatePicker("checkOut")} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={16} color={GREEN_ACCENT} style={{ marginRight: 8 }} />
                <View>
                  <Text style={s.fieldLabel}>Check-out</Text>
                  <Text style={[s.fieldValue, !checkOut && s.fieldPlaceholder]}>
                    {checkOut ? fmtDate(checkOut) : "May 25, 2025"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={s.divider} />

            {/* Guests */}
            <View style={s.searchRow}>
              <Ionicons name="person-outline" size={20} color={GREEN_ACCENT} style={{ marginRight: 10 }} />
              <Text style={s.guestsLabel}>Guests</Text>
              <View style={s.guestsRight}>
                <Text style={s.guestsValue}>
                  {guests} {guests === 1 ? "Adult" : "Adults"}, 1 Child
                </Text>
                <View style={s.guestsCounter}>
                  <TouchableOpacity
                    style={s.guestBtn}
                    onPress={() => setGuests(g => Math.max(1, g - 1))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={s.guestBtnText}>−</Text>
                  </TouchableOpacity>
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

            {/* Search button */}
            <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
              <Text style={s.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

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

        {/* ── Explore by Category ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Explore by category</Text>
            <TouchableOpacity onPress={() => router.push("/browse/hotels" as any)}>
              <Text style={s.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={s.catRow}>
            {[
              { label: "Hotels", count: `${hotelCount > 0 ? "12,450" : "0"}+`, icon: "business", route: "/browse/hotels" },
              { label: "Apartments", count: `${aptCount > 0 ? "8,230" : "0"}+`, icon: "home", route: "/browse/apartments" },
              { label: "Car Rentals", count: `${carCount > 0 ? "5,620" : "0"}+`, icon: "car", route: "/browse/cars" },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.label}
                style={s.catCard}
                onPress={() => router.push(cat.route as any)}
                activeOpacity={0.8}
              >
                <View style={s.catIconWrap}>
                  <Ionicons name={cat.icon as any} size={28} color={GREEN_ACCENT} />
                </View>
                <Text style={s.catLabel}>{cat.label}</Text>
                <Text style={s.catCount}>{cat.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Best Offer Banner ── */}
        <View style={s.offerBanner}>
          <View style={s.offerLeft}>
            <Text style={s.offerTag}>Best Offer</Text>
            <Text style={s.offerTitle}>30% OFF on Hotels</Text>
            <Text style={s.offerSub}>Limited time offer. Book now!</Text>
            <TouchableOpacity
              style={s.offerBtn}
              onPress={() => router.push("/browse/hotels" as any)}
            >
              <Text style={s.offerBtnText}>View Deals</Text>
            </TouchableOpacity>
          </View>
          <View style={s.offerBadge}>
            <Text style={s.offerBadgeNum}>30%</Text>
            <Text style={s.offerBadgeSub}>OFF</Text>
          </View>
        </View>

        {/* ── Best Offers ── */}
        {bestOffers.length > 0 || allLoading ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Best Offers & Deals</Text>
              <TouchableOpacity onPress={() => router.push("/browse/hotels" as any)}>
                <Text style={s.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            {allLoading ? (
              <ActivityIndicator color={GREEN_ACCENT} style={{ marginLeft: 16 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
                {bestOffers.map((item, idx) => (
                  <View key={item.id} style={{ marginRight: idx < bestOffers.length - 1 ? 12 : 0 }}>
                    <ListingCard
                      item={item} width={200}
                      badgeLabel={item.longStayDiscountEnabled ? "LONG STAY" : "BEST DEAL"}
                      badgeColor={item.longStayDiscountEnabled ? "#8B5CF6" : "#DC2626"}
                      photoUrl={photoMap[item.id]}
                      onPress={() => navToListing(item.id)}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {/* ── Popular Destinations ── */}
        {popularHotels.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Popular destinations</Text>
              <TouchableOpacity onPress={() => router.push("/browse/hotels" as any)}>
                <Text style={s.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {popularHotels.map((item) => (
                <DestinationCard
                  key={item.id}
                  name={item.city}
                  country={item.countryCode}
                  from={`From ${fmtPrice(item.nightlyRate, item.currency)}/Night`}
                  photoUri={photoMap[item.id] ?? item.primaryPhotoUrl}
                  onPress={() => navToListing(item.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: GREEN },
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingBottom: 20, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, backgroundColor: GREEN,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  menuBtn: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 18, fontWeight: "700", color: "#fff" },
  subGreeting: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },

  // Search card
  searchCardWrap: {
    backgroundColor: GREEN, paddingHorizontal: 16, paddingBottom: 20,
  },
  searchCard: {
    backgroundColor: "#fff", borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  locationInput: { flex: 1, fontSize: 15, color: TEXT, fontWeight: "500" },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 0 },
  vertDivider: { width: 1, backgroundColor: BORDER, marginVertical: 8 },
  datesRow: { flexDirection: "row" },
  dateField: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fieldLabel: { fontSize: 11, color: MUTED, fontWeight: "600", marginBottom: 2 },
  fieldValue: { fontSize: 13, fontWeight: "600", color: TEXT },
  fieldPlaceholder: { color: MUTED, fontWeight: "400" },
  guestsLabel: { flex: 1, fontSize: 15, color: TEXT, fontWeight: "500" },
  guestsRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  guestsValue: { fontSize: 13, color: MUTED },
  guestsCounter: { flexDirection: "row", gap: 8 },
  guestBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: GREEN_ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  guestBtnText: { fontSize: 18, color: "#fff", fontWeight: "700", lineHeight: 22 },
  searchBtn: {
    margin: 12, backgroundColor: GREEN_ACCENT,
    borderRadius: 12, paddingVertical: 14,
    alignItems: "center",
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Section
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: TEXT },
  viewAll: { fontSize: 13, color: GREEN_ACCENT, fontWeight: "700" },

  // Category
  catRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12 },
  catCard: {
    flex: 1, alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, paddingVertical: 18, paddingHorizontal: 8,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  catIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#F0FDF4",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  catLabel: { fontSize: 12, fontWeight: "700", color: TEXT, marginBottom: 4 },
  catCount: { fontSize: 11, color: MUTED },

  // Best Offer Banner
  offerBanner: {
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: GREEN,
    borderRadius: 16, padding: 20,
    flexDirection: "row", alignItems: "center",
  },
  offerLeft: { flex: 1 },
  offerTag: {
    color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
  },
  offerTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4 },
  offerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 14 },
  offerBtn: {
    backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start",
  },
  offerBtnText: { fontSize: 13, fontWeight: "700", color: GREEN },
  offerBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#DC2626",
    alignItems: "center", justifyContent: "center",
    marginLeft: 16,
  },
  offerBadgeNum: { fontSize: 16, fontWeight: "900", color: "#fff" },
  offerBadgeSub: { fontSize: 10, fontWeight: "700", color: "#fff" },

  carousel: { paddingHorizontal: 16, paddingBottom: 4 },
});
