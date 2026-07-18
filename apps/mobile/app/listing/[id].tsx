import { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, Alert, StyleSheet, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent, Modal, Platform, Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { ListingImage } from "../../components/ListingImage";
import { ActivePromotion, applyPromotion } from "../../lib/promotions";
import { RoomTypeSelector } from "../../components/listing/RoomTypeSelector";
import type { RoomType } from "../../components/listing/RoomTypeCard";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";

let MapView: any = null;
let Marker: any = null;
try {
  const Maps = require("react-native-maps");
  MapView = Maps.default || Maps;
  Marker = Maps.Marker;
} catch { /* not available in bare Expo Go */ }

const { width: W, height: H } = Dimensions.get("window");
const PHOTO_H = Math.round(H * 0.42);
const GREEN = "#15803D";
const GREEN_LIGHT = "#F0FDF4";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#FAFAFA";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Photo { id: string; cdnUrl: string; position: number; }
interface Amenity { amenityKey: string; category: string; }
interface CustomAmenity { label: string; }
interface Promotion {
  title: string; description: string;
  bannerUrl?: string | null; ctaRoute?: string;
  discountPercent?: number; expiresAt?: string;
}
interface Review {
  id: string; rating: number; title?: string | null;
  body?: string | null; createdAt: string; providerReply?: string | null;
}
interface ReviewsData { reviews: Review[]; total: number; averageRating: number; }
interface PromoBadge {
  labelText: string;
  labelColour?: string;
}

interface PublicListing {
  id: string; name: string | null; title?: string | null; category: "hotel" | "apartment" | "car"; providerId: string | null;
  status: string; description: string | null; address: string | null;
  town: string | null; country: string | null; lat: number | null; lng: number | null;
  pricePerNight: number | null; pricePerDay: number | null; currency: string | null;
  nightlyRate?: number | null; dailyRate?: number | null;
  cancellationPolicy: string | null; minStayNights: number | null;
  checkinTime: string | null; checkoutTime: string | null;
  smokingAllowed: boolean | null; petsAllowed: boolean | null;
  starRating: number | null; roomType: string | null; unitCount: number | null;
  bedrooms: number | null; bathrooms: number | null; maxGuests: number | null;
  longStayEnabled: boolean | null; longStayMinNights: number | null;
  longStayDiscountType: string | null; longStayDiscountValue: number | null;
  carMake: string | null; carModel: string | null; carYear: number | null;
  bodyType: string | null; transmission: string | null; fuelType: string | null;
  seats: number | null; mileagePolicy: string | null; mileageLimitKm: number | null;
  minDriverAge: number | null; deliveryAvailable: boolean | null;
  deliveryFee: number | null; deliveryRadiusKm: number | null;
  amenities: Amenity[]; customAmenities: CustomAmenity[]; photos: Photo[];
  isFavourited: boolean | undefined;
  isAccredited?: boolean;
  promoBadge?: PromoBadge | null;
  mrpPrice?: number | null;
  roomTypes?: RoomType[];
  hotelRoomTypes?: RoomType[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const AMENITY_ICONS: Record<string, string> = {
  wifi: "wifi", pool: "water", gym: "barbell", spa: "flower", parking: "car",
  kitchen: "restaurant", breakfast: "cafe", air_conditioning: "snow",
  reception_24h: "time", restaurant: "restaurant", bar: "beer",
  housekeeping: "sparkles", airport_shuttle: "airplane",
  security_24h: "shield-checkmark", elevator: "arrow-up",
};
const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi", pool: "Swimming Pool", gym: "Fitness Centre", spa: "Spa",
  parking: "Free Parking", kitchen: "Kitchen", breakfast: "Breakfast Included",
  air_conditioning: "Air Conditioning", reception_24h: "24h Reception",
  restaurant: "Restaurant", bar: "Bar", housekeeping: "Housekeeping",
  airport_shuttle: "Airport Shuttle", security_24h: "24h Security", elevator: "Elevator",
  smart_tv: "Smart TV", work_desk: "Work Desk", minibar: "Minibar", accessible: "Accessible",
};

function fmt(d: string | undefined): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  catch { return d; }
}
function fmtDT(d: string | undefined): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return d; }
}
function nights(a: string, b: string) { return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)); }
function days(a: string, b: string) { return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)); }

function cancelColor(p: string | null) {
  if (p === "flexible" || p === "free") return "#16a34a";
  if (p === "moderate") return "#D97706";
  return "#DC2626";
}



