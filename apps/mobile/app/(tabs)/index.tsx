import { useState, useEffect, useRef, useMemo, memo } from "react";
import {
  View, Text, ScrollView, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, Modal, Animated,
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
  id: string; listingType: string; title: string; city: string; countryCode: string;
  distanceKm: number; primaryPhotoUrl: string | null; nightlyRate: number | null;
  dailyRate: number | null; currency: string; starRating: number | null;
  isAccredited: boolean; longStayDiscountEnabled?: boolean;
  carMake: string | null; carModel: string | null; carYear: number | null;
  transmission: string | null; seats: number | null;
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
interface LoyaltyProfile {
  tier?: string;
  points?: number;
  pointsBalance?: number;
  totalPoints?: number;
  nextTierPoints?: number;
  nextTier?: string;
}
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
    if (minDate) { const m = new Date(minDate); m.setHours(0, 0, 0, 0); if (d <= m) return true; }
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

// ── Listing Card ──────────────────────────────────────────────────────────────

const ListingCard = memo(function ListingCard({ item, onPress, width = 240, badgeLabel, badgeColor, photoUrl }: {
  item: SearchResult; onPress: () => void; width?: number;
  badgeLabel?: string; badgeColor?: string; photoUrl?: string | null;
}) {
  const isCar = item.listingType === "car";
  const isApt = item.listingType === "apartment";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  const unit = isCar ? "day" : "night";
  const [imgErr, setImgErr] = useState(false);
  const displayPhoto = photoUrl ?? null;
  const fallbackEmoji = isCar ? "🚗" : isApt ? "🏠" : "🏨";
  const cardTitle = isCar && item.carMake
    ? `${item.carMake} ${item.carModel ?? ""} ${item.carYear ?? ""}`.trim()
    : item.title;
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
        <View style={lc.priceRow}>
          <Text style={lc.price}>{fmtPrice(rate, item.currency)}</Text>
          {rate ? <Text style={lc.priceUnit}>/{unit}</Text> : null}
        </View>
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
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  price: { fontSize: 15, fontWeight: "800", color: K.colors.darkGreen },
  priceUnit: { fontSize: 11, color: K.colors.textMuted },
});

// ── Destination Card ──────────────────────────────────────────────────────────

const DestinationCard = memo(function DestinationCard({ city, count, photoUri, onPress }: {
  city: string; count: number; photoUri: string | null; onPress: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <TouchableOpacity style={dest.card} onPress={onPress} activeOpacity={0.88}>
      {!imgErr && photoUri
        ? <ListingImage uri={photoUri} style={dest.photo} onError={() => setImgErr(true)} />
        : <View style={[dest.photo, dest.photoFallback]}><Text style={{ fontSize: 30 }}>🏙️</Text></View>
      }
      <View style={dest.overlay}>
        <Text style={dest.city} numberOfLines={1}>{city}</Text>
        <Text style={dest.count}>{count} hotel{count !== 1 ? "s" : ""}</Text>
      </View>
    </TouchableOpacity>
  );
});
const dest = StyleSheet.create({
  card: { width: 160, borderRadius: K.radius.xl, overflow: "hidden", marginRight: 12, ...K.shadow.sm },
  photo: { width: "100%", height: 130 },
  photoFallback: { backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(2,25,13,0.55)", padding: 10 },
  city: { color: "#fff", fontWeight: "800", fontSize: 13, marginBottom: 2 },
  count: { color: "rgba(255,255,255,0.80)", fontSize: 11 },
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: K.spacing.screen,
    marginBottom: 10,
    gap: 10,
    ...K.shadow.xs,
  },
  fire: { fontSize: 18 },
  text: { fontSize: 13, fontWeight: "700", color: "#92400e" },
  sub: { fontSize: 11, color: "#b45309", marginTop: 2 },
  discBadge: { backgroundColor: "#dc2626", borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  discText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

// ── Trending Deal Card ────────────────────────────────────────────────────────

const TrendingDealCard = memo(function TrendingDealCard({ promo, onPress }: {
  promo: Promotion; onPress: () => void;
}) {
  const discountText = promo.discountPercent
    ? `${promo.discountPercent}% OFF`
    : promo.discountAmount
      ? `-${promo.discountAmount}`
      : "DEAL";
  const activityEmoji = promo.activity === "hotel" ? "🏨" : promo.activity === "apartment" ? "🏠" : promo.activity === "car" ? "🚗" : "🌍";
  const activityLabel = promo.activity
    ? `${activityEmoji} ${promo.activity.charAt(0).toUpperCase()}${promo.activity.slice(1)}s`
    : "🌍 All";
  return (
    <TouchableOpacity style={td.card} onPress={onPress} activeOpacity={0.88}>
      <Text style={td.activity}>{activityLabel}</Text>
      <Text style={td.title} numberOfLines={2}>{promo.title}</Text>
      <View style={td.discWrap}>
        <Text style={td.disc}>{discountText}</Text>
      </View>
      {promo.expiresAt ? (
        <Text style={td.expiry}>Until {fmtPromoExpiry(promo.expiresAt)}</Text>
      ) : null}
      <View style={td.cta}>
        <Text style={td.ctaText}>Explore</Text>
        <Ionicons name="arrow-forward" size={11} color={K.colors.accentLight} />
      </View>
    </TouchableOpacity>
  );
});
const td = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    padding: 16,
    minHeight: 165,
    justifyContent: "space-between",
    ...K.shadow.brand,
  },
  activity: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.68)", letterSpacing: 0.3 },
  title: { fontSize: 14, fontWeight: "800", color: "#fff", lineHeight: 20, marginTop: 8, marginBottom: 10, flex: 1 },
  discWrap: { backgroundColor: K.colors.accent, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 6 },
  disc: { color: "#fff", fontSize: 12, fontWeight: "900" },
  expiry: { fontSize: 10, color: "rgba(255,255,255,0.60)", marginBottom: 8 },
  cta: { flexDirection: "row", alignItems: "center", gap: 4 },
  ctaText: { fontSize: 12, fontWeight: "700", color: K.colors.accentLight },
});

