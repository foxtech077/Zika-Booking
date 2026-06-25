import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null, currency: string): string {
  if (!n) return "";
  return `${currency} ${n.toLocaleString()}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return "Select date";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Date Picker ───────────────────────────────────────────────────────────────

function DatePickerModal({ visible, title, minDate, onSelect, onClose }: {
  visible: boolean; title: string; minDate?: Date;
  onSelect: (d: Date) => void; onClose: () => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());

  function prevMonth() { if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1); }
  function nextMonth() { if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1); }

  const firstDay    = new Date(yr, mo, 1).getDay();
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
          <View style={dp.handle} />
          <Text style={dp.title}>{title}</Text>
          <View style={dp.navRow}>
            <TouchableOpacity onPress={prevMonth} style={dp.navBtn}>
              <Ionicons name="chevron-back" size={20} color={K.colors.darkGreen} />
            </TouchableOpacity>
            <Text style={dp.monthLabel}>{MONTHS[mo]} {yr}</Text>
            <TouchableOpacity onPress={nextMonth} style={dp.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={K.colors.darkGreen} />
            </TouchableOpacity>
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
                  key={day}
                  style={[dp.cell, disabled && dp.cellDisabled]}
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
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: "#fff", borderTopLeftRadius: K.radius.modal, borderTopRightRadius: K.radius.modal, padding: 24, paddingBottom: 44 },
  handle:      { width: 40, height: 4, backgroundColor: K.colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  title:       { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, textAlign: "center", marginBottom: 20 },
  navRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  navBtn:      { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: K.radius.full, backgroundColor: K.colors.bgSubtle },
  monthLabel:  { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  dowRow:      { flexDirection: "row", marginBottom: 8 },
  dow:         { width: "14.28%", textAlign: "center", fontSize: 12, fontWeight: "700", color: K.colors.textMuted },
  grid:        { flexDirection: "row", flexWrap: "wrap" },
  emptyCell:   { width: "14.28%", height: 44 },
  cell:        { width: "14.28%", height: 44, alignItems: "center", justifyContent: "center", borderRadius: K.radius.full },
  cellDisabled: { opacity: 0.25 },
  cellText:    { fontSize: 14, fontWeight: "500", color: K.colors.textDark },
  cellTextDisabled: { color: K.colors.textMuted },
  cancelBtn:   { marginTop: 20, alignItems: "center", paddingVertical: 14 },
  cancelText:  { fontSize: K.font.base, color: K.colors.textMuted, fontWeight: "600" },
});

// ── Listing Card (vertical, for horizontal scrolls) ──────────────────────────

function ListingCard({ item, onPress, width = 220, badgeLabel, badgeColor, photoUrl }: {
  item: SearchResult; onPress: () => void; width?: number;
  badgeLabel?: string; badgeColor?: string; photoUrl?: string | null;
}) {
  const isCar   = item.listingType === "car";
  const rate    = isCar ? item.dailyRate : item.nightlyRate;
  const unit    = isCar ? "day" : "night";
  const [imgErr, setImgErr] = useState(false);
  const displayPhoto = photoUrl ?? item.primaryPhotoUrl;

  return (
    <TouchableOpacity style={[lc.card, { width }]} onPress={onPress} activeOpacity={0.88}>
      <View style={lc.imgWrap}>
        {!imgErr && displayPhoto ? (
          <ListingImage uri={displayPhoto} style={lc.photo} onError={() => setImgErr(true)} />
        ) : (
          <View style={[lc.photo, lc.photoFallback]}>
            <Text style={{ fontSize: 32 }}>{isCar ? "🚗" : "🏨"}</Text>
          </View>
        )}
        {badgeLabel ? (
          <View style={[lc.badge, { backgroundColor: badgeColor ?? K.colors.accent }]}>
            <Text style={lc.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
        {item.starRating != null && item.starRating > 0 ? (
          <View style={lc.ratingPill}>
            <Ionicons name="star" size={10} color="#f5b31a" />
            <Text style={lc.ratingText}>{item.starRating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <View style={lc.body}>
        <Text style={lc.title} numberOfLines={1}>{item.title}</Text>
        <View style={lc.locRow}>
          <Ionicons name="location-outline" size={12} color={K.colors.textMuted} />
          <Text style={lc.loc} numberOfLines={1}>
            {item.city}{item.distanceKm != null ? ` · ${item.distanceKm.toFixed(1)} km` : ""}
          </Text>
        </View>
        <View style={lc.priceRow}>
          <Text style={lc.price}>{fmtPrice(rate, item.currency)}</Text>
          <Text style={lc.priceUnit}>/{unit}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const lc = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  imgWrap: { position: "relative" },
  photo:   { width: "100%", height: 155 },
  photoFallback: {
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText:  { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  ratingPill: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.60)",
    borderRadius: K.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  body:       { padding: 12 },
  title:      { fontSize: 13, fontWeight: "700", color: K.colors.textDark, marginBottom: 4 },
  locRow:     { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  loc:        { fontSize: 11, color: K.colors.textMuted, flex: 1 },
  priceRow:   { flexDirection: "row", alignItems: "baseline", gap: 2 },
  price:      { fontSize: 15, fontWeight: "800", color: K.colors.darkGreen },
  priceUnit:  { fontSize: 11, fontWeight: "400", color: K.colors.textMuted },
});

// ── Destination Card ──────────────────────────────────────────────────────────

function DestinationCard({ name, country, from, photoUri, onPress }: {
  name: string; country: string; from: string; photoUri?: string | null; onPress: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const W3 = (W - 48) / 3;

  return (
    <TouchableOpacity style={[dc.card, { width: W3 }]} onPress={onPress} activeOpacity={0.88}>
      {!imgErr && photoUri ? (
        <ListingImage uri={photoUri} style={dc.photo} onError={() => setImgErr(true)} />
      ) : (
        <View style={[dc.photo, dc.photoFallback]}>
          <Text style={{ fontSize: 24 }}>🏖️</Text>
        </View>
      )}
      <View style={dc.overlay}>
        <Text style={dc.name} numberOfLines={1}>{name}</Text>
        <Text style={dc.sub}>{country}</Text>
      </View>
    </TouchableOpacity>
  );
}

const dc = StyleSheet.create({
  card:         { borderRadius: K.radius.lg, overflow: "hidden", marginRight: 10 },
  photo:        { width: "100%", height: 110 },
  photoFallback: { backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center" },
  overlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(2,25,13,0.52)",
    padding: 8,
  },
  name: { color: "#fff", fontWeight: "700", fontSize: 12, marginBottom: 1 },
  sub:  { color: "rgba(255,255,255,0.80)", fontSize: 10 },
});

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHead({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={sh.link}>View all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const sh = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: K.spacing.screen, marginBottom: 14 },
  title: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.3 },
  link:  { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "700" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? "Explorer";

  const [location,   setLocation]   = useState("");
  const [checkIn,    setCheckIn]    = useState<Date | null>(null);
  const [checkOut,   setCheckOut]   = useState<Date | null>(null);
  const [guests,     setGuests]     = useState(2);
  const [datePicker, setDatePicker] = useState<"checkIn" | "checkOut" | null>(null);

  const { data: hotelsData,    isLoading: hotelsLoading }  = useQuery<SearchResult[]>({
    queryKey: ["home-hotels"],
    queryFn:  async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=hotel&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30");
      return res.data.data.results ?? [];
    },
    staleTime: 60_000,
  });

  const { data: apartmentsData, isLoading: aptsLoading }   = useQuery<SearchResult[]>({
    queryKey: ["home-apartments"],
    queryFn:  async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=apartment&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30");
      return res.data.data.results ?? [];
    },
    staleTime: 60_000,
  });

  const { data: carsData } = useQuery<SearchResult[]>({
    queryKey: ["home-cars"],
    queryFn:  async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=car&lat=0&lng=0&radius_km=20000&sort=recommended&limit=30");
      return res.data.data.results ?? [];
    },
    staleTime: 60_000,
  });

  const { data: promotions } = useQuery<{ title: string; description: string; bannerUrl?: string | null; ctaRoute?: string }[]>({
    queryKey: ["promotions-active"],
    queryFn:  async () => {
      try {
        const res = await listingApi.get<{ data: { promotions: { title: string; description: string; bannerUrl?: string | null; ctaRoute?: string }[] } }>("/promotions/active");
        return res.data.data.promotions ?? [];
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
  });

  const { data: recentlyViewed } = useQuery<SearchResult[]>({
    queryKey: ["recently-viewed"],
    queryFn:  async () => {
      try {
        const res = await listingApi.get<{ data: { listings: SearchResult[] } }>("/guests/me/recently-viewed");
        return res.data.data.listings ?? [];
      } catch { return []; }
    },
    staleTime: 30_000,
    enabled: !!user,
  });

  const bestOffers    = [...(hotelsData ?? []).filter(h => h.nightlyRate != null), ...(apartmentsData ?? [])].slice(0, 8);
  const popularHotels = (hotelsData ?? []).filter(h => h.listingType !== "car").slice(0, 6);

  const displayedIds = useMemo(() => {
    const ids = new Set<string>();
    [...bestOffers, ...popularHotels].forEach(item => ids.add(item.id));
    return Array.from(ids);
  }, [bestOffers, popularHotels]);

  const photoQueries = useQueries({
    queries: displayedIds.map(id => ({
      queryKey: ["photo-v2", id],
      queryFn:  async (): Promise<string | null> => {
        try {
          const res = await listingApi.get<{ data: { primaryPhotoUrl?: string; photos: Array<{ cdnUrl: string }> } }>(`/listings/${id}/public`);
          return res.data.data?.primaryPhotoUrl ?? res.data.data?.photos?.[0]?.cdnUrl ?? null;
        } catch { return null; }
      },
      staleTime: 0,
      gcTime:    5 * 60_000,
      retry:     0,
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
    if (checkIn)  params.checkIn  = formatLocalDate(checkIn);
    if (checkOut) params.checkOut = formatLocalDate(checkOut);
    params.guests = String(guests);
    router.push({ pathname: `/listing/${id}` as any, params });
  }

  function handleSearch() {
    const params: Record<string, string> = { category: "hotel", guests: String(guests) };
    if (location.trim()) params.placeName = location.trim();
    if (checkIn)         params.checkIn   = formatLocalDate(checkIn);
    if (checkOut)        params.checkOut  = formatLocalDate(checkOut);
    router.push({ pathname: "/search", params });
  }

  const allLoading   = hotelsLoading || aptsLoading;
  const hotelCount   = (hotelsData ?? []).length;
  const aptCount     = (apartmentsData ?? []).length;
  const carCount     = (carsData ?? []).length;

  return (
    <SafeAreaView style={s.safeArea} edges={["top"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerText}>
              <Text style={s.greeting}>Hi, {firstName}</Text>
              <Text style={s.subGreeting}>Where do you want to go?</Text>
            </View>
          </View>
          <TouchableOpacity style={s.notifBtn} onPress={() => router.push("/notifications" as any)}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Search Card ── */}
        <View style={s.searchCardWrap}>
          <View style={s.searchCard}>
            <View style={s.searchRow}>
              <View style={s.searchIconWrap}>
                <Ionicons name="location" size={18} color={K.colors.darkGreen} />
              </View>
              <TextInput
                style={s.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Where to?"
                placeholderTextColor={K.colors.textMuted}
              />
              <TouchableOpacity
                style={s.filterBtn}
                onPress={() => router.push("/search" as any)}
              >
                <Ionicons name="options-outline" size={18} color={K.colors.darkGreen} />
              </TouchableOpacity>
            </View>
            <View style={s.searchDivider} />

            {/* Dates + Guests row */}
            <View style={s.datesGuestsRow}>
              <TouchableOpacity style={s.dateChip} onPress={() => setDatePicker("checkIn")} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={14} color={K.colors.accent} />
                <View>
                  <Text style={s.chipLabel}>Check-in</Text>
                  <Text style={[s.chipValue, !checkIn && s.chipPlaceholder]}>
                    {checkIn ? fmtDate(checkIn) : "Add date"}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={s.chipDivider} />

              <TouchableOpacity style={s.dateChip} onPress={() => setDatePicker("checkOut")} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={14} color={K.colors.accent} />
                <View>
                  <Text style={s.chipLabel}>Check-out</Text>
                  <Text style={[s.chipValue, !checkOut && s.chipPlaceholder]}>
                    {checkOut ? fmtDate(checkOut) : "Add date"}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={s.chipDivider} />

              <View style={s.guestChip}>
                <Ionicons name="person-outline" size={14} color={K.colors.accent} />
                <View>
                  <Text style={s.chipLabel}>Guests</Text>
                  <View style={s.guestCounter}>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setGuests(g => Math.max(1, g - 1))}
                    >
                      <Ionicons name="remove-circle" size={20} color={K.colors.darkGreen} />
                    </TouchableOpacity>
                    <Text style={s.guestCount}>{guests}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setGuests(g => Math.min(20, g + 1))}
                    >
                      <Ionicons name="add-circle" size={20} color={K.colors.darkGreen} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.88}>
              <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date pickers */}
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

        {/* ── Category Cards ── */}
        <View style={s.section}>
          <SectionHead title="Browse by category" onViewAll={() => router.push("/search" as any)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
            {[
              { label: "Hotels",      count: hotelCount,  icon: "business-outline",    route: "/browse/hotels"     },
              { label: "Apartments",  count: aptCount,    icon: "home-outline",         route: "/browse/apartments" },
              { label: "Car Rentals", count: carCount,    icon: "car-sport-outline",    route: "/browse/cars"       },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.label}
                style={s.catCard}
                onPress={() => router.push(cat.route as any)}
                activeOpacity={0.8}
              >
                <View style={s.catIconWrap}>
                  <Ionicons name={cat.icon as any} size={26} color={K.colors.darkGreen} />
                </View>
                <Text style={s.catLabel}>{cat.label}</Text>
                {cat.count > 0 && <Text style={s.catCount}>{cat.count}+ listings</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Featured Deals Banner ── */}
        <View style={s.bannerWrap}>
          <View style={s.banner}>
            <View style={s.bannerLeft}>
              <Text style={s.bannerEyebrow}>EXCLUSIVE DEAL</Text>
              <Text style={s.bannerTitle}>Extended Stay{"\n"}Discounts</Text>
              <Text style={s.bannerSub}>Save more on week-long stays</Text>
              <TouchableOpacity style={s.bannerBtn} onPress={() => router.push("/browse/hotels" as any)}>
                <Text style={s.bannerBtnText}>Explore</Text>
                <Ionicons name="arrow-forward" size={14} color={K.colors.darkGreen} />
              </TouchableOpacity>
            </View>
            <View style={s.bannerBadge}>
              <Text style={s.bannerBadgeIcon}>🏖️</Text>
            </View>
          </View>
        </View>

        {/* ── Best Offers ── */}
        {(bestOffers.length > 0 || allLoading) && (
          <View style={s.section}>
            <SectionHead title="Best offers" onViewAll={() => router.push("/browse/hotels" as any)} />
            {allLoading ? (
              <ActivityIndicator color={K.colors.accent} style={{ marginLeft: K.spacing.screen }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
                {bestOffers.map((item, idx) => (
                  <View key={item.id} style={{ marginRight: idx < bestOffers.length - 1 ? 14 : 0 }}>
                    <ListingCard
                      item={item}
                      width={220}
                      badgeLabel={item.longStayDiscountEnabled ? "LONG STAY" : "DEAL"}
                      badgeColor={item.longStayDiscountEnabled ? "#7c3aed" : "#dc2626"}
                      photoUrl={photoMap[item.id]}
                      onPress={() => navToListing(item.id)}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Popular Destinations ── */}
        {popularHotels.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Popular destinations" onViewAll={() => router.push("/browse/hotels" as any)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {popularHotels.map((item) => (
                <DestinationCard
                  key={item.id}
                  name={item.city}
                  country={item.countryCode}
                  from={`From ${fmtPrice(item.nightlyRate, item.currency)}/night`}
                  photoUri={photoMap[item.id] ?? item.primaryPhotoUrl}
                  onPress={() => navToListing(item.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Promotions ── */}
        {promotions && promotions.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Special offers" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {promotions.map((promo, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={s.promoCard}
                  onPress={() => promo.ctaRoute ? router.push(promo.ctaRoute as any) : router.push("/search" as any)}
                  activeOpacity={0.88}
                >
                  <Text style={s.promoEyebrow}>PROMOTION</Text>
                  <Text style={s.promoTitle} numberOfLines={2}>{promo.title}</Text>
                  <Text style={s.promoDesc} numberOfLines={2}>{promo.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Recently Viewed ── */}
        {recentlyViewed && recentlyViewed.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Recently viewed" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
              {recentlyViewed.slice(0, 8).map((item, idx) => (
                <View key={item.id} style={{ marginRight: idx < recentlyViewed.length - 1 ? 14 : 0 }}>
                  <ListingCard
                    item={item}
                    width={200}
                    onPress={() => navToListing(item.id)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: K.colors.darkGreen },
  scroll:       { flex: 1, backgroundColor: K.colors.bgApp },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: K.spacing.screen,
    paddingTop: 14,
    paddingBottom: 22,
    backgroundColor: K.colors.darkGreen,
  },
  headerLeft:   { flex: 1 },
  headerText:   {},
  greeting:     { fontSize: K.font.xl, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  subGreeting:  { fontSize: K.font.sm, color: K.colors.textLightMuted, marginTop: 3 },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search card
  searchCardWrap: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: K.spacing.screen,
    paddingBottom: 22,
  },
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    overflow: "hidden",
    ...K.shadow.md,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  locationInput: {
    flex: 1,
    fontSize: K.font.base,
    color: K.colors.textDark,
    fontWeight: "500",
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  searchDivider: {
    height: 1,
    backgroundColor: K.colors.border,
  },
  datesGuestsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  dateChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  guestChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipDivider:   { width: 1, backgroundColor: K.colors.border, marginVertical: 10 },
  chipLabel:     { fontSize: 10, fontWeight: "700", color: K.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  chipValue:     { fontSize: 12, fontWeight: "600", color: K.colors.textDark },
  chipPlaceholder: { color: K.colors.textMuted, fontWeight: "400" },
  guestCounter:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  guestCount:    { fontSize: 14, fontWeight: "700", color: K.colors.textDark, minWidth: 16, textAlign: "center" },
  searchBtn: {
    margin: 12,
    marginTop: 10,
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...K.shadow.brand,
  },
  searchBtnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700", letterSpacing: 0.2 },

  // Sections
  section: { marginTop: K.spacing.section },

  // Category
  catScroll:   { paddingHorizontal: K.spacing.screen, paddingBottom: 4, gap: 12 },
  catCard: {
    alignItems: "center",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    minWidth: 110,
    ...K.shadow.xs,
  },
  catIconWrap: {
    width: 54,
    height: 54,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  catLabel: { fontSize: 13, fontWeight: "700", color: K.colors.textDark, marginBottom: 3 },
  catCount: { fontSize: 11, color: K.colors.textMuted },

  // Banner
  bannerWrap: { paddingHorizontal: K.spacing.screen, marginTop: K.spacing.section },
  banner: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  bannerLeft:    { flex: 1 },
  bannerEyebrow: { fontSize: 10, fontWeight: "800", color: K.colors.accentLight, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  bannerTitle:   { fontSize: K.font.xl, fontWeight: "800", color: "#fff", lineHeight: 26, marginBottom: 6 },
  bannerSub:     { fontSize: 12, color: K.colors.textLightMuted, marginBottom: 16 },
  bannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: K.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignSelf: "flex-start",
  },
  bannerBtnText: { fontSize: 13, fontWeight: "700", color: K.colors.darkGreen },
  bannerBadge: {
    width: 72,
    height: 72,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },
  bannerBadgeIcon: { fontSize: 36 },

  // Carousel
  carousel: { paddingHorizontal: K.spacing.screen, paddingBottom: 4 },

  // Promotions
  promoCard: {
    width: 220,
    backgroundColor: K.colors.darkGreenMid,
    borderRadius: K.radius.xl,
    padding: 18,
    marginRight: 14,
  },
  promoEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: K.colors.accentLight,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  promoTitle: {
    fontSize: K.font.base,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    lineHeight: 22,
  },
  promoDesc: {
    fontSize: 12,
    color: K.colors.textLightMuted,
    lineHeight: 18,
  },
});
