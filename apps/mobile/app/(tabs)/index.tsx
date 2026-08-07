import { useState, useEffect, useRef, useMemo, memo } from "react";
import {
  View, Text, ScrollView, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, Modal, Animated, ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { listingApi } from "../../lib/listing-api";
import { ListingImage } from "../../components/ListingImage";
import { K } from "../../constants/theme";
import { ActivePromotion, applyPromotion } from "../../lib/promotions";
import { useLoyaltyProfile } from "../../hooks/loyalty";
import { computeTierProgress } from "../../constants/loyaltyTiers";
import { useUnreadNotificationCount } from "../../hooks/notifications";
import { useLocation } from "../../hooks/useLocation";
import { useRefreshOnFocus } from "../../hooks/useRefreshOnFocus";
import { useCallback } from "react";
import DateRangePickerModal from "../../components/ui/DateRangePickerModal";


const { width: W } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string; listingType: string; title: string; city: string; countryCode: string;
  distanceKm: number; primaryPhotoUrl: string | null; nightlyRate: number | null;
  dailyRate: number | null; currency: string; starRating: number | null;
  lat?: number | null; lng?: number | null;
  // Localized by the API when a currency is requested; display-only.
  localizedNightlyRate?: number | null; localizedDailyRate?: number | null;
  localizedCurrency?: string | null;
  isAccredited: boolean; longStayDiscountEnabled?: boolean;
  carMake: string | null; carModel: string | null; carYear: number | null;
  transmission: string | null; seats: number | null;
  promoBadge?: { labelText: string; labelColour?: string } | null;
  roomTypes?: Array<{ id: string; name: string; roomType: string; pricePerNight: number }> | null;
}
interface SearchResponse { data: { totalCount: number; nextCursor: string | null; results: SearchResult[] } }
interface Promotion {
  title: string;
  description: string;
  bannerUrl?: string | null;
  ctaRoute?: string;
  discountPercent?: number;
  discountAmount?: number;
  activity?: string;
  expiresAt?: string;
}
interface Voucher { id: string; code: string; title: string; description?: string; discountPercent?: number; discountAmount?: number; expiresAt?: string }
interface RecentBooking { id: string; listingId: string; listingTitle?: string; checkIn: string; checkOut: string; status: string; totalAmount: number; currency: string }

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
function fmtShortDate(s: string): string {
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return s; }
}
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ── Countdown Hook ────────────────────────────────────────────────────────────

function useCountdown(expiresAt?: string): string {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    function tick() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("ENDED"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const sv = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sv).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return timeLeft;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Date Picker ───────────────────────────────────────────────────────────────

function DatePickerModal({ visible, title, minDate, onSelect, onClose }: {
  visible: boolean; title: string; minDate?: Date; onSelect: (d: Date) => void; onClose: () => void;
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
    if (minDate) { const m2 = new Date(minDate); m2.setHours(0, 0, 0, 0); if (d <= m2) return true; }
    return false;
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={dp.sheet} activeOpacity={1} onPress={() => { }}>
          <View style={dp.handle} />
          <Text style={dp.title}>{title}</Text>
          <View style={dp.navRow}>
            <TouchableOpacity onPress={prevMonth} style={dp.navBtn}><Ionicons name="chevron-back" size={20} color={K.colors.darkGreen} /></TouchableOpacity>
            <Text style={dp.monthLabel}>{MONTHS[mo]} {yr}</Text>
            <TouchableOpacity onPress={nextMonth} style={dp.navBtn}><Ionicons name="chevron-forward" size={20} color={K.colors.darkGreen} /></TouchableOpacity>
          </View>
          <View style={dp.dowRow}>{DAYS.map(d => <Text key={d} style={dp.dow}>{d}</Text>)}</View>
          <View style={dp.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={dp.emptyCell} />;
              const disabled = isDisabled(day);
              return (
                <TouchableOpacity key={day} style={[dp.cell, disabled && dp.cellDisabled]}
                  onPress={() => { if (!disabled) { onSelect(new Date(yr, mo, day)); onClose(); } }} disabled={disabled}>
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: K.radius.modal, borderTopRightRadius: K.radius.modal, padding: 24, paddingBottom: 44 },
  handle: { width: 40, height: 4, backgroundColor: K.colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  title: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, textAlign: "center", marginBottom: 20 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: K.radius.full, backgroundColor: K.colors.bgSubtle },
  monthLabel: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  dowRow: { flexDirection: "row", marginBottom: 8 },
  dow: { width: "14.28%", textAlign: "center", fontSize: 12, fontWeight: "700", color: K.colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  emptyCell: { width: "14.28%", height: 44 },
  cell: { width: "14.28%", height: 44, alignItems: "center", justifyContent: "center", borderRadius: K.radius.full },
  cellDisabled: { opacity: 0.25 },
  cellText: { fontSize: 14, fontWeight: "500", color: K.colors.textDark },
  cellTextDisabled: { color: K.colors.textMuted },
  cancelBtn: { marginTop: 20, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontSize: K.font.base, color: K.colors.textMuted, fontWeight: "600" },
});

// ── Skeleton ──────────────────────────────────────────────────────────────────

const SkeletonBlock = memo(function SkeletonBlock({
  width, height, radius = 8,
}: { width: number | string; height: number; radius?: number }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [opacity]);
  return <Animated.View style={[{ borderRadius: radius, backgroundColor: K.colors.bgSubtle, opacity }, { width: width as any, height }]} />;
});

function CarouselSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}
      contentContainerStyle={{ paddingHorizontal: K.spacing.screen, gap: 12 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ gap: 8 }}>
          <SkeletonBlock width={240} height={160} radius={K.radius.card} />
          <SkeletonBlock width={160} height={13} radius={6} />
          <SkeletonBlock width={100} height={11} radius={6} />
          <SkeletonBlock width={80} height={16} radius={6} />
        </View>
      ))}
    </ScrollView>
  );
}

function EliteCardSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}
      contentContainerStyle={{ paddingHorizontal: K.spacing.screen, gap: 14 }}>
      {[0, 1].map(i => (
        <View key={i} style={{ gap: 10 }}>
          <SkeletonBlock width={W - 48} height={220} radius={K.radius.xl} />
          <SkeletonBlock width={200} height={14} radius={6} />
          <SkeletonBlock width={120} height={11} radius={6} />
          <SkeletonBlock width={100} height={18} radius={6} />
        </View>
      ))}
    </ScrollView>
  );
}

// ── Listing Card ──────────────────────────────────────────────────────────────