// ── Promo Skeleton ────────────────────────────────────────────────────────────

function PromoSkeletonRow() {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: K.spacing.screen, gap: 14 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ width: 180, height: 165, borderRadius: K.radius.xl, backgroundColor: K.colors.bgSubtle }} />
      ))}
    </View>
  );
}

// ── Promo Slider ──────────────────────────────────────────────────────────────

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
  const timerRef = useRef<number | null>(null);

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
          return (
            <TouchableOpacity
              key={idx}
              style={[ps.slide, { width: SLIDE_W, backgroundColor: pal.bg }]}
              onPress={() => onPress(p)}
              activeOpacity={0.88}
            >
              <View style={{ flex: 1 }}>
                <Text style={[ps.eyebrow, { color: pal.eyebrow }]}>SPECIAL OFFER</Text>
                <Text style={ps.promoTitle} numberOfLines={2}>{p.title}</Text>
                <Text style={[ps.promoDesc, { color: pal.sub }]} numberOfLines={2}>{p.description}</Text>
                <Text style={[ps.ctaText, { color: pal.eyebrow }]}>Explore now →</Text>
              </View>
              <View style={ps.iconCol}>
                <Text style={{ fontSize: 36 }}>🎁</Text>
                {p.discountPercent ? (
                  <View style={[ps.pctBadge, { borderColor: pal.eyebrow }]}>
                    <Text style={[ps.pctText, { color: pal.eyebrow }]}>{p.discountPercent}% OFF</Text>
                  </View>
                ) : null}
              </View>
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
  slide: { flexDirection: "row", alignItems: "center", padding: 24, minHeight: 130 },
  eyebrow: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 },
  promoTitle: { fontSize: K.font.lg, fontWeight: "800", color: "#fff", lineHeight: 24, marginBottom: 6 },
  promoDesc: { fontSize: 12, lineHeight: 18, marginBottom: 14 },
  ctaText: { fontSize: 13, fontWeight: "700" },
  iconCol: { width: 80, alignItems: "center", justifyContent: "center", gap: 8 },
  pctBadge: { borderRadius: K.radius.full, borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  pctText: { fontSize: 10, fontWeight: "800" },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: K.colors.border },
  dotActive: { width: 18, backgroundColor: K.colors.accent },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? "Traveller";

  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [datePicker, setDatePicker] = useState<"checkIn" | "checkOut" | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: hotelsData, isLoading: hotelsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-hotels"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=hotel&lat=0&lng=0&radius_km=20000&sort=recommended&limit=20");
      return res.data.data.results ?? [];
    },
    staleTime: 120_000,
  });

  const { data: apartmentsData, isLoading: aptsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-apartments"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=apartment&lat=0&lng=0&radius_km=20000&sort=recommended&limit=10");
      return res.data.data.results ?? [];
    },
    staleTime: 120_000,
  });

  const { data: carsData } = useQuery<SearchResult[]>({
    queryKey: ["home-cars"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>("/search?category=car&lat=0&lng=0&radius_km=20000&sort=recommended&limit=10");
      return res.data.data.results ?? [];
    },
    staleTime: 120_000,
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

  const { data: recentlyViewed } = useQuery<SearchResult[]>({
    queryKey: ["recently-viewed"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { listings: SearchResult[] } }>("/guests/me/recently-viewed");
        return res.data.data.listings ?? [];
      } catch { return []; }
    },
    staleTime: 30_000,
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

  const { data: loyalty } = useQuery<LoyaltyProfile | null>({
    queryKey: ["loyalty-profile-home"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: LoyaltyProfile }>("/guests/me/loyalty");
        return res.data.data ?? null;
      } catch { return null; }
    },
    staleTime: 5 * 60_000,
    enabled: !!user,
    retry: false,
  });

  const { data: recentBookings } = useQuery<RecentBooking[]>({
    queryKey: ["bookings-home"],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: { bookings: RecentBooking[] } }>("/guests/me/bookings?limit=10");
        const now = new Date();
        return (res.data.data.bookings ?? [])
          .filter(b => new Date(b.checkOut) >= now)
          .slice(0, 5);
      } catch { return []; }
    },
    staleTime: 60_000,
    enabled: !!user,
    retry: false,
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const popularHotels = useMemo(() => (hotelsData ?? []).slice(0, 8), [hotelsData]);
  const popularApts = useMemo(() => (apartmentsData ?? []).slice(0, 8), [apartmentsData]);
  const popularCars = useMemo(() => (carsData ?? []).slice(0, 8), [carsData]);
  const bestOffers = useMemo(() => {
    const withDiscount = [...(hotelsData ?? []), ...(apartmentsData ?? [])].filter(x => x.longStayDiscountEnabled);
    const rest = (hotelsData ?? []).filter(x => !x.longStayDiscountEnabled);
    return [...withDiscount, ...rest].slice(0, 8);
  }, [hotelsData, apartmentsData]);

  const featuredDests = useMemo(() => {
    const cityMap = new Map<string, { item: SearchResult; count: number }>();
    for (const h of (hotelsData ?? [])) {
      const e = cityMap.get(h.city);
      if (e) e.count++;
      else cityMap.set(h.city, { item: h, count: 1 });
    }
    return Array.from(cityMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([city, { item, count }]) => ({ city, item, count }));
  }, [hotelsData]);

  // Collect all unique listing IDs across all home sections.
  // Exclude items whose search-result primaryPhotoUrl is NOT an unsigned S3 URL —
  // but since we can't tell at this point, always fetch via /listings/:id/public
  // which returns signed photo URLs safe for the traveller app.
  const allListingIds = useMemo(() => {
    const seen = new Set<string>();
    for (const arr of [bestOffers, popularHotels, popularApts, popularCars, recentlyViewed ?? [], featuredDests.map(d => d.item)]) {
      for (const item of arr) seen.add(item.id);
    }
    return Array.from(seen);
  }, [bestOffers, popularHotels, popularApts, popularCars, recentlyViewed, featuredDests]);

  // GET /listings/:id/public — returns signed photo URLs for the traveller app.
  // Do NOT use primaryPhotoUrl from search results; those are unsigned S3 URLs → 403.
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
    if (location.trim()) p.placeName = location.trim();
    if (checkIn) p.checkIn = formatLocalDate(checkIn);
    if (checkOut) p.checkOut = formatLocalDate(checkOut);
    router.push({ pathname: "/search", params: p });
  }

  const isLoading = hotelsLoading || aptsLoading;
  const hotelCount = (hotelsData ?? []).length;
  const aptCount = (apartmentsData ?? []).length;
  const carCount = (carsData ?? []).length;

  // Loyalty — normalise field names (API may use pointsBalance or totalPoints instead of points)
  const loyaltyPoints = loyalty?.points ?? loyalty?.pointsBalance ?? loyalty?.totalPoints ?? 0;
  const loyaltyTier = loyalty?.tier ?? "";
  const TIER_COLORS: Record<string, string> = { bronze: "#cd7f32", silver: "#9ca3af", gold: K.colors.gold, platinum: "#e5e4e2" };
  const tierColor = TIER_COLORS[loyaltyTier.toLowerCase()] ?? K.colors.accent;

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
            <Text style={s.greeting}>Hi, {firstName} 👋</Text>
            <Text style={s.subGreeting}>Where would you like to go?</Text>
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
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={s.filterBtn} onPress={() => router.push("/search" as any)}>
                <Ionicons name="options-outline" size={18} color={K.colors.darkGreen} />
              </TouchableOpacity>
            </View>
            <View style={s.searchDivider} />
            <View style={s.datesGuestsRow}>
              <TouchableOpacity style={s.dateChip} onPress={() => setDatePicker("checkIn")} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={14} color={K.colors.accent} />
                <View>
                  <Text style={s.chipLabel}>Check-in</Text>
                  <Text style={[s.chipValue, !checkIn && s.chipPlaceholder]}>{checkIn ? fmtDate(checkIn) : "Add date"}</Text>
                </View>
              </TouchableOpacity>
              <View style={s.chipDivider} />
              <TouchableOpacity style={s.dateChip} onPress={() => setDatePicker("checkOut")} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={14} color={K.colors.accent} />
                <View>
                  <Text style={s.chipLabel}>Check-out</Text>
                  <Text style={[s.chipValue, !checkOut && s.chipPlaceholder]}>{checkOut ? fmtDate(checkOut) : "Add date"}</Text>
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

        {/* ── Popular Search Chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsScroll}>
          {["Nairobi", "Cape Town", "Lagos", "Accra", "Dar es Salaam", "Kampala", "Kigali"].map(city => (
            <TouchableOpacity
              key={city}
              style={s.searchChip}
              onPress={() => router.push({ pathname: "/search", params: { placeName: city } } as any)}
              activeOpacity={0.75}
            >
              <Ionicons name="search-outline" size={12} color={K.colors.textMuted} />
              <Text style={s.searchChipText}>{city}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Categories ── */}
        <View style={s.section}>
          <SectionHead title="Browse by category" onViewAll={() => router.push("/search" as any)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
            {[
              { label: "Hotels", emoji: "🏨", count: hotelCount, route: "/browse/hotels" },
              { label: "Apartments", emoji: "🏠", count: aptCount, route: "/browse/apartments" },
              { label: "Car Rentals", emoji: "🚗", count: carCount, route: "/browse/cars" },
            ].map(cat => (
              <TouchableOpacity key={cat.label} style={s.catCard} onPress={() => router.push(cat.route as any)} activeOpacity={0.8}>
                <View style={s.catIconWrap}>
                  <Text style={{ fontSize: 26 }}>{cat.emoji}</Text>
                </View>
                <Text style={s.catLabel}>{cat.label}</Text>
                {cat.count > 0 ? <Text style={s.catCount}>{cat.count}+</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Promotions Slider ── */}
        {promotions && promotions.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Special offers" subtitle="Limited time deals" />
            <PromoSlider promos={promotions} onPress={p => router.push((p.ctaRoute ?? "/search") as any)} />
          </View>
        )}

        {/* ── Trending Deals ── */}
        {promotions !== undefined && (
          promotions.length > 0 ? (
            <View style={s.section}>
              <SectionHead title="🔥 Trending Deals" subtitle="Hot promotions, grab them fast" />
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={promotions}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={s.carousel}
                ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                renderItem={({ item: p }) => {
                  const route = p.ctaRoute ?? (
                    p.activity === "hotel" ? "/browse/hotels" :
                      p.activity === "apartment" ? "/browse/apartments" :
                        p.activity === "car" ? "/browse/cars" : "/search"
                  );
                  return <TrendingDealCard promo={p} onPress={() => router.push(route as any)} />;
                }}
              />
            </View>
          ) : null
        )}

        {/* ── Vouchers ── */}
        {vouchers && vouchers.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Your vouchers" subtitle="Apply at checkout" onViewAll={() => router.push("/vouchers" as any)} />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={vouchers.slice(0, 6)}
              keyExtractor={(v) => v.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item: v }) => (
                <TouchableOpacity
                  style={vc.card}
                  onPress={() => router.push("/vouchers" as any)}
                  activeOpacity={0.88}
                >
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

        {/* ── Best Offers ── */}
        <View style={s.section}>
          <SectionHead title="Best offers" subtitle="Top picks just for you" onViewAll={() => router.push("/browse/hotels" as any)} />
          {isLoading ? <CarouselSkeleton /> : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={bestOffers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              renderItem={({ item }) => (
                <ListingCard
                  item={item}
                  width={240}
                  badgeLabel={item.longStayDiscountEnabled ? "LONG STAY" : "DEAL"}
                  badgeColor={item.longStayDiscountEnabled ? "#7c3aed" : "#dc2626"}
                  photoUrl={photo(item)}
                  onPress={() => navToListing(item.id)}
                />
              )}
            />
          )}
        </View>

        {/* ── Featured Destinations ── */}
        {featuredDests.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Popular destinations" subtitle="Trending places to explore" onViewAll={() => router.push("/search" as any)} />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={featuredDests}
              keyExtractor={(d) => d.city}
              contentContainerStyle={s.carousel}
              renderItem={({ item: { city, item, count } }) => (
                <DestinationCard
                  city={city}
                  count={count}
                  photoUri={photo(item)}
                  onPress={() => router.push({ pathname: "/search", params: { placeName: city } } as any)}
                />
              )}
            />
          </View>
        )}

        {/* ── Recently Viewed ── */}
        {recentlyViewed && recentlyViewed.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Recently viewed" />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentlyViewed.slice(0, 8)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              renderItem={({ item }) => (
                <ListingCard item={item} width={210} photoUrl={photo(item)} onPress={() => navToListing(item.id)} />
              )}
            />
          </View>
        )}

        {/* ── Popular Hotels ── */}
        {(popularHotels.length > 0 || hotelsLoading) && (
          <View style={s.section}>
            <SectionHead title="Popular hotels" subtitle="Top-rated stays" onViewAll={() => router.push("/browse/hotels" as any)} />
            {hotelPromotions?.[0] && (
              <PromoBanner
                promo={hotelPromotions[0]}
                onPress={() => router.push((hotelPromotions[0].ctaRoute ?? "/browse/hotels") as any)}
              />
            )}
            {hotelsLoading ? <CarouselSkeleton /> : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={popularHotels}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.carousel}
                ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
                renderItem={({ item }) => (
                  <ListingCard
                    item={item} width={240} photoUrl={photo(item)} onPress={() => navToListing(item.id)}
                    badgeLabel={item.starRating != null && item.starRating >= 4 ? "TOP RATED" : undefined}
                    badgeColor={K.colors.darkGreen}
                  />
                )}
              />
            )}
          </View>
        )}

        {/* ── Popular Apartments ── */}
        {popularApts.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Apartments" subtitle="Comfortable long-term stays" onViewAll={() => router.push("/browse/apartments" as any)} />
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
              renderItem={({ item }) => (
                <ListingCard item={item} width={240} photoUrl={photo(item)} onPress={() => navToListing(item.id)} />
              )}
            />
          </View>
        )}

        {/* ── Popular Car Rentals ── */}
        {popularCars.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Car rentals" subtitle="Drive in style" onViewAll={() => router.push("/browse/cars" as any)} />
            {carPromotions?.[0] && (
              <PromoBanner
                promo={carPromotions[0]}
                onPress={() => router.push((carPromotions[0].ctaRoute ?? "/browse/cars") as any)}
              />
            )}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={popularCars}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
              renderItem={({ item }) => (
                <ListingCard item={item} width={240} photoUrl={photo(item)} onPress={() => navToListing(item.id)} />
              )}
            />
          </View>
        )}

        {/* ── Loyalty Section ── */}
        <View style={s.section}>
          <View style={{ paddingHorizontal: K.spacing.screen }}>
            {user && loyalty ? (
              <TouchableOpacity style={ly.card} onPress={() => router.push("/loyalty" as any)} activeOpacity={0.88}>
                <View style={{ flex: 1 }}>
                  <Text style={ly.eyebrow}>KAINOOK REWARDS</Text>
                  <Text style={[ly.tier, { color: tierColor }]}>{loyaltyTier || "Member"}</Text>
                  <Text style={ly.points}>{loyaltyPoints.toLocaleString()} pts</Text>
                  {loyalty.nextTierPoints && loyalty.nextTier ? (
                    <>
                      <View style={ly.progressBg}>
                        <View
                          style={[ly.progressFill, {
                            width: `${Math.min(100, Math.round((loyaltyPoints / loyalty.nextTierPoints) * 100))}%`,
                            backgroundColor: tierColor,
                          }]}
                        />
                      </View>
                      <Text style={ly.progressLabel}>{(loyalty.nextTierPoints - loyaltyPoints).toLocaleString()} pts to {loyalty.nextTier}</Text>
                    </>
                  ) : null}
                </View>
                <View style={ly.iconWrap}>
                  <Text style={{ fontSize: 42 }}>🏆</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={ly.joinCard}
                onPress={() => router.push((user ? "/loyalty" : "/auth/login") as any)}
                activeOpacity={0.88}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[ly.eyebrow, { color: K.colors.accentLight }]}>KAINOOK REWARDS</Text>
                  <Text style={[ly.tier, { color: "#fff" }]}>Earn points on every stay</Text>
                  <Text style={[ly.points, { color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 14 }]}>
                    Unlock perks, upgrades, and exclusive discounts
                  </Text>
                  <View style={ly.joinBtn}>
                    <Text style={ly.joinBtnText}>Join now →</Text>
                  </View>
                </View>
                <View style={ly.iconWrap}>
                  <Text style={{ fontSize: 42 }}>⭐</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Upcoming Trips ── */}
        {recentBookings && recentBookings.length > 0 && (
          <View style={s.section}>
            <SectionHead title="Upcoming trips" onViewAll={() => router.push("/bookings" as any)} />
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
  scrollContent: { paddingBottom: 20 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: K.spacing.screen, paddingTop: 14, paddingBottom: 22,
    backgroundColor: K.colors.darkGreen,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: K.font.xl, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  subGreeting: { fontSize: K.font.sm, color: K.colors.textLightMuted, marginTop: 3 },
  notifBtn: {
    width: 42, height: 42, borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg, borderWidth: 1, borderColor: K.colors.glassBorder,
    alignItems: "center", justifyContent: "center",
  },

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

  chipsScroll: { paddingHorizontal: K.spacing.screen, paddingVertical: 14, gap: 8 },
  searchChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: K.colors.bgCard, borderRadius: K.radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: K.colors.border },
  searchChipText: { fontSize: 12, fontWeight: "600", color: K.colors.textMid },

  section: { marginTop: K.spacing.section },
  carousel: { paddingHorizontal: K.spacing.screen, paddingBottom: 4 },

  catScroll: { paddingHorizontal: K.spacing.screen, paddingBottom: 4, gap: 12 },
  catCard: {
    alignItems: "center", backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl,
    paddingVertical: 18, paddingHorizontal: 18, borderWidth: 1, borderColor: K.colors.border,
    minWidth: 104, ...K.shadow.xs,
  },
  catIconWrap: { width: 52, height: 52, borderRadius: K.radius.full, backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  catLabel: { fontSize: 12, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  catCount: { fontSize: 11, color: K.colors.textMuted },
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
  card: {
    backgroundColor: K.colors.goldTint, borderRadius: K.radius.xl, padding: 22,
    flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: K.colors.gold, ...K.shadow.sm,
  },
  joinCard: {
    backgroundColor: K.colors.darkGreen, borderRadius: K.radius.xl, padding: 22,
    flexDirection: "row", alignItems: "center", ...K.shadow.brand,
  },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: K.colors.goldDark, textTransform: "uppercase", marginBottom: 6 },
  tier: { fontSize: K.font.xl, fontWeight: "800", marginBottom: 4 },
  points: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.gold, marginBottom: 12 },
  progressBg: { height: 6, backgroundColor: K.colors.border, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 11, color: K.colors.textMuted },
  iconWrap: { width: 70, alignItems: "center", justifyContent: "center" },
  joinBtn: { backgroundColor: "#fff", borderRadius: K.radius.full, paddingHorizontal: 18, paddingVertical: 9, alignSelf: "flex-start" },
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