function openLocationInMaps(lat: number, lng: number, label: string) {
  const latLng = `${lat},${lng}`;
  const url = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(label)}@${latLng}`,
    android: `geo:0,0?q=${latLng}(${encodeURIComponent(label)})`,
  });
  if (url) {
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
    });
  }
}
function cancelText(p: string | null) {
  switch (p) {
    case "flexible": case "free": return "Free cancellation up to 48 hours before check-in.";
    case "moderate": return "Full refund 7+ days before. 50% refund 48h–7 days. No refund within 48h.";
    case "strict": return "50% refund 14+ days before. No refund within 14 days.";
    default: return p ?? "Contact host for details.";
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: size, color: i <= n ? "#F59E0B" : "#E5E7EB" }}>★</Text>
      ))}
    </View>
  );
}

function Chip({ icon, label, accent }: { icon: string; label: string; accent?: boolean }) {
  return (
    <View style={[chip.wrap, accent && chip.wrapAccent]}>
      <Text style={chip.icon}>{icon}</Text>
      <Text style={[chip.label, accent && chip.labelAccent]}>{label}</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#F3F4F6", gap: 5, marginRight: 8 },
  wrapAccent: { backgroundColor: GREEN_LIGHT, borderWidth: 1, borderColor: "#BBF7D0" },
  icon: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: "600", color: MUTED },
  labelAccent: { color: GREEN },
});

function InfoCard({ items }: { items: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }[] }) {
  return (
    <View style={ic.wrap}>
      {items.map((item, i) => (
        <View key={i} style={[ic.row, i < items.length - 1 && ic.rowBorder]}>
          <View style={ic.iconWrap}>
            <Ionicons name={item.icon} size={18} color={GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ic.label}>{item.label}</Text>
            <Text style={ic.value}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
const ic = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, color: MUTED, fontWeight: "500", marginBottom: 2 },
  value: { fontSize: 14, color: TEXT, fontWeight: "600" },
});

function AmenityPill({ amenityKey, label }: { amenityKey: string; label: string }) {
  const icon = AMENITY_ICONS[amenityKey];
  return (
    <View style={ap.wrap}>
      <View style={ap.iconWrap}>
        {icon ? (
          <Ionicons name={icon as any} size={18} color={GREEN} />
        ) : (
          <Ionicons name="checkmark" size={16} color={GREEN} />
        )}
      </View>
      <Text style={ap.label}>{label}</Text>
    </View>
  );
}
const ap = StyleSheet.create({
  wrap: { width: "48%", flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  label: { fontSize: 12, fontWeight: "600", color: TEXT, flex: 1 },
});

function ReviewCard({ review }: { review: Review }) {
  const d = (() => { try { return new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } })();
  return (
    <View style={rv.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Stars n={review.rating} />
        <Text style={rv.date}>{d}</Text>
      </View>
      {review.title ? <Text style={rv.title}>{review.title}</Text> : null}
      {review.body ? <Text style={rv.body} numberOfLines={4}>{review.body}</Text> : null}
      <Text style={rv.guest}>Guest Traveller</Text>
      {review.providerReply && (
        <View style={rv.reply}>
          <Text style={rv.replyLabel}>🏨 Host response</Text>
          <Text style={rv.replyBody}>{review.providerReply}</Text>
        </View>
      )}
    </View>
  );
}
const rv = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 10 },
  date: { fontSize: 11, color: MUTED },
  title: { fontSize: 14, fontWeight: "700", color: TEXT, marginBottom: 4 },
  body: { fontSize: 13, color: "#374151", lineHeight: 20, marginBottom: 8 },
  guest: { fontSize: 12, fontWeight: "600", color: MUTED },
  reply: { marginTop: 10, backgroundColor: GREEN_LIGHT, borderRadius: 10, padding: 10 },
  replyLabel: { fontSize: 12, fontWeight: "700", color: GREEN, marginBottom: 4 },
  replyBody: { fontSize: 12, color: "#374151", lineHeight: 17 },
});

// ── GalleryModal ─────────────────────────────────────────────────────────────
interface GalleryModalProps {
  photos: Photo[];
  photoIdx: number;
  setPhotoIdx: (idx: number) => void;
  onClose: () => void;
}
function GalleryModal({ photos, photoIdx, setPhotoIdx, onClose }: GalleryModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        data={photos}
        keyExtractor={p => p.id}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={photoIdx}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width: W, flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ListingImage uri={item.cdnUrl} style={{ width: W, height: H * 0.7 }} resizeMode="contain" />
          </View>
        )}
      />
      {/* Counter */}
      <View style={{ alignItems: "center", paddingBottom: Math.max(insets.bottom + 16, 40) }}>
        <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{photoIdx + 1} / {photos.length}</Text>
        </View>
      </View>
      {/* Close button */}
      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          top: insets.top + 12,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ height: PHOTO_H, backgroundColor: "#E5E7EB" }} />
      <View style={{ padding: 20, gap: 12 }}>
        <View style={{ height: 28, width: "75%", backgroundColor: "#E5E7EB", borderRadius: 8 }} />
        <View style={{ height: 18, width: "50%", backgroundColor: "#E5E7EB", borderRadius: 6 }} />
        <View style={{ height: 36, width: "40%", backgroundColor: "#E5E7EB", borderRadius: 8 }} />
        <View style={{ height: 1, backgroundColor: "#E5E7EB" }} />
        <View style={{ height: 80, backgroundColor: "#E5E7EB", borderRadius: 12 }} />
        <View style={{ height: 120, backgroundColor: "#E5E7EB", borderRadius: 12 }} />
      </View>
    </View>
  );
}

// ── Calendar Date Picker ──────────────────────────────────────────────────────
const CAL_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CAL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function calToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBeforeToday(d: Date): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function isInUnavailable(ds: string, ranges: { start: string; end: string }[]): boolean {
  return ranges.some(r => {
    const s = r.start.split("T")[0]!;
    const e = r.end.split("T")[0]!;
    return ds >= s && ds <= e;
  });
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const arr: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
  return arr;
}

interface CalPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (start: string, end: string) => void;
  isCar: boolean;
  unavailableRanges: { start: string; end: string }[];
}

function CalendarPicker({ visible, onClose, onConfirm, isCar, unavailableRanges }: CalPickerProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [pickupHr, setPickupHr] = useState("10");
  const [pickupMin, setPickupMin] = useState("00");
  const [returnHr, setReturnHr] = useState("10");
  const [returnMin, setReturnMin] = useState("00");

  function resetPicker() {
    setSelStart(null); setSelEnd(null);
    setPickupHr("10"); setPickupMin("00");
    setReturnHr("10"); setReturnMin("00");
  }

  const monthDays = buildMonthGrid(viewYear, viewMonth);
  const DAY_SIZE = (W - 32) / 7;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDayPress(d: Date) {
    const ds = calToStr(d);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(ds); setSelEnd(null);
    } else {
      if (ds <= selStart) { setSelStart(ds); setSelEnd(null); }
      else setSelEnd(ds);
    }
  }

  type DayState = "start" | "end" | "range" | "normal" | "disabled";
  function getDayState(d: Date): DayState {
    const ds = calToStr(d);
    if (isBeforeToday(d) || isInUnavailable(ds, unavailableRanges)) return "disabled";
    if (ds === selStart) return "start";
    if (ds === selEnd) return "end";
    if (selStart && selEnd && ds > selStart && ds < selEnd) return "range";
    return "normal";
  }

  function handleConfirm() {
    if (!selStart || !selEnd) return;
    if (isCar) {
      const pu = new Date(`${selStart}T${pickupHr.padStart(2, "0")}:${pickupMin.padStart(2, "0")}:00`).toISOString();
      const rt = new Date(`${selEnd}T${returnHr.padStart(2, "0")}:${returnMin.padStart(2, "0")}:00`).toISOString();
      onConfirm(pu, rt);
    } else {
      onConfirm(selStart, selEnd);
    }
    resetPicker();
    onClose();
  }

  const canConfirm = !!(selStart && selEnd);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { resetPicker(); onClose(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: TEXT }}>{isCar ? "Select Rental Period" : "Select Dates"}</Text>
          <TouchableOpacity onPress={() => { resetPicker(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={TEXT} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Month navigation */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 }}>
            <TouchableOpacity onPress={prevMonth} style={{ padding: 8, borderRadius: 10, backgroundColor: GREEN_LIGHT }}>
              <Ionicons name="chevron-back" size={20} color={GREEN} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT }}>{CAL_MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 8, borderRadius: 10, backgroundColor: GREEN_LIGHT }}>
              <Ionicons name="chevron-forward" size={20} color={GREEN} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16 }}>
            {CAL_WEEKDAYS.map(w => (
              <Text key={w} style={{ width: DAY_SIZE, textAlign: "center", fontSize: 12, fontWeight: "600", color: MUTED, paddingBottom: 6 }}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16 }}>
            {monthDays.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={{ width: DAY_SIZE, height: 44 }} />;
              const st = getDayState(d);
              const isStart = st === "start";
              const isEnd = st === "end";
              const isRange = st === "range";
              const isDisabled = st === "disabled";
              return (
                <View key={i} style={{ width: DAY_SIZE, height: 44, alignItems: "center", justifyContent: "center" }}>
                  {isRange && <View style={{ position: "absolute", left: 0, right: 0, top: 7, bottom: 7, backgroundColor: GREEN_LIGHT }} />}
                  {isEnd && selStart && <View style={{ position: "absolute", left: 0, right: "50%", top: 7, bottom: 7, backgroundColor: GREEN_LIGHT }} />}
                  {isStart && selEnd && <View style={{ position: "absolute", left: "50%", right: 0, top: 7, bottom: 7, backgroundColor: GREEN_LIGHT }} />}
                  <TouchableOpacity
                    onPress={() => !isDisabled && handleDayPress(d)}
                    disabled={isDisabled}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: (isStart || isEnd) ? GREEN : "transparent", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: (isStart || isEnd) ? "700" : "400", color: isDisabled ? "#D1D5DB" : (isStart || isEnd) ? "#fff" : TEXT }}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Status hint */}
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            {!selStart && (
              <Text style={{ fontSize: 13, color: MUTED, textAlign: "center" }}>
                Tap to select your {isCar ? "pickup" : "check-in"} date
              </Text>
            )}
            {selStart && !selEnd && (
              <Text style={{ fontSize: 13, color: MUTED, textAlign: "center" }}>
                Now tap your {isCar ? "return" : "check-out"} date
              </Text>
            )}
            {selStart && selEnd && (
              <Text style={{ fontSize: 13, fontWeight: "600", color: GREEN, textAlign: "center" }}>
                {fmt(selStart)} → {fmt(selEnd)}
                {!isCar ? ` · ${nights(selStart, selEnd)} night${nights(selStart, selEnd) !== 1 ? "s" : ""}` : ""}
              </Text>
            )}
          </View>

          {/* Time inputs for car rentals */}
          {isCar && selStart && selEnd && (
            <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT }}>Set Times</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1, backgroundColor: BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                  <Text style={{ fontSize: 12, color: MUTED, fontWeight: "600", marginBottom: 8 }}>Pickup time</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput
                      value={pickupHr}
                      onChangeText={v => setPickupHr(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, width: 44, textAlign: "center", paddingVertical: 8, fontSize: 16, fontWeight: "700", color: TEXT }}
                    />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT }}>:</Text>
                    <TextInput
                      value={pickupMin}
                      onChangeText={v => setPickupMin(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, width: 44, textAlign: "center", paddingVertical: 8, fontSize: 16, fontWeight: "700", color: TEXT }}
                    />
                  </View>
                </View>
                <View style={{ flex: 1, backgroundColor: BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                  <Text style={{ fontSize: 12, color: MUTED, fontWeight: "600", marginBottom: 8 }}>Return time</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput
                      value={returnHr}
                      onChangeText={v => setReturnHr(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, width: 44, textAlign: "center", paddingVertical: 8, fontSize: 16, fontWeight: "700", color: TEXT }}
                    />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: TEXT }}>:</Text>
                    <TextInput
                      value={returnMin}
                      onChangeText={v => setReturnMin(v.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, width: 44, textAlign: "center", paddingVertical: 8, fontSize: 16, fontWeight: "700", color: TEXT }}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Confirm button */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: BORDER }}>
          <TouchableOpacity
            style={{ backgroundColor: canConfirm ? GREEN : "#D1D5DB", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}
            onPress={handleConfirm}
            disabled={!canConfirm}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Confirm Dates</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ListingDetailScreen() {
  const { id, checkIn, checkOut, guests, pickupDatetime, returnDatetime } = useLocalSearchParams<{
    id: string; checkIn?: string; checkOut?: string; guests?: string;
    pickupDatetime?: string; returnDatetime?: string;
  }>();

  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [photoIdx, setPhotoIdx] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [amenExpanded, setAmenExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [localStart, setLocalStart] = useState<string | null>(null);
  const [localEnd, setLocalEnd] = useState<string | null>(null);
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgDraft, setMsgDraft] = useState("");
  const [msgSending, setMsgSending] = useState(false);

  // Room type selection state
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);

  // ── Data ──
  const { data: listing, isLoading, isError, refetch: refetchListing } = useQuery<PublicListing>({
    queryKey: ["listing-full", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: PublicListing }>(`/listings/${id}/public`);
      return res.data.data;
    },
    enabled: !!id, staleTime: 0, gcTime: 5 * 60_000,
  });

  const { data: availability, refetch: refetchAvailability } = useQuery({
    queryKey: ["availability", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { unavailableRanges: { start: string; end: string }[] } }>(`/listings/${id}/availability`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: reviewsData, refetch: refetchReviews } = useQuery<ReviewsData>({
    queryKey: ["reviews", "listing", id, 3],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ReviewsData }>(`/listings/${id}/reviews?page=1&limit=3`);
      return res.data.data;
    },
    enabled: !!id,
  });

  useRefreshOnFocus(useCallback(() => {
    void refetchListing();
    void refetchAvailability();
    void refetchReviews();
  }, [refetchListing, refetchAvailability, refetchReviews]));

  // Active promotions filtered by this listing's category (hotel / apartment / car)
  const { data: activePromotions } = useQuery<Promotion[]>({
    queryKey: ["promotions-listing", listing?.category],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { promotions: Promotion[] } }>(
          `/promotions/active?activity=${listing!.category}`
        );
        return res.data.data.promotions ?? [];
      } catch { return []; }
    },
    enabled: !!listing,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Room types collection
  const roomTypes = listing?.roomTypes ?? listing?.hotelRoomTypes ?? [];

  // Auto select first room type when data loads
  useEffect(() => {
    if (roomTypes.length > 0 && !selectedRoomTypeId) {
      setSelectedRoomTypeId(roomTypes[0].id);
    }
  }, [roomTypes, selectedRoomTypeId]);

  useEffect(() => {
    if (!listing) return;
    if (user) {
      void listingApi.post("/guests/me/recently-viewed", { listingId: listing.id }).catch(() => { });
    } else {
      void (async () => {
        try {
          const SecureStore = await import("expo-secure-store");
          const raw = await SecureStore.getItemAsync("zika:anon_views");
          const ids: string[] = raw ? JSON.parse(raw) : [];
          if (!ids.includes(listing.id)) {
            const updated = [listing.id, ...ids].slice(0, 20);
            await SecureStore.setItemAsync("zika:anon_views", JSON.stringify(updated));
          }
        } catch { }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id]);

  const favMut = useMutation({
    mutationFn: async ({ isFav }: { isFav: boolean }) => {
      if (isFav) { await listingApi.delete(`/guests/me/favourites/${id}`); }
      else { await listingApi.post("/guests/me/favourites", { listingId: id }); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listing-full", id] }); },
    onError: () => Alert.alert("Error", "Could not update saved status."),
  });

  // ── States ──
  if (isLoading) return <Skeleton />;
  if (isError || !listing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={56} color="#DC2626" />
        <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT, marginTop: 16, marginBottom: 8 }}>Listing not found</Text>
        <Text style={{ fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 24 }}>This listing is no longer available.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isCar = listing.category === "car";
  const isHotel = listing.category === "hotel";
  const isApartment = listing.category === "apartment";
  const isProvider = user?.userType === "provider";

  const photos = [...(listing.photos ?? [])].sort((a, b) => a.position - b.position);

  // Selected room type object if hotel has room types
  const selectedRoomType = roomTypes.find((r) => r.id === selectedRoomTypeId) ?? roomTypes[0];

  // Derive base rate per night/day before discount
  const baseRate = isCar
    ? Number(listing.dailyRate ?? listing.pricePerDay ?? 0)
    : selectedRoomType
      ? Number(selectedRoomType.pricePerNight || 0)
      : Number(listing.nightlyRate ?? listing.pricePerNight ?? 0);

  const rateLabel = isCar ? "per day" : "per night";
  const isFav = listing.isFavourited ?? false;

  // Derive effective promotion from listing.promoBadge or activePromotions
  const customPromoBadge = listing.promoBadge;
  const promoPercentFromBadge = customPromoBadge?.labelText
    ? parseFloat(customPromoBadge.labelText.replace(/[^0-9.]/g, ""))
    : 0;

  const effectivePromo: ActivePromotion | null = customPromoBadge && promoPercentFromBadge > 0
    ? {
      activity: listing.category,
      discountType: "percentage",
      discountValue: String(promoPercentFromBadge),
      labelText: customPromoBadge.labelText,
      bannerTitle: customPromoBadge.labelText,
      status: "active",
      applyToBooking: true,
    }
    : (activePromotions?.[0] as unknown as ActivePromotion | null) ?? null;

  const promoted = applyPromotion(baseRate || null, effectivePromo);
  const activePromo = effectivePromo;

  // Final rate (discounted rate if promotion applies, otherwise baseRate)
  const rate = promoted.hasPromotion && promoted.discountedPrice != null
    ? promoted.discountedPrice
    : baseRate;

  // Strikethrough MRP price (baseRate if promo applies, or listing.mrpPrice if higher than baseRate)
  const mrpPrice = promoted.hasPromotion && promoted.originalPrice != null && promoted.originalPrice > rate
    ? promoted.originalPrice
    : (listing.mrpPrice && listing.mrpPrice > baseRate)
      ? listing.mrpPrice
      : null;

  const discountPercent = promoted.hasPromotion && promoted.originalPrice && promoted.discountedPrice
    ? Math.round(((promoted.originalPrice - promoted.discountedPrice) / promoted.originalPrice) * 100)
    : null;

  // Locally selected dates take priority over URL params
  const effectivePU = localStart ?? pickupDatetime;
  const effectiveRT = localEnd ?? returnDatetime;
  const effectiveCI = localStart ?? checkIn;
  const effectiveCO = localEnd ?? checkOut;

  const hasDates = isCar ? !!(effectivePU && effectiveRT) : !!(effectiveCI && effectiveCO);

  const datesStr = (() => {
    if (isCar && effectivePU && effectiveRT) {
      const d = days(effectivePU, effectiveRT);
      return `${fmtDT(effectivePU)} → ${fmtDT(effectiveRT)} · ${d} day${d !== 1 ? "s" : ""}`;
    }
    if (!isCar && effectiveCI && effectiveCO) {
      const n = nights(effectiveCI, effectiveCO);
      return `${fmt(effectiveCI)} → ${fmt(effectiveCO)} · ${n} night${n !== 1 ? "s" : ""}`;
    }
    return null;
  })();

  // Pricing
  const pricingBreakout = (() => {
    if (!hasDates || !baseRate) return null;
    const count = isCar && effectivePU && effectiveRT ? days(effectivePU, effectiveRT)
      : !isCar && effectiveCI && effectiveCO ? nights(effectiveCI, effectiveCO) : 1;
    const originalSubtotal = baseRate * count;

    // Promo discount per night/day
    const promoDiscount = promoted.hasPromotion && promoted.savings != null && promoted.savings > 0
      ? Math.round(promoted.savings) * count
      : 0;

    let longStayDiscount = 0;
    if (!isCar && listing.longStayEnabled && listing.longStayMinNights && count >= listing.longStayMinNights) {
      const v = Number(listing.longStayDiscountValue ?? 0);
      const subAfterPromo = Math.max(0, originalSubtotal - promoDiscount);
      longStayDiscount = listing.longStayDiscountType === "percentage" ? subAfterPromo * (v / 100) : v * count;
    }

    const totalDiscount = promoDiscount + longStayDiscount;
    const discountedSubtotal = Math.max(0, originalSubtotal - totalDiscount);

    // Service fee (10% of discounted subtotal)
    const serviceFeePercent = 10;
    const serviceFee = Math.round(discountedSubtotal * (serviceFeePercent / 100));
    const delivery = isCar && listing.deliveryAvailable && listing.deliveryFee ? Number(listing.deliveryFee) : 0;
    const total = discountedSubtotal + serviceFee + delivery;

    return {
      baseRate,
      rate,
      count,
      originalSubtotal,
      promoDiscount,
      longStayDiscount,
      discountedSubtotal,
      serviceFeePercent,
      serviceFee,
      delivery,
      total,
    };
  })();

  // Amenities
  const amenityKeys: string[] = (() => {
    if (!listing.amenities) return [];
    if (Array.isArray(listing.amenities)) {
      return listing.amenities.map((a: any) => {
        const k = a?.amenityKey ?? a;
        if (typeof k === "string") return k.includes(":") ? k.split(":")[1]! : k;
        return null;
      }).filter(Boolean) as string[];
    }
    if (typeof listing.amenities === "object") {
      return Object.values(listing.amenities as Record<string, any[]>).flat().map((a: any) => {
        const k = a?.amenityKey ?? a;
        if (typeof k === "string") return k.includes(":") ? k.split(":")[1]! : k;
        return null;
      }).filter(Boolean) as string[];
    }
    return [];
  })();

  const customAmenities: string[] = Array.isArray(listing.customAmenities)
    ? listing.customAmenities.map((a: any) => a?.label ?? a).filter(Boolean) as string[]
    : [];

  const allAmenities: { key: string; label: string }[] = [
    ...amenityKeys.map(k => ({ key: k, label: AMENITY_LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) })),
    ...customAmenities.map(l => ({ key: l, label: l })),
  ];
  const visAmenities = amenExpanded ? allAmenities : allAmenities.slice(0, 8);

  // Category chips
  const categoryChips = (() => {
    if (isHotel) {
      const chips: { icon: string; label: string; accent?: boolean }[] = [
        { icon: "🏨", label: "Hotel", accent: true },
      ];
      if (listing.starRating) chips.push({ icon: "⭐", label: `${listing.starRating} Stars` });
      if (selectedRoomType?.name || listing.roomType) {
        chips.push({ icon: "🛏️", label: (selectedRoomType?.name ?? listing.roomType ?? "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) });
      }
      if (listing.unitCount) chips.push({ icon: "🏢", label: `${listing.unitCount} Units` });
      return chips;
    }
    if (isApartment) {
      return [
        { icon: "🏠", label: "Home", accent: true },
        ...(listing.bedrooms ? [{ icon: "🛏️", label: `${listing.bedrooms} Bed` }] : []),
        ...(listing.bathrooms ? [{ icon: "🚿", label: `${listing.bathrooms} Bath` }] : []),
        ...(listing.maxGuests ? [{ icon: "👥", label: `${listing.maxGuests} Guests` }] : []),
      ];
    }
    return [
      { icon: "🚗", label: "Car", accent: true },
      ...(listing.transmission ? [{ icon: "⚙️", label: listing.transmission.charAt(0).toUpperCase() + listing.transmission.slice(1) }] : []),
      ...(listing.seats ? [{ icon: "💺", label: `${listing.seats} Seats` }] : []),
      ...(listing.fuelType ? [{ icon: "⛽", label: listing.fuelType.charAt(0).toUpperCase() + listing.fuelType.slice(1) }] : []),
    ];
  })();

  // Detail card rows
  const detailRows = (() => {
    if (isHotel || isApartment) {
      const rows: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }[] = [];
      if (listing.checkinTime) rows.push({ icon: "log-in-outline", label: "Check-in from", value: listing.checkinTime });
      if (listing.checkoutTime) rows.push({ icon: "log-out-outline", label: "Check-out by", value: listing.checkoutTime });
      rows.push({ icon: "flame-outline", label: "Smoking", value: listing.smokingAllowed ? "Allowed" : "Not allowed" });
      rows.push({ icon: "paw-outline", label: "Pets", value: listing.petsAllowed ? "Allowed" : "Not allowed" });
      if (isApartment && listing.minStayNights) rows.push({ icon: "moon-outline", label: "Min stay", value: `${listing.minStayNights} night${listing.minStayNights !== 1 ? "s" : ""}` });
      if (isApartment && listing.longStayEnabled && listing.longStayMinNights && listing.longStayDiscountValue) {
        rows.push({ icon: "pricetag-outline", label: "Long-stay discount", value: `${listing.longStayDiscountType === "percentage" ? `${listing.longStayDiscountValue}% off` : `${listing.currency} ${listing.longStayDiscountValue} off`} for ${listing.longStayMinNights}+ nights` });
      }
      return rows;
    }
    const rows: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }[] = [];
    if (listing.minDriverAge) rows.push({ icon: "person-outline", label: "Min driver age", value: `${listing.minDriverAge} years` });
    rows.push({ icon: "speedometer-outline", label: "Mileage", value: listing.mileagePolicy === "unlimited" ? "Unlimited" : listing.mileageLimitKm ? `${listing.mileageLimitKm} km/day` : "See host" });
    if (listing.fuelType) rows.push({ icon: "car-outline", label: "Fuel type", value: listing.fuelType.charAt(0).toUpperCase() + listing.fuelType.slice(1) });
    rows.push({ icon: "navigate-outline", label: "Delivery", value: listing.deliveryAvailable ? `Yes · within ${listing.deliveryRadiusKm ?? "?"}km` : "Not available" });
    return rows;
  })();

  const reviews = reviewsData?.reviews ?? [];
  const totalReviews = reviewsData?.total ?? 0;
  const avgRating = reviewsData?.averageRating;
  const locationStr = [listing.town, listing.country].filter(Boolean).join(", ");

  function handleBook() {
    if (!listing) return;
    if (!user) {
      Alert.alert("Sign in required", "You need to be signed in to book.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => router.push("/(auth)/login" as any) },
      ]);
      return;
    }
    if (isCar) {
      router.push({
        pathname: "/book/[listingId]",
        params: {
          listingId: id,
          pickupDatetime: effectivePU,
          returnDatetime: effectiveRT,
          listingCategory: listing.category,
        },
      });
    } else {
      router.push({
        pathname: "/book/[listingId]",
        params: {
          listingId: id,
          checkIn: effectiveCI,
          checkOut: effectiveCO,
          guests,
          listingCategory: listing.category,
          ...(selectedRoomType?.id ? { roomTypeId: selectedRoomType.id } : {}),
        },
      });
    }
  }

  async function handleMessageHost() {
    if (!msgDraft.trim() || !id) return;
    setMsgSending(true);
    try {
      const r1 = await listingApi.post<{ data: { conversationId: string; isNew: boolean } }>(
        "/conversations",
        { listingId: id }
      );
      const convId = r1.data.data.conversationId;
      await listingApi.post(`/conversations/${convId}/messages`, { body: msgDraft.trim() });
      setShowMsgModal(false);
      setMsgDraft("");
      router.push(`/conversation/${convId}` as any);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? "Could not send message. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setMsgSending(false);
    }
  }

  const curr = listing.currency ?? "XAF";

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>

      {/* ══ OVERLAY BUTTONS ══ */}
      <View style={[s.overlayTop, { paddingTop: insets.top > 0 ? insets.top + 12 : 12 }]} pointerEvents="box-none">
        <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {user && !isProvider && (
            <TouchableOpacity
              style={s.circleBtn}
              onPress={() => favMut.mutate({ isFav })}
              disabled={favMut.isPending}
              activeOpacity={0.85}
            >
              {favMut.isPending ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#DC2626" : TEXT} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ══ CONTENT ══ */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* ── Hero Photos ── */}
        <View style={{ height: PHOTO_H, backgroundColor: "#E5E7EB" }}>
          {photos.length > 0 ? (
            <>
              <FlatList
                data={photos}
                keyExtractor={p => p.id}
                horizontal pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / W));
                }}
                renderItem={({ item }) => (
                  <TouchableOpacity activeOpacity={0.95} onPress={() => setGalleryOpen(true)}>
                    <ListingImage uri={item.cdnUrl} style={{ width: W, height: PHOTO_H }} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />
              {/* Photo counter pill */}
              <View style={s.photoPill}>
                <Ionicons name="images-outline" size={11} color="#fff" />
                <Text style={s.photoPillText}>{photoIdx + 1} / {photos.length}</Text>
              </View>
            </>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="image-outline" size={48} color={MUTED} />
              <Text style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>No photos available</Text>
            </View>
          )}
        </View>

        {/* ── Title card ── */}
        <View style={s.titleCard}>
          {/* Category + rating row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[s.catBadge, isCar && { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }, isApartment && { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Text style={[s.catBadgeText, isCar && { color: "#C2410C" }, isApartment && { color: GREEN }]}>
                  {isCar ? "🚗 Car" : isApartment ? "🏠 Home" : "🏨 Hotel"}
                </Text>
              </View>
              {listing.isAccredited && (
                <View style={s.accreditedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={GREEN} />
                  <Text style={s.accreditedText}>Accredited</Text>
                </View>
              )}
            </View>
            {avgRating != null && totalReviews > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }}>{avgRating.toFixed(1)}</Text>
                <Text style={{ fontSize: 12, color: MUTED }}>({totalReviews})</Text>
              </View>
            )}
          </View>

          <Text style={s.title}>{listing.title ?? listing.name ?? "Untitled listing"}</Text>

          {locationStr ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, marginBottom: 14 }}>
              <Ionicons name="location" size={14} color={GREEN} />
              <Text style={{ fontSize: 13, color: MUTED, fontWeight: "500" }}>{locationStr}</Text>
            </View>
          ) : null}

          {/* Spec chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {categoryChips.map((c, i) => (
              <Chip key={i} icon={c.icon} label={c.label} accent={c.accent} />
            ))}
          </ScrollView>

          {/* MRP & Discounted Price Display */}
          <View style={s.priceRow}>
            <View style={{ flex: 1 }}>
              {mrpPrice != null && mrpPrice > rate ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Text style={s.priceOriginal}>{curr} {Math.round(mrpPrice).toLocaleString()}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={s.priceAmount}>{curr} {Math.round(rate).toLocaleString()}</Text>
                <Text style={s.priceUnit}>{rateLabel}</Text>
              </View>
            </View>

            {/* Promo Badges */}
            {customPromoBadge ? (
              <View style={[s.promoDealBadge, { backgroundColor: customPromoBadge.labelColour ?? "#C84B2F" }]}>
                <Text style={s.promoDealText}>{customPromoBadge.labelText}</Text>
              </View>
            ) : promoted.hasPromotion ? (
              <View style={s.promoDealBadge}>
                <Text style={s.promoDealText}>🔥 {promoted.labelText}</Text>
              </View>
            ) : (
              <View style={s.bestDeal}>
                <Ionicons name="pricetag" size={11} color={GREEN} />
                <Text style={s.bestDealText}>Best Rate</Text>
              </View>
            )}
          </View>

          {isCar && listing.deliveryAvailable && listing.deliveryFee ? (
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
              + {curr} {listing.deliveryFee} delivery available
            </Text>
          ) : null}
        </View>

        {/* ── Room Types Feature (for Hotels) ── */}
        {isHotel && roomTypes.length > 0 && (
          <View style={s.section}>
            <RoomTypeSelector
              roomTypes={roomTypes}
              selectedRoomTypeId={selectedRoomTypeId}
              onSelectRoomType={(rtId) => setSelectedRoomTypeId(rtId)}
              currency={curr}
              discountPercent={discountPercent}
            />
          </View>
        )}

        {/* ── Long-stay promo ── */}
        {listing.longStayEnabled && (
          <View style={s.promoBanner}>
            <View style={s.promoIcon}>
              <Ionicons name="gift" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.promoTitle}>Long-Stay Discount 🎉</Text>
              <Text style={s.promoSub}>Book {listing.longStayMinNights ?? 7}+ nights and save {listing.longStayDiscountValue ?? 0}{listing.longStayDiscountType === "percentage" ? "%" : ` ${curr}`} automatically.</Text>
            </View>
          </View>
        )}

        {/* ── Active Promotions ── */}
        {activePromo && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Best Offer Available</Text>
            <View style={pr.card}>
              <View style={pr.iconWrap}>
                <Ionicons name="pricetag" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pr.title}>{activePromo.bannerTitle}</Text>
                {promoted.savings != null && promoted.savings > 0 && (
                  <Text style={pr.savings}>You Save {curr} {Math.round(promoted.savings).toLocaleString()}</Text>
                )}
                {promoted.originalPrice != null && promoted.discountedPrice != null && (
                  <Text style={pr.origPrice}>
                    {curr} {Math.round(promoted.originalPrice).toLocaleString()} → {curr} {Math.round(promoted.discountedPrice).toLocaleString()}
                  </Text>
                )}
              </View>
              <View style={pr.discBadge}>
                <Text style={pr.discText}>{activePromo.labelText}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Dates ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your {isCar ? "Rental Period" : "Stay"}</Text>
          {datesStr ? (
            <View style={s.datesPill}>
              <Ionicons name="calendar-outline" size={16} color={GREEN} />
              <Text style={s.datesText}>{datesStr}</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.selectDatesCard} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color={GREEN} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>Select {isCar ? "pickup & return" : "check-in & check-out"}</Text>
                <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Tap to choose your dates</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Pricing breakdown ── */}
        {pricingBreakout && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Price Breakdown</Text>
            <View style={s.breakCard}>
              <View style={s.breakRow}>
                <Text style={s.breakLabel}>
                  {curr} {Math.round(pricingBreakout.baseRate).toLocaleString()} × {pricingBreakout.count} {isCar ? "day" : "night"}{pricingBreakout.count !== 1 ? "s" : ""}
                </Text>
                <Text style={s.breakVal}>{curr} {Math.round(pricingBreakout.originalSubtotal).toLocaleString()}</Text>
              </View>
              {pricingBreakout.promoDiscount > 0 && (
                <View style={s.breakRow}>
                  <Text style={[s.breakLabel, { color: "#16a34a", fontWeight: "600" }]}>Promotion discount</Text>
                  <Text style={[s.breakVal, { color: "#16a34a", fontWeight: "700" }]}>−{curr} {Math.round(pricingBreakout.promoDiscount).toLocaleString()}</Text>
                </View>
              )}
              {pricingBreakout.longStayDiscount > 0 && (
                <View style={s.breakRow}>
                  <Text style={[s.breakLabel, { color: "#16a34a", fontWeight: "600" }]}>Long-stay discount</Text>
                  <Text style={[s.breakVal, { color: "#16a34a", fontWeight: "700" }]}>−{curr} {Math.round(pricingBreakout.longStayDiscount).toLocaleString()}</Text>
                </View>
              )}
              {pricingBreakout.delivery > 0 && (
                <View style={s.breakRow}>
                  <Text style={s.breakLabel}>Delivery fee</Text>
                  <Text style={s.breakVal}>{curr} {Math.round(pricingBreakout.delivery).toLocaleString()}</Text>
                </View>
              )}
              <View style={s.breakRow}>
                <Text style={s.breakLabel}>Service fee ({pricingBreakout.serviceFeePercent}%)</Text>
                <Text style={s.breakVal}>{curr} {Math.round(pricingBreakout.serviceFee).toLocaleString()}</Text>
              </View>
              <View style={[s.breakRow, { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4, paddingTop: 12 }]}>
                <Text style={s.breakTotal}>Total</Text>
                <Text style={s.breakTotalVal}>{curr} {Math.round(pricingBreakout.total).toLocaleString()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Description ── */}
        {listing.description ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About this {listing.category}</Text>
            <Text style={s.descText} numberOfLines={descExpanded ? undefined : 4}>{listing.description}</Text>
            <TouchableOpacity onPress={() => setDescExpanded(v => !v)} style={s.readMore}>
              <Text style={s.readMoreText}>{descExpanded ? "Show less ↑" : "Read more ↓"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Amenities ── */}
        {allAmenities.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>What's included</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {visAmenities.map((a, i) => <AmenityPill key={i} amenityKey={a.key} label={a.label} />)}
            </View>
            {allAmenities.length > 8 && (
              <TouchableOpacity onPress={() => setAmenExpanded(v => !v)} style={[s.readMore, { marginTop: 4 }]}>
                <Text style={s.readMoreText}>
                  {amenExpanded ? "Show less ↑" : `Show all ${allAmenities.length} amenities ↓`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Property details ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{isCar ? "Car Details" : "Property Details"}</Text>
          <InfoCard items={detailRows} />
        </View>

        {/* ── Host card ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Host</Text>
          <View style={s.hostCard}>
            <View style={s.hostAvatar}>
              <Ionicons name="person" size={24} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.hostName}>Verified Property Partner</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT }}>4.9</Text>
                </View>
                <Text style={{ fontSize: 12, color: MUTED }}>· Response within 1h</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                <View style={s.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={10} color={GREEN} />
                  <Text style={s.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>
          </View>
          {!isProvider && listing.providerId && (
            <TouchableOpacity
              style={s.msgHostBtn}
              onPress={() => {
                if (!user) {
                  Alert.alert(
                    "Sign in required",
                    "Please sign in to message the host.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Sign In", onPress: () => router.push("/(auth)/login" as any) },
                    ]
                  );
                  return;
                }
                setShowMsgModal(true);
              }}
              activeOpacity={0.82}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={GREEN} />
              <Text style={s.msgHostBtnText}>Message Host</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Cancellation ── */}
        {listing.cancellationPolicy && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Cancellation Policy</Text>
            <View style={[s.cancelCard, { borderLeftColor: cancelColor(listing.cancellationPolicy) }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <View style={[s.cancelDot, { backgroundColor: cancelColor(listing.cancellationPolicy) }]} />
                <Text style={[s.cancelPolicyName, { color: cancelColor(listing.cancellationPolicy) }]}>
                  {listing.cancellationPolicy.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </Text>
              </View>
              <Text style={s.cancelDesc}>{cancelText(listing.cancellationPolicy)}</Text>
            </View>
          </View>
        )}

        {/* ── Reviews ── */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Guest Reviews</Text>
            {avgRating != null && totalReviews > 0 && (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "900", color: TEXT }}>{avgRating.toFixed(1)}</Text>
                <Stars n={Math.round(avgRating)} size={12} />
                <Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{totalReviews} review{totalReviews !== 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>
          {reviews.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24, backgroundColor: BG, borderRadius: 16 }}>
              <Ionicons name="chatbubble-outline" size={32} color={MUTED} />
              <Text style={{ fontSize: 14, color: MUTED, marginTop: 8 }}>No reviews yet</Text>
            </View>
          ) : (
            <>
              {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
              {totalReviews > reviews.length && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 }}
                  onPress={() => router.push(`/listing-reviews/${id}` as any)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: GREEN }}>View All {totalReviews} Reviews</Text>
                  <Ionicons name="arrow-forward" size={16} color={GREEN} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Location ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Location</Text>
          {listing.address ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12, padding: 14, backgroundColor: BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ionicons name="location" size={18} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>{listing.address}</Text>
                {locationStr ? <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{locationStr}</Text> : null}
              </View>
            </View>
          ) : null}

          {listing.lat != null && listing.lng != null && !isNaN(Number(listing.lat)) && !isNaN(Number(listing.lng)) ? (
            <View style={{ borderRadius: 18, overflow: "hidden", height: 210, borderWidth: 1, borderColor: BORDER, position: "relative" }}>
              {MapView && Marker ? (
                <MapView
                  style={{ flex: 1 }}
                  mapType="standard"
                  userInterfaceStyle="light"
                  initialRegion={{
                    latitude: Number(listing.lat),
                    longitude: Number(listing.lng),
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker
                    coordinate={{ latitude: Number(listing.lat), longitude: Number(listing.lng) }}
                    title={listing.name ?? listing.title ?? "Location"}
                  >
                    <View style={s.customMapPin}>
                      <Ionicons name="location" size={18} color="#ffffff" />
                    </View>
                  </Marker>
                </MapView>
              ) : (
                <View style={{ flex: 1, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="map-outline" size={36} color={MUTED} />
                  <Text style={{ fontSize: 13, color: MUTED, marginTop: 6, fontWeight: "500" }}>Location Map</Text>
                </View>
              )}

              {/* Get Directions overlay button */}
              <TouchableOpacity
                style={s.mapDirectionsBtn}
                onPress={() => openLocationInMaps(Number(listing.lat), Number(listing.lng), listing.name ?? listing.address ?? "Property")}
                activeOpacity={0.88}
              >
                <Ionicons name="navigate-outline" size={14} color={GREEN} />
                <Text style={s.mapDirectionsText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ══ MESSAGE HOST MODAL ══ */}
      <Modal
        visible={showMsgModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowMsgModal(false); setMsgDraft(""); }}
      >
        <View style={s.msgBackdrop}>
          <View style={s.msgCard}>
            <View style={s.msgCardHeader}>
              <Text style={s.msgCardTitle}>Message Host</Text>
              <TouchableOpacity
                onPress={() => { setShowMsgModal(false); setMsgDraft(""); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={TEXT} />
              </TouchableOpacity>
            </View>
            <Text style={s.msgCardSub} numberOfLines={1}>
              About: {listing.title ?? listing.name ?? "this listing"}
            </Text>
            <TextInput
              style={s.msgCardInput}
              value={msgDraft}
              onChangeText={setMsgDraft}
              placeholder="Hi! I'm interested in your listing…"
              placeholderTextColor={MUTED}
              multiline
              maxLength={500}
              autoFocus
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                s.msgSendBtn,
                (!msgDraft.trim() || msgSending) && s.msgSendBtnOff,
              ]}
              onPress={handleMessageHost}
              disabled={!msgDraft.trim() || msgSending}
              activeOpacity={0.88}
            >
              {msgSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={s.msgSendText}>Send Message</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ FULLSCREEN GALLERY MODAL ══ */}
      <Modal visible={galleryOpen} transparent={false} animationType="fade" onRequestClose={() => setGalleryOpen(false)}>
        <GalleryModal
          photos={photos}
          photoIdx={photoIdx}
          setPhotoIdx={setPhotoIdx}
          onClose={() => setGalleryOpen(false)}
        />
      </Modal>

      {/* ══ DATE PICKER MODAL ══ */}
      <CalendarPicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(start, end) => { setLocalStart(start); setLocalEnd(end); }}
        isCar={isCar}
        unavailableRanges={availability?.unavailableRanges ?? []}
      />

      {/* ══ STICKY BOTTOM BAR ══ */}
      <View style={s.stickyBar}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          {hasDates && pricingBreakout ? (
            <>
              <Text style={s.stickyRate}>{curr} {Math.round(pricingBreakout.total).toLocaleString()}</Text>
              <Text style={s.stickyUnit} numberOfLines={1}>
                total for {pricingBreakout.count} {isCar ? `day${pricingBreakout.count !== 1 ? "s" : ""}` : `night${pricingBreakout.count !== 1 ? "s" : ""}`}
                {selectedRoomType ? ` · ${selectedRoomType.name}` : ""}
              </Text>
            </>
          ) : (
            <>
              {mrpPrice != null && mrpPrice > rate ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={s.stickyOriginal}>{curr} {Math.round(mrpPrice).toLocaleString()}</Text>
                  {customPromoBadge ? (
                    <Text style={{ fontSize: 10, fontWeight: "800", color: customPromoBadge.labelColour ?? "#C84B2F" }}>
                      {customPromoBadge.labelText}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <Text style={s.stickyRate}>{curr} {Math.round(rate).toLocaleString()}</Text>
              <Text style={s.stickyUnit} numberOfLines={1}>
                {rateLabel}
                {selectedRoomType ? ` · ${selectedRoomType.name}` : ""}
              </Text>
            </>
          )}
        </View>

        {isProvider ? (
          <View style={s.providerBtn}>
            <Text style={s.providerBtnText}>Provider view</Text>
          </View>
        ) : !hasDates ? (
          <TouchableOpacity style={s.selectDatesBtn} onPress={() => setShowDatePicker(true)}>
            <Text style={s.selectDatesBtnText}>Select dates</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.bookBtn} onPress={handleBook} activeOpacity={0.88}>
            <Text style={s.bookBtnText}>Reserve Now</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlayTop: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 56 : 42,
    zIndex: 999, elevation: 999,
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },

  photoPill: {
    position: "absolute", bottom: 14, right: 14,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  photoPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  titleCard: {
    backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "800", color: TEXT, lineHeight: 30 },
  catBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: "flex-start",
  },
  catBadgeText: { fontSize: 12, fontWeight: "700", color: "#1D4ED8" },
  accreditedBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: GREEN_LIGHT, borderWidth: 1, borderColor: "#BBF7D0",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  accreditedText: { fontSize: 11, fontWeight: "700", color: GREEN },

  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  priceOriginal: { fontSize: 15, fontWeight: "600", color: MUTED, textDecorationLine: "line-through" },
  mrpLabel: { fontSize: 11, fontWeight: "700", color: MUTED },
  priceAmount: { fontSize: 28, fontWeight: "900", color: GREEN },
  priceUnit: { fontSize: 13, color: MUTED, fontWeight: "500" },
  bestDeal: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: GREEN_LIGHT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#BBF7D0" },
  bestDealText: { fontSize: 11, fontWeight: "700", color: GREEN },
  promoDealBadge: { backgroundColor: "#C84B2F", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "center" },
  promoDealText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },

  promoBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginVertical: 12, backgroundColor: "#FEF2F2", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#FECACA" },
  promoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  promoTitle: { fontSize: 14, fontWeight: "800", color: "#DC2626", marginBottom: 2 },
  promoSub: { fontSize: 12, color: "#991B1B", lineHeight: 17 },

  section: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: BORDER },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: TEXT, marginBottom: 14, letterSpacing: -0.3 },

  datesPill: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: GREEN_LIGHT, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#BBF7D0" },
  datesText: { fontSize: 13, fontWeight: "600", color: GREEN, flex: 1 },
  selectDatesCard: { flexDirection: "row", alignItems: "center", backgroundColor: BG, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: GREEN, borderStyle: "dashed" },

  breakCard: { backgroundColor: BG, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER },
  breakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  breakLabel: { fontSize: 13, color: "#4B5563", fontWeight: "500" },
  breakVal: { fontSize: 13, color: TEXT, fontWeight: "600" },
  breakTotal: { fontSize: 15, fontWeight: "800", color: TEXT },
  breakTotalVal: { fontSize: 16, fontWeight: "900", color: GREEN },

  descText: { fontSize: 14, color: "#374151", lineHeight: 22 },
  readMore: { marginTop: 10 },
  readMoreText: { fontSize: 14, color: GREEN, fontWeight: "700" },

  hostCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: BG, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER },
  hostAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center" },
  hostName: { fontSize: 15, fontWeight: "700", color: TEXT },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: GREEN_LIGHT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontSize: 11, fontWeight: "700", color: GREEN },

  cancelCard: { backgroundColor: BG, borderRadius: 14, padding: 16, borderLeftWidth: 4, borderWidth: 1, borderColor: BORDER },
  cancelDot: { width: 10, height: 10, borderRadius: 5 },
  cancelPolicyName: { fontSize: 14, fontWeight: "700" },
  cancelDesc: { fontSize: 13, color: "#374151", lineHeight: 20 },

  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === "ios" ? 30 : 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  stickyOriginal: { fontSize: 12, color: MUTED, textDecorationLine: "line-through" },
  stickyRate: { fontSize: 20, fontWeight: "900", color: GREEN },
  stickyUnit: { fontSize: 11, color: MUTED, fontWeight: "500" },
  bookBtn: { flexDirection: "row", alignItems: "center", backgroundColor: GREEN, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14 },
  bookBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  selectDatesBtn: { borderWidth: 2, borderColor: GREEN, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 13 },
  selectDatesBtnText: { color: GREEN, fontWeight: "700", fontSize: 14 },
  providerBtn: { backgroundColor: BG, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13, borderWidth: 1, borderColor: BORDER },
  providerBtnText: { color: MUTED, fontWeight: "600", fontSize: 13 },

  customMapPin: {
    backgroundColor: GREEN,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  mapDirectionsBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  mapDirectionsText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },

  msgHostBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14,
    backgroundColor: GREEN_LIGHT, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
    borderWidth: 1, borderColor: "#BBF7D0", alignSelf: "flex-start",
  },
  msgHostBtnText: { fontSize: 14, fontWeight: "700", color: GREEN },

  msgBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "flex-end" },
  msgCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  msgCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  msgCardTitle: { fontSize: 18, fontWeight: "800", color: TEXT },
  msgCardSub: { fontSize: 13, color: MUTED, marginBottom: 16 },
  msgCardInput: {
    backgroundColor: BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: TEXT,
    minHeight: 100, maxHeight: 180,
    marginBottom: 16,
  },
  msgSendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15,
  },
  msgSendBtnOff: { backgroundColor: "#D1D5DB" },
  msgSendText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const pr = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F0FDF4", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#BBF7D0", marginBottom: 10 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { fontSize: 14, fontWeight: "800", color: "#065F46", marginBottom: 3 },
  desc: { fontSize: 12, color: "#047857", lineHeight: 17, marginBottom: 4 },
  expiry: { fontSize: 11, color: MUTED },
  savings: { fontSize: 13, fontWeight: "700", color: "#DC2626", marginBottom: 3 },
  origPrice: { fontSize: 12, color: "#047857" },
  discBadge: { minWidth: 52, borderRadius: 10, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", flexShrink: 0, paddingHorizontal: 8, paddingVertical: 8 },
  discText: { fontSize: 11, fontWeight: "800", color: "#fff", textAlign: "center", lineHeight: 15 },
});