const ListingCard = memo(function ListingCard({ item, onPress, width = 240, badgeLabel, badgeColor, photoUrl, promotion }: {
  item: SearchResult; onPress: () => void; width?: number;
  badgeLabel?: string; badgeColor?: string; photoUrl?: string | null;
  promotion?: ActivePromotion | null;
}) {
  const isCar = item.listingType === "car";
  const isApt = item.listingType === "apartment";
  const rate = isCar
    ? (item.localizedDailyRate ?? item.dailyRate)
    : (item.localizedNightlyRate ?? item.nightlyRate);
  const rateCurrency = item.localizedCurrency ?? item.currency;
  const unit = isCar ? "day" : "night";
  const [imgErr, setImgErr] = useState(false);
  const displayPhoto = photoUrl ?? null;
  const fallbackEmoji = isCar ? "🚗" : isApt ? "🏠" : "🏨";
  const cardTitle = isCar && item.carMake
    ? `${item.carMake} ${item.carModel ?? ""} ${item.carYear ?? ""}`.trim()
    : item.title;

  const promoPercentFromBadge = item.promoBadge?.labelText
    ? parseFloat(item.promoBadge.labelText.replace(/[^0-9.]/g, ""))
    : 0;

  const effectivePromo: ActivePromotion | null = item.promoBadge && promoPercentFromBadge > 0
    ? {
      activity: isCar ? "car" : isApt ? "apartment" : "hotel",
      discountType: "percentage",
      discountValue: String(promoPercentFromBadge),
      labelText: item.promoBadge.labelText,
      bannerTitle: item.promoBadge.labelText,
      status: "active",
      applyToBooking: true,
    }
    : promotion ?? null;

  const promoted = applyPromotion(rate, effectivePromo);
  return (
    <TouchableOpacity style={[lc.card, { width }]} onPress={onPress} activeOpacity={0.88}>
      <View style={lc.imgWrap}>
        {!imgErr && displayPhoto
          ? <ListingImage uri={displayPhoto} style={lc.photo} onError={() => setImgErr(true)} />
          : <View style={[lc.photo, lc.photoFallback]}><Text style={{ fontSize: 38 }}>{fallbackEmoji}</Text></View>
        }
        {badgeLabel && (
          <View style={[lc.badge, { backgroundColor: badgeColor ?? K.colors.accent }]}>
            <Text style={lc.badgeText}>{badgeLabel}</Text>
          </View>
        )}
        {item.starRating != null && item.starRating > 0 && (
          <View style={lc.ratingPill}>
            <Ionicons name="star" size={10} color="#f5b31a" />
            <Text style={lc.ratingText}>{item.starRating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <View style={lc.body}>
        <Text style={lc.title} numberOfLines={1}>{cardTitle}</Text>
        <View style={lc.locRow}>
          <Ionicons name="location-outline" size={11} color={K.colors.textMuted} />
          <Text style={lc.loc} numberOfLines={1}>{item.city}</Text>
        </View>
        {promoted.hasPromotion && promoted.discountedPrice != null ? (
          <View>
            <View style={lc.priceRow}>
              <Text style={lc.originalPrice}>{fmtPrice(rate, rateCurrency)}</Text>
              <Text style={lc.promoBadgeText}>🔥 {promoted.labelText}</Text>
            </View>
            <View style={lc.priceRow}>
              <Text style={lc.price}>{fmtPrice(Math.round(promoted.discountedPrice), rateCurrency)}</Text>
              <Text style={lc.priceUnit}>/{unit}</Text>
            </View>
          </View>
        ) : (
          <View style={lc.priceRow}>
            {item.roomTypes && item.roomTypes.length > 1 ? (
              <Text style={{ fontSize: 10, color: K.colors.textMuted, fontWeight: "500" }}>From </Text>
            ) : null}
            <Text style={lc.price}>{fmtPrice(rate, rateCurrency)}</Text>
            {rate ? <Text style={lc.priceUnit}>/{unit}</Text> : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});
const lc = StyleSheet.create({
  card: { backgroundColor: K.colors.bgCard, borderRadius: K.radius.card, overflow: "hidden", borderWidth: 1, borderColor: K.colors.border, ...K.shadow.sm },
  imgWrap: { position: "relative" },
  photo: { width: "100%", height: 160 },
  photoFallback: { backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 10, left: 10, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  ratingPill: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.60)", borderRadius: K.radius.full, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  body: { padding: 12 },
  title: { fontSize: 13, fontWeight: "700", color: K.colors.textDark, marginBottom: 4 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  loc: { fontSize: 11, color: K.colors.textMuted, flex: 1 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 2 },
  originalPrice: { fontSize: 11, color: K.colors.textMuted, textDecorationLine: "line-through" },
  promoBadgeText: { fontSize: 10, fontWeight: "800", color: "#dc2626" },
  price: { fontSize: 15, fontWeight: "800", color: K.colors.darkGreen },
  priceUnit: { fontSize: 11, color: K.colors.textMuted },
});

// ── Elite Card ────────────────────────────────────────────────────────────────

const EliteCard = memo(function EliteCard({ item, onPress, badgeLabel, badgeColor, photoUrl, promotion }: {
  item: SearchResult; onPress: () => void; badgeLabel?: string; badgeColor?: string;
  photoUrl?: string | null; promotion?: ActivePromotion | null;
}) {
  const isCar = item.listingType === "car";
  const isApt = item.listingType === "apartment";
  const rate = isCar
    ? (item.localizedDailyRate ?? item.dailyRate)
    : (item.localizedNightlyRate ?? item.nightlyRate);
  const rateCurrency = item.localizedCurrency ?? item.currency;
  const unit = isCar ? "day" : "night";
  const [imgErr, setImgErr] = useState(false);
  const fallbackEmoji = isCar ? "🚗" : isApt ? "🏠" : "🏨";
  const cardTitle = isCar && item.carMake
    ? `${item.carMake} ${item.carModel ?? ""} ${item.carYear ?? ""}`.trim()
    : item.title;

  const promoPercentFromBadge = item.promoBadge?.labelText
    ? parseFloat(item.promoBadge.labelText.replace(/[^0-9.]/g, ""))
    : 0;

  const effectivePromo: ActivePromotion | null = item.promoBadge && promoPercentFromBadge > 0
    ? {
      activity: isCar ? "car" : isApt ? "apartment" : "hotel",
      discountType: "percentage",
      discountValue: String(promoPercentFromBadge),
      labelText: item.promoBadge.labelText,
      bannerTitle: item.promoBadge.labelText,
      status: "active",
      applyToBooking: true,
    }
    : promotion ?? null;

  const promoted = applyPromotion(rate, effectivePromo);
  return (
    <TouchableOpacity style={ec.card} onPress={onPress} activeOpacity={0.88}>
      <View style={ec.imgWrap}>
        {!imgErr && photoUrl
          ? <ListingImage uri={photoUrl} style={ec.photo} onError={() => setImgErr(true)} />
          : <View style={[ec.photo, ec.photoFallback]}><Text style={{ fontSize: 52 }}>{fallbackEmoji}</Text></View>
        }
        <View style={ec.gradientOverlay} />
        {badgeLabel && (
          <View style={[ec.badge, { backgroundColor: badgeColor ?? K.colors.darkGreen }]}>
            <Text style={ec.badgeText}>{badgeLabel}</Text>
          </View>
        )}
        {item.starRating != null && item.starRating > 0 && (
          <View style={ec.ratingPill}>
            <Ionicons name="star" size={12} color="#f5b31a" />
            <Text style={ec.ratingText}>{item.starRating.toFixed(1)}</Text>
          </View>
        )}
        {item.isAccredited && (
          <View style={ec.accreditedPill}>
            <Ionicons name="shield-checkmark" size={10} color={K.colors.accentLight} />
            <Text style={ec.accreditedText}>Verified</Text>
          </View>
        )}
      </View>
      <View style={ec.body}>
        <Text style={ec.title} numberOfLines={1}>{cardTitle}</Text>
        <View style={ec.locRow}>
          <Ionicons name="location-outline" size={12} color={K.colors.textMuted} />
          <Text style={ec.loc} numberOfLines={1}>{item.city}</Text>
        </View>
        {promoted.hasPromotion && promoted.discountedPrice != null ? (
          <View>
            <View style={ec.priceRow}>
              <Text style={ec.originalPrice}>{fmtPrice(rate, rateCurrency)}</Text>
              <Text style={ec.promoLabel}>🔥 {promoted.labelText}</Text>
            </View>
            <View style={ec.priceRow}>
              <Text style={ec.price}>{fmtPrice(Math.round(promoted.discountedPrice), rateCurrency)}</Text>
              <Text style={ec.unit}>/{unit}</Text>
            </View>
          </View>
        ) : (
          <View style={ec.priceRow}>
            <Text style={ec.price}>{fmtPrice(rate, rateCurrency)}</Text>
            {rate ? <Text style={ec.unit}>/{unit}</Text> : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});
const ec = StyleSheet.create({
  card: {
    width: W - 48,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    overflow: "hidden",
    ...K.shadow.md,
  },
  imgWrap: { position: "relative" },
  photo: { width: "100%", height: 220 },
  photoFallback: { backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center" },
  gradientOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 70,
    backgroundColor: "rgba(2,25,13,0.28)",
  },
  badge: {
    position: "absolute", top: 12, left: 12,
    borderRadius: K.radius.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  ratingPill: {
    position: "absolute", top: 12, right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: K.radius.full, paddingHorizontal: 9, paddingVertical: 5,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  ratingText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  accreditedPill: {
    position: "absolute", bottom: 12, right: 12,
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.full, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  accreditedText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  body: { padding: 14 },
  title: { fontSize: K.font.base, fontWeight: "800", color: K.colors.textDark, marginBottom: 5 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  loc: { fontSize: 12, color: K.colors.textMuted, flex: 1 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 2 },
  originalPrice: { fontSize: 12, color: K.colors.textMuted, textDecorationLine: "line-through" },
  promoLabel: { fontSize: 11, fontWeight: "800", color: "#dc2626" },
  price: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.darkGreen },
  unit: { fontSize: 12, color: K.colors.textMuted },
});

// ── Compact Car Card ──────────────────────────────────────────────────────────

const CompactCarCard = memo(function CompactCarCard({ item, onPress, photoUrl, promotion }: {
  item: SearchResult; onPress: () => void; photoUrl?: string | null; promotion?: ActivePromotion | null;
}) {
  const [imgErr, setImgErr] = useState(false);
  const cardTitle = item.carMake
    ? `${item.carMake} ${item.carModel ?? ""} ${item.carYear ?? ""}`.trim()
    : item.title;
  const carRate = item.localizedDailyRate ?? item.dailyRate;
  const rateCurrency = item.localizedCurrency ?? item.currency;
  const promoted = applyPromotion(carRate, promotion ?? null);
  const pct = promotion?.discountType === "percentage"
    ? Number(promotion.discountValue)
    : (carRate && promoted.savings)
      ? Math.round((promoted.savings / carRate) * 100)
      : null;
  return (
    <TouchableOpacity style={cc.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cc.imgWrap}>
        {!imgErr && photoUrl
          ? <ListingImage uri={photoUrl} style={cc.photo} onError={() => setImgErr(true)} />
          : <View style={[cc.photo, cc.photoFallback]}><Text style={{ fontSize: 28 }}>🚗</Text></View>
        }
        {pct && pct > 0 ? (
          <View style={cc.discBadge}>
            <Text style={cc.discText}>{pct}% OFF</Text>
          </View>
        ) : null}
      </View>
      <View style={cc.details}>
        <Text style={cc.title} numberOfLines={1}>{cardTitle}</Text>
        <View style={cc.specRow}>
          {item.transmission ? (
            <View style={cc.spec}>
              <Ionicons name="settings-outline" size={11} color={K.colors.textMuted} />
              <Text style={cc.specText}>{item.transmission}</Text>
            </View>
          ) : null}
          {item.seats ? (
            <View style={cc.spec}>
              <Ionicons name="people-outline" size={11} color={K.colors.textMuted} />
              <Text style={cc.specText}>{item.seats} seats</Text>
            </View>
          ) : null}
          <View style={cc.spec}>
            <Ionicons name="location-outline" size={11} color={K.colors.textMuted} />
            <Text style={cc.specText}>{item.city}</Text>
          </View>
        </View>
        {promoted.hasPromotion && promoted.discountedPrice != null ? (
          <View>
            <Text style={cc.originalPrice}>{fmtPrice(carRate, rateCurrency)}</Text>
            <Text style={cc.price}>{fmtPrice(Math.round(promoted.discountedPrice), rateCurrency)}<Text style={cc.unit}>/day</Text></Text>
          </View>
        ) : (
          <Text style={cc.price}>{fmtPrice(carRate, rateCurrency)}<Text style={cc.unit}>/day</Text></Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={K.colors.border} />
    </TouchableOpacity>
  );
});
const cc = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: K.colors.bgCard, borderRadius: K.radius.lg,
    padding: 12, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.xs,
    gap: 12,
  },
  imgWrap: { position: "relative" },
  photo: { width: 100, height: 80, borderRadius: K.radius.md },
  photoFallback: { backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center" },
  discBadge: {
    position: "absolute", top: 4, left: 4,
    backgroundColor: "#dc2626", borderRadius: K.radius.full, paddingHorizontal: 6, paddingVertical: 3,
  },
  discText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  details: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: K.colors.textDark, marginBottom: 4 },
  specRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  spec: { flexDirection: "row", alignItems: "center", gap: 3 },
  specText: { fontSize: 11, color: K.colors.textMuted },
  originalPrice: { fontSize: 11, color: K.colors.textMuted, textDecorationLine: "line-through", marginBottom: 1 },
  price: { fontSize: K.font.base, fontWeight: "800", color: K.colors.darkGreen },
  unit: { fontSize: 11, fontWeight: "400", color: K.colors.textMuted },
});

// ── Section Head ──────────────────────────────────────────────────────────────

const SectionHead = memo(function SectionHead({ title, subtitle, onViewAll }: {
  title: string; subtitle?: string; onViewAll?: () => void;
}) {
  return (
    <View style={sh.row}>
      <View style={{ flex: 1 }}>
        <Text style={sh.title}>{title}</Text>
        {subtitle ? <Text style={sh.subtitle}>{subtitle}</Text> : null}
      </View>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll} style={sh.viewAllWrap}>
          <Text style={sh.link}>View all</Text>
          <Ionicons name="chevron-forward" size={12} color={K.colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
});
const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: K.spacing.screen, marginBottom: 14 },
  title: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: K.colors.textMuted, marginTop: 2 },
  viewAllWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  link: { fontSize: K.font.sm, color: K.colors.accent, fontWeight: "700" },
});

// ── Promo Category Banner ─────────────────────────────────────────────────────

function fmtPromoExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const PromoBanner = memo(function PromoBanner({ promo, onPress }: {
  promo: Promotion; onPress: () => void;
}) {
  if (!promo || !promo.title || !promo.title.trim()) return null;
  const discountText = promo.discountPercent
    ? `${promo.discountPercent}% OFF`
    : promo.discountAmount
      ? `SAVE ${promo.discountAmount}`
      : "SPECIAL OFFER";
  return (
    <TouchableOpacity style={pbn.wrap} onPress={onPress} activeOpacity={0.88}>
      <Text style={pbn.fire}>🔥</Text>
      <View style={{ flex: 1 }}>
        <Text style={pbn.text} numberOfLines={1}>{promo.title}</Text>
        {promo.expiresAt ? (
          <Text style={pbn.sub}>Valid until {fmtPromoExpiry(promo.expiresAt)}</Text>
        ) : null}
      </View>
      <View style={pbn.discBadge}>
        <Text style={pbn.discText}>{discountText}</Text>
      </View>
    </TouchableOpacity>
  );
});
const pbn = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFF7ED", borderRadius: K.radius.md,
    borderWidth: 1, borderColor: "#FED7AA",
    paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: K.spacing.screen, marginBottom: 10,
    gap: 10, ...K.shadow.xs,
  },
  fire: { fontSize: 18 },
  text: { fontSize: 13, fontWeight: "700", color: "#92400e" },
  sub: { fontSize: 11, color: "#b45309", marginTop: 2 },
  discBadge: { backgroundColor: "#dc2626", borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  discText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

// ── Promo Slider ──────────────────────────────────────────────────────────────

const PROMO_BG_IMAGES: Record<string, any> = {
  hotel: require("../../assets/promotionimgs/hotel.png"),
  apartment: require("../../assets/promotionimgs/apartement.png"),
  car: require("../../assets/promotionimgs/car.png"),
};

const PROMO_PALETTES = [
  { bg: K.colors.darkGreen, eyebrow: K.colors.accentLight, sub: "rgba(255,255,255,0.72)" },
  { bg: K.colors.darkGreenMid, eyebrow: "#7de8b4", sub: "rgba(255,255,255,0.72)" },
  { bg: "#1a0f40", eyebrow: "#a78bfa", sub: "rgba(255,255,255,0.68)" },
  { bg: "#5c1717", eyebrow: "#fca5a5", sub: "rgba(255,255,255,0.68)" },
];

const PromoSlider = memo(function PromoSlider({ promos, onPress }: {
  promos: Promotion[]; onPress: (p: Promotion) => void;
}) {
  const SLIDE_W = W - K.spacing.screen * 2;
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (promos.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % promos.length;
        scrollRef.current?.scrollTo({ x: next * SLIDE_W, animated: true });
        return next;
      });
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [promos.length, SLIDE_W]);

  return (
    <View style={{ marginHorizontal: K.spacing.screen }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => setActive(Math.round(e.nativeEvent.contentOffset.x / SLIDE_W))}
        style={{ borderRadius: K.radius.xl, overflow: "hidden" }}
      >
        {promos.map((p, idx) => {
          const pal = PROMO_PALETTES[idx % PROMO_PALETTES.length];
          const dv = (p as any).discountValue;
          const dt = (p as any).discountType;
          const discPct = p.discountPercent ?? (dt === "percentage" ? Number(dv) : null);
          const discAmt = p.discountAmount ?? (dt === "fixed" ? Number(dv) : null);
          const bgImage = p.activity ? PROMO_BG_IMAGES[p.activity] ?? null : null;
          const eyebrowText = (p as any).labelText ?? "EXCLUSIVE DEAL";
          const bannerTitle = (p as any).bannerTitle ?? p.title;
          const discNum = discPct != null ? `${discPct}%` : discAmt != null ? `${discAmt}` : null;
          const discUnit = discPct != null ? "OFF" : discAmt != null ? "SAVE" : null;
          return (
            <TouchableOpacity
              key={idx}
              style={[ps.slideWrap, { width: SLIDE_W }]}
              onPress={() => onPress(p)}
              activeOpacity={0.9}
            >
              <ImageBackground
                source={bgImage}
                style={[ps.slide, { backgroundColor: pal.bg }]}
                imageStyle={ps.bgImage}
                resizeMode="cover"
              >
                {/* layered scrims: full + left-heavy */}
                <View style={ps.scrimFull} />
                <View style={ps.scrimLeft} />

                <View style={ps.contentRow}>
                  {/* ── Left column ── */}
                  <View style={ps.leftCol}>
                    <View style={ps.labelPill}>
                      <Text style={ps.labelPillText}>⚡ {eyebrowText}</Text>
                    </View>
                    <Text style={ps.promoTitle} numberOfLines={2}>{bannerTitle}</Text>
                    <View style={ps.bookBtn}>
                      <Text style={ps.bookBtnText}>Book Now</Text>
                      <Ionicons name="arrow-forward" size={12} color={K.colors.darkGreen} />
                    </View>
                  </View>

                  {/* ── Right — discount stamp ── */}
                  {discNum ? (
                    <View style={ps.discStamp}>
                      <Text style={ps.discNum}>{discNum}</Text>
                      <View style={ps.discDivider} />
                      <Text style={ps.discUnit}>{discUnit}</Text>
                    </View>
                  ) : (
                    <View style={ps.discStamp}>
                      <Text style={{ fontSize: 30 }}>🎁</Text>
                    </View>
                  )}
                </View>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {promos.length > 1 && (
        <View style={ps.dots}>
          {promos.map((_, i) => (
            <View key={i} style={[ps.dot, i === active && ps.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
});
const ps = StyleSheet.create({
  // wrapper keeps rounded corners + clips image
  slideWrap: { borderRadius: K.radius.xl, overflow: "hidden" },
  // ImageBackground fills wrapper
  slide: { height: 172, justifyContent: "center" },
  // image sits at 58% opacity so colors show through nicely
  bgImage: { opacity: 0.58 },
  // full-card darkening
  scrimFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,18,9,0.48)",
  },
  // heavier scrim on the left half so text is always readable
  scrimLeft: {
    position: "absolute", top: 0, left: 0, bottom: 0, width: "58%",
    backgroundColor: "rgba(2,18,9,0.38)",
  },
  // horizontal content layout
  contentRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 22, gap: 14,
  },
  leftCol: { flex: 1 },
  // ⚡ accent label pill
  labelPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(29,158,98,0.22)",
    borderWidth: 1, borderColor: K.colors.accentLight,
    borderRadius: K.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 10,
  },
  labelPillText: { fontSize: 10, fontWeight: "800", color: K.colors.accentLight, letterSpacing: 0.4 },
  // main title
  promoTitle: { fontSize: 18, fontWeight: "800", color: "#fff", lineHeight: 25, marginBottom: 16 },
  // white CTA pill button
  bookBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: K.radius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bookBtnText: { fontSize: 12, fontWeight: "700", color: K.colors.darkGreen },
  // circular discount stamp
  discStamp: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.38)",
    alignItems: "center", justifyContent: "center",
  },
  discNum: { fontSize: 28, fontWeight: "900", color: "#fff", lineHeight: 30 },
  discDivider: { width: 30, height: 1, backgroundColor: "rgba(255,255,255,0.40)", marginVertical: 3 },
  discUnit: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.75)", letterSpacing: 1.5, textTransform: "uppercase" },
  // dots
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: K.colors.border },
  dotActive: { width: 18, backgroundColor: K.colors.accent },
});

// ── Flash Sale Banner ─────────────────────────────────────────────────────────

const FlashSaleBanner = memo(function FlashSaleBanner({ promotion, onPress }: {
  promotion: Promotion; onPress: () => void;
}) {
  const expiresAt = promotion.expiresAt;
  const timeLeft = useCountdown(expiresAt);
  const bannerTitle = (promotion as any).bannerTitle ?? promotion.title;
  const labelText = (promotion as any).labelText ?? "";
  const dv = (promotion as any).discountValue;
  const dt = (promotion as any).discountType;
  const discountText = promotion.discountPercent
    ? `${promotion.discountPercent}% OFF`
    : dv
      ? (dt === "percentage" ? `${dv}% OFF` : `SAVE ${dv}`)
      : "SAVE NOW";
  return (
    <TouchableOpacity style={fsb.card} onPress={onPress} activeOpacity={0.88}>
      <View style={fsb.leftCol}>
        <View style={fsb.eyebrowRow}>
          <Text style={fsb.fire}>⚡</Text>
          <Text style={fsb.eyebrow}>FLASH SALE</Text>
        </View>
        <Text style={fsb.title} numberOfLines={2}>{bannerTitle}</Text>
        {labelText ? <Text style={fsb.sub}>{labelText}</Text> : null}
        <View style={fsb.discBadge}>
          <Text style={fsb.discText}>{discountText}</Text>
        </View>
      </View>
      <View style={fsb.rightCol}>
        <Text style={fsb.timerLabel}>Ends in</Text>
        <Text style={fsb.timer}>{timeLeft || "Limited"}</Text>
        <Ionicons name="arrow-forward-circle-outline" size={28} color={K.colors.accentLight} style={{ marginTop: 10 }} />
      </View>
    </TouchableOpacity>
  );
});
const fsb = StyleSheet.create({
  card: {
    backgroundColor: K.colors.darkGreen, borderRadius: K.radius.xl, padding: 22,
    flexDirection: "row", alignItems: "center", ...K.shadow.brand,
  },
  leftCol: { flex: 1, paddingRight: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  fire: { fontSize: 16 },
  eyebrow: { fontSize: 10, fontWeight: "800", color: K.colors.accentLight, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { fontSize: K.font.xl, fontWeight: "800", color: "#fff", lineHeight: 26, marginBottom: 8 },
  sub: { fontSize: 12, color: "rgba(255,255,255,0.70)", marginBottom: 10 },
  discBadge: { backgroundColor: K.colors.accent, borderRadius: K.radius.full, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
  discText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  rightCol: { width: 90, alignItems: "center", justifyContent: "center" },
  timerLabel: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  timer: { fontSize: 19, fontWeight: "800", color: "#fff" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const localCurrency = useAuthStore((s) => s.localCurrency);
  const firstName = user?.firstName ?? "Traveller";

  // Detected location (IP-based, cached 24 h)
  const { lat: detectedLat, lng: detectedLng, city: detectedCity } = useLocation();
  const homeLat = detectedLat ?? 0;
  const homeLng = detectedLng ?? 0;

  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [showRangePicker, setShowRangePicker] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: hotelsData, isLoading: hotelsLoading, refetch: refetchHotels } = useQuery<SearchResult[]>({
    // Prices are localized per currency by the API, so the currency is part of
    // the cache identity — without it a currency change serves cached amounts
    // still labelled with the previous currency.
    queryKey: ["home-hotels", homeLat, homeLng, localCurrency],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        `/search?category=hotel&lat=${homeLat}&lng=${homeLng}&radius_km=20000&sort=recommended&limit=20`
      );
      return res.data.data.results ?? [];
    },
    staleTime: 0,
  });

  const { data: apartmentsData, isLoading: aptsLoading, refetch: refetchApts } = useQuery<SearchResult[]>({
    queryKey: ["home-apartments", homeLat, homeLng, localCurrency],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        `/search?category=apartment&lat=${homeLat}&lng=${homeLng}&radius_km=20000&sort=recommended&limit=10`
      );
      return res.data.data.results ?? [];
    },
    staleTime: 0,
  });

  const { data: carsData, refetch: refetchCars } = useQuery<SearchResult[]>({
    queryKey: ["home-cars", homeLat, homeLng, localCurrency],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        `/search?category=car&lat=${homeLat}&lng=${homeLng}&radius_km=20000&sort=recommended&limit=10`
      );
      return res.data.data.results ?? [];
    },
    staleTime: 0,
  });

  const { data: promotions } = useQuery<Promotion[]>({
    queryKey: ["promotions-active"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { promotions: Promotion[] } }>("/promotions/active");
        return res.data.data.promotions ?? [];
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: hotelPromotions } = useQuery<Promotion[]>({
    queryKey: ["promotions-active", "hotel"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { promotions: Promotion[] } }>("/promotions/active?activity=hotel");
        return res.data.data.promotions ?? [];
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: aptPromotions } = useQuery<Promotion[]>({
    queryKey: ["promotions-active", "apartment"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { promotions: Promotion[] } }>("/promotions/active?activity=apartment");
        return res.data.data.promotions ?? [];
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: carPromotions } = useQuery<Promotion[]>({
    queryKey: ["promotions-active", "car"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { promotions: Promotion[] } }>("/promotions/active?activity=car");
        return res.data.data.promotions ?? [];
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: recentlyViewed, refetch: refetchRecentlyViewed } = useQuery<SearchResult[]>({
    queryKey: ["recently-viewed", localCurrency],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { listings: SearchResult[] } }>("/guests/me/recently-viewed");
        return res.data.data.listings ?? [];
      } catch { return []; }
    },
    staleTime: 0,
    enabled: !!user,
    retry: false,
  });

  const { data: vouchers } = useQuery<Voucher[]>({
    queryKey: ["vouchers-wallet"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { vouchers: Voucher[] } }>("/vouchers/wallet");
        return res.data.data.vouchers ?? [];
      } catch { return []; }
    },
    staleTime: 5 * 60_000,
    enabled: !!user,
    retry: false,
  });

  const { data: loyalty } = useLoyaltyProfile();
  const { data: notifData } = useUnreadNotificationCount();
  const notifCount = notifData?.count ?? 0;

  const { data: recentBookings, refetch: refetchRecentBookings } = useQuery<RecentBooking[]>({
    queryKey: ["bookings-home"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { bookings: RecentBooking[] } }>("/guests/me/bookings?limit=10");
        const now = new Date();
        return (res.data.data.bookings ?? [])
          .filter(b => new Date(b.checkOut) >= now && !b.status.toLowerCase().includes("cancel"))
          .slice(0, 5);
      } catch { return []; }
    },
    staleTime: 0,
    enabled: !!user,
    retry: false,
  });

  useRefreshOnFocus(useCallback(() => {
    void refetchHotels();
    void refetchApts();
    void refetchCars();
    void refetchRecentlyViewed();
    void refetchRecentBookings();
  }, [refetchHotels, refetchApts, refetchCars, refetchRecentlyViewed, refetchRecentBookings]));

  // ── Derived data ───────────────────────────────────────────────────────────

  const popularHotels = useMemo(() => (hotelsData ?? []).slice(0, 10), [hotelsData]);
  const popularApts = useMemo(() => (apartmentsData ?? []).slice(0, 8), [apartmentsData]);
  const popularCars = useMemo(() => (carsData ?? []).slice(0, 8), [carsData]);

  const hotelPromo = (hotelPromotions?.[0] ?? null) as unknown as ActivePromotion | null;
  const aptPromo = (aptPromotions?.[0] ?? null) as unknown as ActivePromotion | null;
  const carPromo = (carPromotions?.[0] ?? null) as unknown as ActivePromotion | null;

  function promoFor(item: SearchResult): ActivePromotion | null {
    if (item.listingType === "hotel") return hotelPromo;
    if (item.listingType === "apartment") return aptPromo;
    return carPromo;
  }

  // All IDs needed for signed photo fetch
  const allListingIds = useMemo(() => {
    const seen = new Set<string>();
    for (const arr of [popularHotels, popularApts, popularCars, recentlyViewed ?? []]) {
      for (const item of arr) seen.add(item.id);
    }
    return Array.from(seen);
  }, [popularHotels, popularApts, popularCars, recentlyViewed]);

  const publicPhotoQueries = useQueries({
    queries: allListingIds.map(id => ({
      queryKey: ["public-photo", id],
      queryFn: async (): Promise<string | null> => {
        try {
          const res = await listingApi.get<{
            data: { primaryPhotoUrl?: string | null; photos?: Array<{ cdnUrl: string }> };
          }>(`/listings/${id}/public`);
          return res.data.data?.primaryPhotoUrl ?? res.data.data?.photos?.[0]?.cdnUrl ?? null;
        } catch { return null; }
      },
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      retry: false,
    })),
  });

  const signedPhotoMap = useMemo<Record<string, string | null>>(
    () => Object.fromEntries(
      allListingIds.map((id, i) => [id, publicPhotoQueries[i]?.data ?? null])
    ),
    [allListingIds, publicPhotoQueries]
  );

  function photo(item: SearchResult): string | null {
    return signedPhotoMap[item.id] ?? null;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function navToListing(id: string) {
    const p: Record<string, string> = { guests: String(guests) };
    if (checkIn) p.checkIn = formatLocalDate(checkIn);
    if (checkOut) p.checkOut = formatLocalDate(checkOut);
    router.push({ pathname: `/listing/${id}` as any, params: p });
  }

  function handleSearch() {
    const p: Record<string, string> = { guests: String(guests) };
    const placeName = location.trim() || (detectedCity ?? "");
    if (placeName) p.placeName = placeName;
    if (detectedLat != null && !location.trim()) {
      p.detectedLat = String(detectedLat);
      p.detectedLng = String(detectedLng ?? 0);
    }
    if (checkIn) p.checkIn = formatLocalDate(checkIn);
    if (checkOut) p.checkOut = formatLocalDate(checkOut);
    router.push({ pathname: "/search", params: p });
  }

  const isLoading = hotelsLoading || aptsLoading;
  const loyaltyPoints = loyalty?.loyaltyPoints ?? (user as any)?.loyaltyPoints ?? 0;
  const loyaltyTier = loyalty?.currentTier ?? (user as any)?.currentTier ?? "";
  const nextTierTarget = loyalty?.pointsToNextTier ?? null;
  const nextTierName = loyalty?.nextTier ?? null;

  // Tier-based card palette
  // shimmerTop/shimmerBot are used to fake a gradient without LinearGradient
  const TIER_CARD: Record<string, { bg: string; fg: string; fgMuted: string; btnBg: string; shimmerTop: string; shimmerBot: string }> = {
    bronze: { bg: "#C97C3A", fg: "#1e0a00", fgMuted: "rgba(30,10,0,0.50)", btnBg: "#1e0a00", shimmerTop: "rgba(255,200,130,0.22)", shimmerBot: "rgba(80,30,0,0.18)" },
    silver: { bg: "#9EAAB5", fg: "#111827", fgMuted: "rgba(17,24,39,0.50)", btnBg: "#111827", shimmerTop: "rgba(255,255,255,0.22)", shimmerBot: "rgba(30,40,60,0.18)" },
    gold: { bg: "#E8A020", fg: "#1c0f00", fgMuted: "rgba(28,15,0,0.52)", btnBg: "#1c0f00", shimmerTop: "rgba(255,235,100,0.28)", shimmerBot: "rgba(120,55,0,0.20)" },
    diamond: { bg: "#5B8DEF", fg: "#04174a", fgMuted: "rgba(4,23,74,0.52)", btnBg: "#04174a", shimmerTop: "rgba(200,220,255,0.28)", shimmerBot: "rgba(10,30,100,0.18)" },
    platinum: { bg: "#DCD5C8", fg: "#1a1a1a", fgMuted: "rgba(26,26,26,0.50)", btnBg: "#1a1a1a", shimmerTop: "rgba(255,255,255,0.30)", shimmerBot: "rgba(80,70,60,0.15)" },
  };
  const tierKey = loyaltyTier.toLowerCase();
  const tierPalette = TIER_CARD[tierKey] ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <Text style={s.greeting}>{getGreeting()} 👋</Text>
            <Text style={s.subGreeting}>Where would you like to go, {firstName}?</Text>
          </View>
          <View style={s.headerIcons}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/notifications" as any)}>
              <Ionicons name="notifications-outline" size={21} color="#fff" />
              {notifCount > 0 && (
                <View style={s.notifBadge}>
                  <Text style={s.notifBadgeText}>{notifCount > 9 ? "9+" : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
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
                placeholder={detectedCity ? `Near ${detectedCity}` : "Where to?"}
                placeholderTextColor={K.colors.textMuted}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={s.filterBtn} onPress={() => router.push("/search" as any)}>
                <Ionicons name="options-outline" size={18} color={K.colors.darkGreen} />
              </TouchableOpacity>
            </View>
            <View style={s.searchDivider} />
            <View style={s.datesGuestsRow}>
              <TouchableOpacity style={s.dateChip} onPress={() => setShowRangePicker(true)} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={14} color={K.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.chipLabel}>Dates</Text>
                  <Text style={[s.chipValue, (!checkIn || !checkOut) && s.chipPlaceholder]} numberOfLines={1}>
                    {checkIn && checkOut
                      ? `${fmtShortDate(formatLocalDate(checkIn))} – ${fmtShortDate(formatLocalDate(checkOut))} (${Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000))} night${Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)) !== 1 ? "s" : ""})`
                      : "Add dates"}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={s.chipDivider} />
              <View style={s.guestChip}>
                <Ionicons name="person-outline" size={14} color={K.colors.accent} />
                <View>
                  <Text style={s.chipLabel}>Guests</Text>
                  <View style={s.guestCounter}>
                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setGuests(g => Math.max(1, g - 1))}>
                      <Ionicons name="remove-circle" size={20} color={K.colors.darkGreen} />
                    </TouchableOpacity>
                    <Text style={s.guestCount}>{guests}</Text>
                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setGuests(g => Math.min(20, g + 1))}>
                      <Ionicons name="add-circle" size={20} color={K.colors.darkGreen} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.88}>
              <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.searchBtnText}>Search Places</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date range picker */}
        <DateRangePickerModal
          visible={showRangePicker}
          initialStartDate={checkIn ? formatLocalDate(checkIn) : null}
          initialEndDate={checkOut ? formatLocalDate(checkOut) : null}
          onConfirm={(start, end) => {
            setCheckIn(new Date(start + "T00:00:00"));
            setCheckOut(new Date(end + "T00:00:00"));
          }}
          onClose={() => setShowRangePicker(false)}
        />

        {/* ── Promo Banner Carousel ── */}
        {promotions && promotions.length > 0 && (
          <View style={{ marginTop: K.spacing.xl, marginBottom: 4 }}>
            <PromoSlider
              promos={promotions}
              onPress={p => {
                const route = p.ctaRoute ?? (
                  p.activity === "hotel" ? "/browse/hotels" :
                    p.activity === "apartment" ? "/browse/apartments" :
                      p.activity === "car" ? "/browse/cars" : "/search"
                );
                router.push(route as any);
              }}
            />
          </View>
        )}

        {/* ── Category Pills ── */}
        <View style={s.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
            {[
              { label: "Hotels", emoji: "🏨", route: "/browse/hotels" },
              { label: "Homes", emoji: "🏠", route: "/browse/apartments" },
              { label: "Cars", emoji: "🚗", route: "/browse/cars" },
            ].map(cat => (
              <TouchableOpacity key={cat.label} style={s.catPill} onPress={() => router.push(cat.route as any)} activeOpacity={0.8}>
                <Text style={s.catPillEmoji}>{cat.emoji}</Text>
                <Text style={s.catPillLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Recently Viewed ── */}
        {recentlyViewed && recentlyViewed.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Recently Viewed" />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentlyViewed.slice(0, 8)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              renderItem={({ item }) => (
                <ListingCard item={item} width={210} photoUrl={photo(item)} onPress={() => navToListing(item.id)} promotion={promoFor(item)} />
              )}
            />
          </View>
        )}

        {/* ── Vouchers ── */}
        {vouchers && vouchers.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Your Vouchers" subtitle="Apply at checkout" onViewAll={() => router.push("/vouchers" as any)} />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={vouchers.slice(0, 6)}
              keyExtractor={(v) => v.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item: v }) => (
                <TouchableOpacity style={vc.card} onPress={() => router.push("/vouchers" as any)} activeOpacity={0.88}>
                  <View style={vc.topRow}>
                    <View style={vc.discBadge}>
                      <Text style={vc.discText}>
                        {v.discountPercent ? `${v.discountPercent}% OFF` : v.discountAmount ? `SAVE ${v.discountAmount}` : "DEAL"}
                      </Text>
                    </View>
                    <Ionicons name="pricetag" size={16} color={K.colors.accentLight} />
                  </View>
                  <Text style={vc.title} numberOfLines={2}>{v.title}</Text>
                  {v.description ? <Text style={vc.desc} numberOfLines={1}>{v.description}</Text> : null}
                  <View style={vc.codeWrap}>
                    <Text style={vc.code}>{v.code}</Text>
                  </View>
                  {v.expiresAt ? <Text style={vc.expiry}>Expires {fmtShortDate(v.expiresAt)}</Text> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Promoted Elite Stays ── */}
        {(popularHotels.length > 0 || hotelsLoading) && (
          <View style={s.section}>
            <SectionHead
              title="Promoted Elite Stays"
              subtitle={detectedCity ? `Top-rated stays near ${detectedCity}` : "Top-rated luxury accommodations"}
              onViewAll={() => router.push("/browse/hotels" as any)}
            />
            {hotelsLoading ? <EliteCardSkeleton /> : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={popularHotels.slice(0, 6)}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.carousel}
                ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                renderItem={({ item }) => (
                  <EliteCard
                    item={item}
                    badgeLabel="PROMOTED"
                    badgeColor={K.colors.darkGreen}
                    photoUrl={photo(item)}
                    onPress={() => navToListing(item.id)}
                    promotion={hotelPromo}
                  />
                )}
              />
            )}
          </View>
        )}

        {/* ── Home Deals ── */}
        {popularApts.length > 0 && (
          <View style={s.section}>
            <SectionHead
              title="Home Deals"
              subtitle={detectedCity ? `Deals near ${detectedCity}` : "Save big on your next stay"}
              onViewAll={() => router.push("/browse/apartments" as any)}
            />
            {aptPromotions?.[0] && (
              <PromoBanner
                promo={aptPromotions[0]}
                onPress={() => router.push((aptPromotions[0].ctaRoute ?? "/browse/apartments") as any)}
              />
            )}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={popularApts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              renderItem={({ item }) => {
                const pct = aptPromo?.discountType === "percentage"
                  ? `${aptPromo.discountValue}% OFF`
                  : aptPromo ? "SALE" : "SALE";
                return (
                  <ListingCard
                    item={item}
                    width={240}
                    badgeLabel={pct}
                    badgeColor="#dc2626"
                    photoUrl={photo(item)}
                    onPress={() => navToListing(item.id)}
                    promotion={aptPromo}
                  />
                );
              }}
            />
          </View>
        )}

        {/* ── Limited Car Offers ── */}
        {popularCars.length > 0 && (
          <View style={s.section}>
            <SectionHead
              title="Limited Car Offers"
              subtitle={detectedCity ? `Car deals near ${detectedCity}` : "Exclusive deals on wheels"}
              onViewAll={() => router.push("/browse/cars" as any)}
            />
            {carPromotions?.[0] && (
              <PromoBanner
                promo={carPromotions[0]}
                onPress={() => router.push((carPromotions[0].ctaRoute ?? "/browse/cars") as any)}
              />
            )}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={popularCars.slice(0, 5)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              renderItem={({ item }) => {
                const badge = carPromo?.discountType === "percentage"
                  ? `${carPromo.discountValue}% OFF`
                  : carPromo ? "DEAL" : "DEAL";
                return (
                  <ListingCard
                    item={item}
                    width={240}
                    badgeLabel={badge}
                    badgeColor="#dc2626"
                    photoUrl={photo(item)}
                    onPress={() => navToListing(item.id)}
                    promotion={carPromo}
                  />
                );
              }}
            />
          </View>
        )}

        {/* ── Popular Hotels ── */}
        {(popularHotels.length > 0 || hotelsLoading) && (
          <View style={s.section}>
            <SectionHead
              title="Popular Hotels"
              subtitle={detectedCity ? `Recommended hotels near ${detectedCity}` : "Top-rated stays near you"}
              onViewAll={() => router.push("/browse/hotels" as any)}
            />
            {hotelsLoading ? <EliteCardSkeleton /> : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={popularHotels}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.carousel}
                ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                renderItem={({ item }) => (
                  <EliteCard
                    item={item}
                    badgeLabel={item.starRating != null && item.starRating >= 4 ? "TOP RATED" : undefined}
                    badgeColor={K.colors.accent}
                    photoUrl={photo(item)}
                    onPress={() => navToListing(item.id)}
                    promotion={hotelPromo}
                  />
                )}
              />
            )}
          </View>
        )}

        {/* ── Best Homes ── */}
        {(popularApts.length > 0 || aptsLoading) && (
          <View style={s.section}>
            <SectionHead
              title="Best Homes"
              subtitle={detectedCity ? `Homes near ${detectedCity}` : "Comfortable long-term stays"}
              onViewAll={() => router.push("/browse/apartments" as any)}
            />
            {aptsLoading ? <EliteCardSkeleton /> : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={popularApts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.carousel}
                ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                renderItem={({ item }) => (
                  <EliteCard
                    item={item}
                    photoUrl={photo(item)}
                    onPress={() => navToListing(item.id)}
                    promotion={aptPromo}
                  />
                )}
              />
            )}
          </View>
        )}

        {/* ── Premium Fleet ── */}
        {popularCars.length > 0 && (
          <View style={s.section}>
            <SectionHead
              title="Premium Fleet"
              subtitle={detectedCity ? `Cars available near ${detectedCity}` : "Drive in style"}
              onViewAll={() => router.push("/browse/cars" as any)}
            />
            <View style={{ paddingHorizontal: K.spacing.screen, gap: 12 }}>
              {popularCars.slice(0, 5).map(item => (
                <CompactCarCard
                  key={item.id}
                  item={item}
                  photoUrl={photo(item)}
                  onPress={() => navToListing(item.id)}
                  promotion={carPromo}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Flash Sale Banner ── */}
        {promotions && promotions.length > 0 && (
          <View style={{ paddingHorizontal: K.spacing.screen, marginTop: K.spacing.section }}>
            <FlashSaleBanner
              promotion={promotions[0]}
              onPress={() => {
                const p = promotions[0];
                const route = p.ctaRoute ?? (
                  p.activity === "hotel" ? "/browse/hotels" :
                    p.activity === "apartment" ? "/browse/apartments" :
                      p.activity === "car" ? "/browse/cars" : "/search"
                );
                router.push(route as any);
              }}
            />
          </View>
        )}

        {/* ── Kainook Elite ── */}
        <View style={s.section}>
          <View style={{ paddingHorizontal: K.spacing.screen }}>
            {user ? (() => {
              const fg = tierPalette?.fg ?? K.colors.goldDark;
              const fgMuted = tierPalette?.fgMuted ?? "rgba(176,125,14,0.60)";
              const btnBg = tierPalette?.btnBg ?? K.colors.goldDark;
              const cardBg = tierPalette?.bg ?? K.colors.goldTint;
              const shimTop = tierPalette?.shimmerTop ?? "rgba(255,230,80,0.20)";
              const shimBot = tierPalette?.shimmerBot ?? "rgba(120,60,0,0.14)";
              const borderCol = tierPalette ? "transparent" : K.colors.gold;
              const { pct, isMaxTier } = computeTierProgress(loyaltyPoints, nextTierTarget);
              const pctWidth = Math.round(pct * 100);
              return (
                <TouchableOpacity
                  style={[ly.card, { backgroundColor: cardBg, borderColor: borderCol }]}
                  onPress={() => router.push("/loyalty" as any)}
                  activeOpacity={0.88}
                >
                  {/* ── Shimmer layers (fake gradient) ── */}
                  <View style={[ly.shimTop, { backgroundColor: shimTop }]} />
                  <View style={[ly.shimBot, { backgroundColor: shimBot }]} />

                  {/* ── Top row: brand + star ── */}
                  <View style={ly.topRow}>
                    <View>
                      <Text style={[ly.brandName, { color: fg }]}>Kainook Elite</Text>
                      <Text style={[ly.tierLabel, { color: fgMuted }]}>
                        {loyaltyTier ? loyaltyTier.toUpperCase() + " MEMBER" : "MEMBER"}
                      </Text>
                    </View>
                    <View style={[ly.starCircle, { borderColor: fg, backgroundColor: "rgba(0,0,0,0.08)" }]}>
                      <Ionicons name="star" size={24} color={fg} />
                    </View>
                  </View>

                  {/* ── Points ── */}
                  <Text style={[ly.ptsLabel, { color: fgMuted }]}>TOTAL POINTS</Text>
                  <View style={ly.ptsRow}>
                    <Text style={[ly.ptsNumber, { color: fg }]}>{loyaltyPoints.toLocaleString()}</Text>
                    <Text style={[ly.ptsSuffix, { color: fg }]}> pts</Text>
                  </View>

                  {/* ── Progress bar ── */}
                  {!isMaxTier && nextTierTarget != null && nextTierName ? (
                    <View style={ly.progressSection}>
                      <View style={[ly.progressBg, { backgroundColor: "rgba(0,0,0,0.15)" }]}>
                        <View style={[ly.progressFill, { width: `${pctWidth}%`, backgroundColor: btnBg }]} />
                      </View>
                      <Text style={[ly.progressLabel, { color: fgMuted }]}>
                        {nextTierTarget.toLocaleString()} pts to {nextTierName}
                      </Text>
                    </View>
                  ) : null}

                  {/* ── Bottom: View Benefits button ── */}
                  <View style={ly.bottomRow}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={[ly.benefitsBtn, { backgroundColor: btnBg }]}
                      onPress={() => router.push("/loyalty" as any)}
                    >
                      <Text style={[ly.benefitsBtnText, { color: cardBg }]}>View Offers</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })() : (
              <TouchableOpacity
                style={ly.joinCard}
                onPress={() => router.push((user ? "/loyalty" : "/auth/login") as any)}
                activeOpacity={0.88}
              >
                <View style={{ flex: 1 }}>
                  <Text style={ly.joinBrandName}>Kainook Elite</Text>
                  <Text style={ly.joinSub}>Earn points on every booking</Text>
                  <Text style={ly.joinDesc}>Unlock perks, upgrades, and exclusive discounts</Text>
                  <View style={ly.joinBtn}>
                    <Text style={ly.joinBtnText}>Join now →</Text>
                  </View>
                </View>
                <View style={[ly.starCircle, { borderColor: "rgba(255,255,255,0.35)", marginLeft: 16 }]}>
                  <Ionicons name="star" size={22} color="rgba(255,255,255,0.80)" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Upcoming Trips ── */}
        {recentBookings && recentBookings.length > 0 && (
          <View style={[s.section, { marginBottom: 0 }]}>
            <SectionHead title="Upcoming Bookings" onViewAll={() => router.push("/bookings" as any)} />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentBookings}
              keyExtractor={(b) => b.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              renderItem={({ item: b }) => (
                <TouchableOpacity
                  style={rb.card}
                  onPress={() => router.push(`/booking/${b.id}` as any)}
                  activeOpacity={0.88}
                >
                  <View style={rb.datesRow}>
                    <View style={rb.datePill}>
                      <Ionicons name="calendar" size={12} color={K.colors.accent} />
                      <Text style={rb.dateText}>{fmtShortDate(b.checkIn)}</Text>
                      <Text style={rb.sep}>→</Text>
                      <Text style={rb.dateText}>{fmtShortDate(b.checkOut)}</Text>
                    </View>
                  </View>
                  <Text style={rb.title} numberOfLines={2}>{b.listingTitle ?? "Booking"}</Text>
                  <View style={rb.footer}>
                    <View style={rb.statusPill}>
                      <View style={rb.statusDot} />
                      <Text style={rb.statusText}>{b.status}</Text>
                    </View>
                    <Text style={rb.amount}>{b.currency} {b.totalAmount.toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Main Styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: K.colors.darkGreen },
  scroll: { flex: 1, backgroundColor: K.colors.bgApp },
  scrollContent: { paddingBottom: 32 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: K.spacing.screen, paddingTop: 14, paddingBottom: 22,
    backgroundColor: K.colors.darkGreen,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: K.font.xl, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  subGreeting: { fontSize: K.font.sm, color: K.colors.textLightMuted, marginTop: 3 },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg, borderWidth: 1, borderColor: K.colors.glassBorder,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  notifBadge: {
    position: "absolute", top: 2, right: 2,
    minWidth: 15, height: 15, borderRadius: K.radius.full,
    backgroundColor: K.colors.error, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.3)",
  },
  notifBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  avatarBtn: { marginLeft: 4 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: K.radius.full,
    backgroundColor: K.colors.accentDim, borderWidth: 1.5, borderColor: K.colors.accentLight,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "800", color: K.colors.accentLight },

  searchCardWrap: { backgroundColor: K.colors.darkGreen, paddingHorizontal: K.spacing.screen, paddingBottom: 22 },
  searchCard: { backgroundColor: "#fff", borderRadius: K.radius.xl, overflow: "hidden", ...K.shadow.md },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  searchIconWrap: { width: 34, height: 34, borderRadius: K.radius.full, backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center", marginRight: 10 },
  locationInput: { flex: 1, fontSize: K.font.base, color: K.colors.textDark, fontWeight: "500" },
  filterBtn: { width: 36, height: 36, borderRadius: K.radius.full, backgroundColor: K.colors.bgSubtle, alignItems: "center", justifyContent: "center" },
  searchDivider: { height: 1, backgroundColor: K.colors.border },
  datesGuestsRow: { flexDirection: "row", alignItems: "stretch" },
  dateChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  guestChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  chipDivider: { width: 1, backgroundColor: K.colors.border, marginVertical: 10 },
  chipLabel: { fontSize: 10, fontWeight: "700", color: K.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  chipValue: { fontSize: 12, fontWeight: "600", color: K.colors.textDark },
  chipPlaceholder: { color: K.colors.textMuted, fontWeight: "400" },
  guestCounter: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  guestCount: { fontSize: 14, fontWeight: "700", color: K.colors.textDark, minWidth: 16, textAlign: "center" },
  searchBtn: {
    margin: 12, marginTop: 10, backgroundColor: K.colors.darkGreen, borderRadius: K.radius.button,
    paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", ...K.shadow.brand,
  },
  searchBtnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700", letterSpacing: 0.2 },

  section: { marginTop: K.spacing.section },
  carousel: { paddingHorizontal: K.spacing.screen, paddingBottom: 4 },

  catScroll: { paddingHorizontal: K.spacing.screen, paddingBottom: 4, gap: 12 },
  catPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: K.colors.bgCard, borderRadius: K.radius.full,
    paddingVertical: 10, paddingHorizontal: 18,
    borderWidth: 1, borderColor: K.colors.border, ...K.shadow.xs,
  },
  catPillEmoji: { fontSize: 18 },
  catPillLabel: { fontSize: 13, fontWeight: "700", color: K.colors.textDark },
});

// ── Voucher Styles ────────────────────────────────────────────────────────────

const vc = StyleSheet.create({
  card: {
    width: 190, backgroundColor: K.colors.darkGreen, borderRadius: K.radius.xl, padding: 16,
    justifyContent: "space-between", ...K.shadow.brand,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  discBadge: { backgroundColor: K.colors.accentDim, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  discText: { fontSize: 11, fontWeight: "800", color: K.colors.accentLight, letterSpacing: 0.5 },
  title: { fontSize: 14, fontWeight: "800", color: "#fff", lineHeight: 20, marginBottom: 6 },
  desc: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 10 },
  codeWrap: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: K.radius.sm, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderStyle: "dashed" },
  code: { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: 1.5 },
  expiry: { fontSize: 10, color: "rgba(255,255,255,0.55)" },
});

// ── Loyalty Styles ────────────────────────────────────────────────────────────

const ly = StyleSheet.create({
  // ── Member card (tier-colored) ──────────────────────────────────────────────
  card: {
    borderRadius: K.radius.xl, padding: 20,
    borderWidth: 1.5, ...K.shadow.md,
    overflow: "hidden",
  },
  // Fake gradient: lighter overlay at top, darker at bottom
  shimTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: "52%",
    borderTopLeftRadius: K.radius.xl, borderTopRightRadius: K.radius.xl,
  },
  shimBot: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
    borderBottomLeftRadius: K.radius.xl, borderBottomRightRadius: K.radius.xl,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 },
  brandName: { fontSize: K.font.xl, fontWeight: "800", letterSpacing: -0.3, marginBottom: 3 },
  tierLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.0, textTransform: "uppercase" },
  starCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  ptsLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  ptsRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 14 },
  ptsNumber: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  ptsSuffix: { fontSize: 16, fontWeight: "700" },
  progressSection: { marginBottom: 16 },
  progressBg: { height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 5 },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 11, fontWeight: "600" },
  bottomRow: { flexDirection: "row", alignItems: "center" },
  benefitsBtn: {
    borderRadius: K.radius.full, paddingHorizontal: 20, paddingVertical: 10,
  },
  benefitsBtnText: { fontSize: 13, fontWeight: "700" },

  // ── Join card (not logged in / no loyalty) ──────────────────────────────────
  joinCard: {
    backgroundColor: K.colors.darkGreen, borderRadius: K.radius.xl, padding: 20,
    flexDirection: "row", alignItems: "center", ...K.shadow.brand,
  },
  joinBrandName: { fontSize: K.font.xl, fontWeight: "800", color: "#fff", marginBottom: 4 },
  joinSub: { fontSize: 13, fontWeight: "700", color: K.colors.accentLight, marginBottom: 6 },
  joinDesc: { fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 17, marginBottom: 16 },
  joinBtn: {
    backgroundColor: "#fff", borderRadius: K.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, alignSelf: "flex-start",
  },
  joinBtnText: { fontSize: 13, fontWeight: "700", color: K.colors.darkGreen },
});

// ── Recent Booking Styles ─────────────────────────────────────────────────────

const rb = StyleSheet.create({
  card: {
    width: W * 0.72, backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl,
    padding: 16, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.sm,
  },
  datesRow: { marginBottom: 10 },
  datePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: K.colors.bgTint, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  dateText: { fontSize: 12, fontWeight: "700", color: K.colors.darkGreen },
  sep: { fontSize: 11, color: K.colors.textMuted },
  title: { fontSize: 14, fontWeight: "700", color: K.colors.textDark, lineHeight: 20, marginBottom: 12 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: K.colors.bgSubtle, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: K.colors.success },
  statusText: { fontSize: 11, fontWeight: "600", color: K.colors.textMuted, textTransform: "capitalize" },
  amount: { fontSize: 14, fontWeight: "800", color: K.colors.darkGreen },
});

// ── Become a Host Styles ──────────────────────────────────────────────────────

const host = StyleSheet.create({
  card: {
    backgroundColor: K.colors.darkGreen, borderRadius: K.radius.xxl, padding: 24,
    flexDirection: "row", alignItems: "center", ...K.shadow.brand,
  },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: K.colors.accentLight, textTransform: "uppercase", marginBottom: 8 },
  title: { fontSize: K.font.xxl, fontWeight: "800", color: "#fff", lineHeight: 30, marginBottom: 8 },
  sub: { fontSize: 13, color: K.colors.textLightMuted, lineHeight: 19, marginBottom: 18 },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: K.radius.full, paddingHorizontal: 18, paddingVertical: 10, alignSelf: "flex-start" },
  btnText: { fontSize: 13, fontWeight: "700", color: K.colors.darkGreen },
  emojiCol: { width: 80, alignItems: "center", justifyContent: "center" },
});
