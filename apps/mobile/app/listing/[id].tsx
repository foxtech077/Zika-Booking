import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

// Safely load MapView and Marker to prevent crashes in environments without the native module
let MapView: any = null;
let Marker: any = null;
try {
  const Maps = require("react-native-maps");
  MapView = Maps.default || Maps;
  Marker = Maps.Marker;
} catch (e) {
  // console.warn("react-native-maps native module not available:", e);
}

import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_HEIGHT = 260;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Amenity {
  amenityKey: string;
  category: string;
}

interface CustomAmenity {
  label: string;
}

interface Photo {
  id: string;
  cdnUrl: string;
  position: number;
}

interface PublicListing {
  id: string;
  name: string | null;
  category: "hotel" | "apartment" | "car";
  status: string;
  description: string | null;
  address: string | null;
  town: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  pricePerNight: number | null;
  pricePerDay: number | null;
  currency: string | null;
  cancellationPolicy: string | null;
  minStayNights: number | null;
  checkinTime: string | null;
  checkoutTime: string | null;
  smokingAllowed: boolean | null;
  petsAllowed: boolean | null;
  // hotel
  starRating: number | null;
  roomType: string | null;
  unitCount: number | null;
  // apartment
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  longStayEnabled: boolean | null;
  longStayMinNights: number | null;
  longStayDiscountType: string | null;
  longStayDiscountValue: number | null;
  // car
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  bodyType: string | null;
  transmission: string | null;
  fuelType: string | null;
  seats: number | null;
  mileagePolicy: string | null;
  mileageLimitKm: number | null;
  minDriverAge: number | null;
  deliveryAvailable: boolean | null;
  deliveryFee: number | null;
  deliveryRadiusKm: number | null;
  amenities: Amenity[];
  customAmenities: CustomAmenity[];
  photos: Photo[];
  isFavourited: boolean | undefined;
}

// ── Review types ──────────────────────────────────────────────────────────────

interface Review {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  createdAt: string;
  providerReply?: string | null;
}

interface ReviewsData {
  reviews: Review[];
  total: number;
  averageRating: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi",
  smart_tv: "Smart TV",
  work_desk: "Work desk",
  kitchen: "Kitchen",
  breakfast: "Breakfast",
  restaurant: "Restaurant",
  minibar: "Minibar",
  pool: "Swimming pool",
  gym: "Fitness centre",
  spa: "Spa",
  air_conditioning: "Air conditioning",
  parking: "Parking",
  elevator: "Elevator",
  accessible: "Accessible",
  reception_24h: "24h reception",
  housekeeping: "Housekeeping",
  airport_shuttle: "Airport shuttle",
  security_24h: "24h security",
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

function formatDateWithTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const timePart = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `${datePart} ${timePart}`;
  } catch {
    return dateStr;
  }
}

function nightsBetween(checkIn: string, checkOut: string): number {
  try {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 1;
  }
}

function daysBetween(pickup: string, returnD: string): number {
  try {
    const diff = new Date(returnD).getTime() - new Date(pickup).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 1;
  }
}

function cancellationText(policy: string | null): string {
  switch (policy) {
    case "free":
    case "flexible":
      return "Free cancellation if cancelled 48+ hours before check-in.";
    case "moderate":
      return "Full refund if cancelled 7+ days before. 50% refund 48h–7 days. No refund within 48h.";
    case "strict":
      return "50% refund if cancelled 14+ days before. No refund within 14 days.";
    case "non_refundable":
      return "Non-refundable — no refunds on cancellation.";
    default:
      return policy ?? "Contact host for cancellation details.";
  }
}

function cancellationBadgeColor(policy: string | null): string {
  switch (policy) {
    case "free":
    case "flexible":
      return "#16a34a";
    case "moderate":
      return "#d97706";
    case "strict":
      return "#dc2626";
    case "non_refundable":
      return "#7c3aed";
    default:
      return "#6b7280";
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ height, style }: { height: number; style?: object }) {
  return <View style={[{ height, backgroundColor: "#e5e7eb", borderRadius: 8, marginBottom: 12 }, style]} />;
}

function LoadingSkeleton() {
  return (
    <SafeAreaView style={styles.container}>
      <SkeletonBlock height={PHOTO_HEIGHT} style={{ borderRadius: 0, marginBottom: 0 }} />
      <View style={styles.content}>
        <SkeletonBlock height={28} style={{ width: "70%", marginTop: 16 }} />
        <SkeletonBlock height={18} style={{ width: "50%" }} />
        <SkeletonBlock height={36} style={{ width: "40%" }} />
        <SkeletonBlock height={1} />
        <SkeletonBlock height={16} />
        <SkeletonBlock height={16} style={{ width: "85%" }} />
        <SkeletonBlock height={16} style={{ width: "60%" }} />
        <SkeletonBlock height={1} />
        <SkeletonBlock height={80} />
        <SkeletonBlock height={200} />
      </View>
    </SafeAreaView>
  );
}

// ── Reviews Section ───────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ fontSize: 13, color: s <= rating ? "#fbbf24" : "#d1d5db" }}>
          {s <= rating ? "★" : "☆"}
        </Text>
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = (() => {
    try {
      return new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  })();

  return (
    <View style={reviewStyles.card}>
      <StarRow rating={review.rating} />
      {review.title ? (
        <Text style={reviewStyles.reviewTitle}>{review.title}</Text>
      ) : null}
      {review.body ? (
        <Text style={reviewStyles.reviewBody} numberOfLines={3}>{review.body}</Text>
      ) : null}
      <View style={reviewStyles.reviewMeta}>
        <Text style={reviewStyles.reviewerName}>Guest</Text>
        <Text style={reviewStyles.reviewDate}>{date}</Text>
      </View>
    </View>
  );
}

function InlineCalendar({ unavailableRanges, currency }: { unavailableRanges: { start: string; end: string }[], currency: string }) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Days of week
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const monthName = today.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 35) cells.push(null); // pad

  const isDateUnavailable = (day: number) => {
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dDate = new Date(dStr);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dDate < yesterday) return true;

    return unavailableRanges.some((range) => {
      if (!range.start || !range.end) return false;
      const start = new Date(range.start);
      const end = new Date(range.end);
      return dDate >= start && dDate <= end;
    });
  };

  return (
    <View style={calStyles.container}>
      <Text style={calStyles.monthName}>{monthName}</Text>
      <View style={calStyles.dowRow}>
        {daysOfWeek.map((d) => (
          <Text key={d} style={calStyles.dowLabel}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null) return <View key={`empty-${idx}`} style={calStyles.cellEmpty} />;
          const blocked = isDateUnavailable(day);
          return (
            <View
              key={`day-${day}`}
              style={[
                calStyles.cell,
                blocked && calStyles.cellBlocked,
              ]}
            >
              <Text style={[calStyles.cellText, blocked && calStyles.cellTextBlocked]}>
                {day}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.dot, { backgroundColor: "#fff", borderColor: "#eff6ff", borderWidth: 1 }]} />
          <Text style={calStyles.legendText}>Available</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.dot, { backgroundColor: "#fef2f2", borderColor: "#dc2626", borderWidth: 1 }]} />
          <Text style={calStyles.legendText}>Booked / Blocked</Text>
        </View>
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 10,
  },
  monthName: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12, textAlign: "center" },
  dowRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  dowLabel: { width: "13%", textAlign: "center", fontSize: 12, fontWeight: "600", color: "#6b7280" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cell: {
    width: "13%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  cellEmpty: { width: "13%", height: 36 },
  cellBlocked: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  cellText: { fontSize: 13, fontWeight: "500", color: "#111827" },
  cellTextBlocked: { color: "#dc2626", textDecorationLine: "line-through" },
  legend: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: "#4b5563", fontWeight: "500" },
});

function ReviewsSection({ listingId }: { listingId: string }) {
  const { data, isLoading } = useQuery<ReviewsData>({
    queryKey: ["listing-reviews", listingId],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ReviewsData }>(
        `/listings/${listingId}/reviews?page=1&limit=5`
      );
      return res.data.data;
    },
    enabled: !!listingId,
  });

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const avg = data?.averageRating;

  const headerLabel = avg != null && total > 0
    ? `★ ${avg.toFixed(1)} · ${total} ${total === 1 ? "review" : "reviews"}`
    : total > 0
    ? `${total} ${total === 1 ? "review" : "reviews"}`
    : "";

  return (
    <View style={reviewStyles.sectionWrapper}>
      <View style={reviewStyles.sectionHeader}>
        <Text style={styles.sectionLabel}>Guest Reviews</Text>
        {headerLabel ? (
          <Text style={reviewStyles.avgLabel}>{headerLabel}</Text>
        ) : null}
      </View>

      {isLoading ? (
        <View style={reviewStyles.loadingBox}>
          <ActivityIndicator size="small" color="#1B5E20" />
        </View>
      ) : reviews.length === 0 ? (
        <Text style={reviewStyles.emptyText}>No reviews yet.</Text>
      ) : (
        <>
          {/* Sentiment / Ratings Breakdown Stats */}
          <View style={reviewStyles.breakdownContainer}>
            <View style={reviewStyles.scoreCol}>
              <Text style={reviewStyles.scoreBig}>{avg != null ? avg.toFixed(1) : "5.0"}</Text>
              <View style={reviewStyles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Text key={i} style={{ fontSize: 14, color: i < Math.round(avg ?? 5) ? "#fbbf24" : "#d1d5db" }}>★</Text>
                ))}
              </View>
              <Text style={reviewStyles.scoreCount}>{total} reviews</Text>
            </View>
            <View style={reviewStyles.barsCol}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const countOfStars = reviews.filter((r) => r.rating === stars).length;
                const pct = total > 0 ? (countOfStars / reviews.length) * 100 : stars === 5 ? 85 : stars === 4 ? 10 : 5;
                return (
                  <View key={stars} style={reviewStyles.barRow}>
                    <Text style={reviewStyles.barLabel}>{stars} ★</Text>
                    <View style={reviewStyles.barBg}>
                      <View style={[reviewStyles.barFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={reviewStyles.barPct}>{Math.round(pct)}%</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {reviews.map((r) => (
            <View key={r.id} style={reviewStyles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <StarRow rating={r.rating} />
                <Text style={reviewStyles.reviewDate}>
                  {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              </View>
              {r.title ? (
                <Text style={reviewStyles.reviewTitle}>{r.title}</Text>
              ) : null}
              {r.body ? (
                <Text style={reviewStyles.reviewBody}>{r.body}</Text>
              ) : null}
              <View style={reviewStyles.reviewMeta}>
                <Text style={reviewStyles.reviewerName}>Guest Traveler</Text>
              </View>

              {/* Provider Response Reply */}
              {r.providerReply && (
                <View style={reviewStyles.replyBox}>
                  <View style={reviewStyles.replyHeader}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color="#1B5E20" style={{ marginRight: 4 }} />
                    <Text style={reviewStyles.replyHostLabel}>Host Response</Text>
                  </View>
                  <Text style={reviewStyles.replyBody}>{r.providerReply}</Text>
                </View>
              )}
            </View>
          ))}
          {total > 5 && (
            <Text style={reviewStyles.viewAllText}>View all {total} reviews</Text>
          )}
        </>
      )}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  sectionWrapper: { marginBottom: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  avgLabel: { fontSize: 14, color: "#374151", fontWeight: "600" },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
  },
  reviewTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 4 },
  reviewBody: { fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: 8 },
  reviewMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewerName: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  reviewDate: { fontSize: 12, color: "#9ca3af" },
  loadingBox: { paddingVertical: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#9ca3af", fontStyle: "italic" },
  viewAllText: { fontSize: 14, color: "#1B5E20", fontWeight: "600", marginTop: 4 },
  
  // Breakdown
  breakdownContainer: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
    alignItems: "center",
    gap: 16,
  },
  scoreCol: { alignItems: "center", justifyContent: "center", width: "35%" },
  scoreBig: { fontSize: 32, fontWeight: "800", color: "#111827" },
  starsRow: { flexDirection: "row", gap: 2, marginVertical: 4 },
  scoreCount: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  barsCol: { flex: 1, gap: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { fontSize: 11, color: "#4b5563", width: 22, textAlign: "right", fontWeight: "500" },
  barBg: { flex: 1, height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: "#fbbf24", borderRadius: 3 },
  barPct: { fontSize: 11, color: "#4b5563", width: 28, fontWeight: "500" },

  // Reply Box
  replyBox: {
    marginTop: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderColor: "#1B5E20",
  },
  replyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  replyHostLabel: { fontSize: 12, fontWeight: "700", color: "#1B5E20" },
  replyBody: { fontSize: 12, color: "#374151", lineHeight: 17 },
});

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PublicListingDetailScreen() {
  const { id, checkIn, checkOut, guests, pickupDatetime, returnDatetime } = useLocalSearchParams<{
    id: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pickupDatetime?: string;
    returnDatetime?: string;
  }>();

  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  // ── Fetch availability ───────────────────────────────────────────────────
  const { data: availabilityData } = useQuery<{ unavailableRanges: { start: string; end: string }[] }>({
    queryKey: ["listing-availability", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { unavailableRanges: any[] } }>(`/listings/${id}/availability`);
      return res.data.data;
    },
    enabled: !!id,
  });

  // ── Fetch listing ──────────────────────────────────────────────────────────

  const { data: listing, isLoading, isError } = useQuery<PublicListing>({
    queryKey: ["public-listing", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: PublicListing }>(`/listings/${id}/public`);
      return res.data.data;
    },
    enabled: !!id,
  });

  // ── Favourite toggle ───────────────────────────────────────────────────────

  const favMutation = useMutation({
    mutationFn: async ({ isFav }: { isFav: boolean }) => {
      if (isFav) {
        await listingApi.delete(`/guests/me/favourites/${id}`);
      } else {
        await listingApi.post("/guests/me/favourites", { listingId: id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-listing", id] });
      qc.invalidateQueries({ queryKey: ["favourites"] });
    },
    onError: () => {
      Alert.alert("Error", "Could not update saved status. Please try again.");
    },
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !listing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#dc2626" />
          <Text style={styles.errorTitle}>Listing not found</Text>
          <Text style={styles.errorSubtitle}>This listing is no longer available.</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={() => router.back()}>
            <Text style={styles.errorBtnText}>Back to search</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCar = listing.category === "car";
  const isHotel = listing.category === "hotel";
  const isApartment = listing.category === "apartment";

  const photos = [...(listing.photos ?? [])].sort((a, b) => a.position - b.position);
  const totalPhotos = photos.length;

  const priceLabel = isCar
    ? `${listing.currency ?? ""} ${(listing.pricePerNight ?? 0).toLocaleString()} / day`
    : `${listing.currency ?? ""} ${(listing.pricePerNight ?? 0).toLocaleString()} / night`;

  const isProvider = user?.userType === "provider";
  const isOwner = isProvider && (user as any)?.id && listing && (listing as any).providerId === (user as any)?.id;

  // Dates
  const hasDates = isCar
    ? !!(pickupDatetime && returnDatetime)
    : !!(checkIn && checkOut);

  const datesLabel = (() => {
    if (isCar && pickupDatetime && returnDatetime) {
      const days = daysBetween(pickupDatetime, returnDatetime);
      return `${formatDateWithTime(pickupDatetime)} → ${formatDateWithTime(returnDatetime)} (${days} day${days !== 1 ? "s" : ""})`;
    }
    if (!isCar && checkIn && checkOut) {
      const nights = nightsBetween(checkIn, checkOut);
      return `${formatDate(checkIn)} → ${formatDate(checkOut)} (${nights} night${nights !== 1 ? "s" : ""})`;
    }
    return null;
  })();

  // Amenities
  const standardAmenities = listing.amenities ?? [];
  const customAmenities = listing.customAmenities ?? [];
  const allAmenities: { label: string; isCustom: boolean }[] = [
    ...standardAmenities.map((a) => ({ label: AMENITY_LABELS[a.amenityKey] ?? a.amenityKey, isCustom: false })),
    ...customAmenities.map((a) => ({ label: a.label, isCustom: true })),
  ];
  const MAX_AMENITIES = 10;
  const visibleAmenities = amenitiesExpanded ? allAmenities : allAmenities.slice(0, MAX_AMENITIES);

  // Category display label
  const categoryLabel =
    listing.category.charAt(0).toUpperCase() + listing.category.slice(1);

  // Location string
  const locationParts = [listing.town, listing.country].filter(Boolean);
  const locationStr = locationParts.join(", ");

  // Sub-title line (hotel / apartment / car)
  const subTitle = (() => {
    if (isHotel && listing.starRating) {
      return "★".repeat(listing.starRating) + "☆".repeat(5 - listing.starRating);
    }
    if (isApartment) {
      const beds = listing.bedrooms ?? 0;
      const baths = listing.bathrooms ?? 0;
      const guests2 = listing.maxGuests ?? 0;
      return `${beds} bed · ${baths} bath · up to ${guests2} guests`;
    }
    if (isCar) {
      const make = listing.carMake ?? "";
      const model = listing.carModel ?? "";
      const year = listing.carYear ?? "";
      const trans = listing.transmission
        ? listing.transmission.charAt(0).toUpperCase() + listing.transmission.slice(1)
        : "";
      const seatsCount = listing.seats ?? 0;
      return `${make} ${model} ${year} · ${trans} · ${seatsCount} seats`.trim();
    }
    return null;
  })();

  function handleBookNow() {
    if (!hasDates) return;
    if (!user) {
      Alert.alert(
        "Sign in required",
        "You need to be signed in to book a listing.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/(auth)/login") },
        ]
      );
      return;
    }
    if (isCar) {
      router.push({
        pathname: "/book/[listingId]",
        params: { listingId: id, pickupDatetime, returnDatetime },
      });
    } else {
      router.push({
        pathname: "/book/[listingId]",
        params: { listingId: id, checkIn, checkOut, guests },
      });
    }
  }

  function handlePhotoScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPhotoIndex(index);
  }

  const isFav = listing.isFavourited ?? false;

  // Pricing Breakout Calculations
  const pricingBreakout = (() => {
    if (!hasDates || !listing.pricePerNight && !listing.pricePerDay) return null;
    
    const rate = isCar ? Number(listing.pricePerDay ?? listing.pricePerNight ?? 0) : Number(listing.pricePerNight ?? 0);
    const count = isCar 
      ? (pickupDatetime && returnDatetime ? daysBetween(pickupDatetime, returnDatetime) : 1)
      : (checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 1);
    
    const base = rate * count;
    
    let discount = 0;
    if (!isCar && listing.longStayEnabled && listing.longStayMinNights != null && count >= listing.longStayMinNights) {
      const discountValue = Number(listing.longStayDiscountValue ?? 0);
      if (listing.longStayDiscountType === "percentage") {
        discount = base * (discountValue / 100);
      } else {
        discount = discountValue * count;
      }
    }
    
    const serviceFee = base * 0.05;
    const tax = base * 0.10;
    const delivery = isCar && listing.deliveryAvailable && listing.deliveryFee ? Number(listing.deliveryFee) : 0;
    const total = base - discount + serviceFee + tax + delivery;

    return {
      rate,
      count,
      base,
      discount,
      serviceFee,
      tax,
      delivery,
      total,
    };
  })();

  // Dynamic host parameters - safely mapping backend-provided fields if returned by the APIs
  const hostName = (listing as any).provider?.name || (listing as any).host?.name || "Zika Verified Host";
  const hostAvatar = (listing as any).provider?.avatarUrl || (listing as any).host?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop";
  const hostRating = (listing as any).provider?.rating || (listing as any).host?.rating || "4.9";
  const hostBookings = (listing as any).provider?.bookingsCount || (listing as any).host?.bookingsCount || "128";
  const hostJoinDate = (listing as any).provider?.joinDate || (listing as any).host?.joinDate || "2024";
  const hostResponseRate = (listing as any).provider?.responseRate || (listing as any).host?.responseRate || "99%";
  const hostResponseTime = (listing as any).provider?.responseTime || (listing as any).host?.responseTime || "Within 1 hour";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Photo area ──────────────────────────────────────────────────── */}
        <View style={styles.photoContainer}>
          {totalPhotos > 0 ? (
            <>
              <FlatList
                data={photos}
                keyExtractor={(p) => p.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handlePhotoScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <TouchableOpacity activeOpacity={0.95} onPress={() => setFullscreenVisible(true)}>
                    <Image
                      source={{ uri: item.cdnUrl }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
              />
              {/* Photo counter */}
              <View style={styles.photoCounter}>
                <Text style={styles.photoCounterText}>{photoIndex + 1}/{totalPhotos}</Text>
              </View>
            </>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={48} color="#9ca3af" />
              <Text style={styles.photoPlaceholderText}>No photos</Text>
            </View>
          )}

          {/* Back button overlaid on photos */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Favourite button overlaid on photos */}
          {user && !isProvider && (
            <TouchableOpacity
              style={styles.favButton}
              onPress={() => favMutation.mutate({ isFav })}
              disabled={favMutation.isPending}
            >
              <Ionicons
                name={isFav ? "heart" : "heart-outline"}
                size={24}
                color={isFav ? "#dc2626" : "#fff"}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Fullscreen Photo Modal */}
        <Modal visible={fullscreenVisible} transparent={false} animationType="fade" onRequestClose={() => setFullscreenVisible(false)}>
          <SafeAreaView style={styles.fullscreenModal}>
            <View style={styles.fullscreenHeader}>
              <TouchableOpacity style={styles.fullscreenCloseBtn} onPress={() => setFullscreenVisible(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.fullscreenContent}>
              <FlatList
                data={photos}
                keyExtractor={(p) => p.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={photoIndex}
                getItemLayout={(data, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                onScroll={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setPhotoIndex(index);
                }}
                renderItem={({ item }) => (
                  <View style={styles.fullscreenPhotoWrapper}>
                    <Image source={{ uri: item.cdnUrl }} style={styles.fullscreenPhoto} resizeMode="contain" />
                  </View>
                )}
              />
              <View style={styles.fullscreenCounter}>
                <Text style={styles.fullscreenCounterText}>{photoIndex + 1} / {totalPhotos}</Text>
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <View style={styles.content}>

          {/* Title */}
          <Text style={styles.listingName}>{listing.name ?? "Untitled listing"}</Text>

          {/* Category badge + location */}
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
            </View>
            {locationStr ? (
              <Text style={styles.locationText}> · {locationStr}</Text>
            ) : null}
          </View>

          {/* Sub-title: stars / beds / car spec */}
          {subTitle ? (
            <Text style={styles.subTitle}>{subTitle}</Text>
          ) : null}

          {/* Red Promotion Banner */}
          {listing.longStayEnabled && (
            <View style={styles.promoBanner}>
              <View style={styles.promoIconContainer}>
                <Ionicons name="gift" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>Long-stay Discount Active!</Text>
                <Text style={styles.promoText}>
                  Book {listing.longStayMinNights ?? 7}+ nights and get a {listing.longStayDiscountValue ? Number(listing.longStayDiscountValue) : 0}% discount automatically.
                </Text>
              </View>
            </View>
          )}

          {/* Price */}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <Text style={styles.price}>{priceLabel}</Text>
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>Best Offer</Text>
            </View>
          </View>

          {isCar && listing.deliveryAvailable && listing.deliveryFee != null && (
            <Text style={styles.deliveryFee}>
              + {listing.currency ?? ""} {listing.deliveryFee.toLocaleString()} delivery
            </Text>
          )}

          {/* Dates section */}
          <View style={styles.datesSection}>
            <Text style={styles.sectionLabel}>Your dates</Text>
            {datesLabel ? (
              <View style={styles.datePill}>
                <Ionicons name="calendar-outline" size={15} color="#1B5E20" style={{ marginRight: 6 }} />
                <Text style={styles.datePillText}>{datesLabel}</Text>
              </View>
            ) : (
              <View style={styles.noDatesBox}>
                <Ionicons name="calendar-outline" size={16} color="#6b7280" style={{ marginRight: 6 }} />
                <Text style={styles.noDatesText}>Return to search to select dates.</Text>
              </View>
            )}
          </View>

          {/* Pricing Breakout Card */}
          {pricingBreakout && (
            <View style={styles.breakoutCard}>
              <Text style={styles.breakoutTitle}>Price Breakdown</Text>
              <View style={styles.breakoutRow}>
                <Text style={styles.breakoutLabel}>
                  {listing.currency} {pricingBreakout.rate.toLocaleString()} x {pricingBreakout.count} {isCar ? "day" : "night"}{pricingBreakout.count !== 1 ? "s" : ""}
                </Text>
                <Text style={styles.breakoutValue}>
                  {listing.currency} {pricingBreakout.base.toLocaleString()}
                </Text>
              </View>

              {pricingBreakout.discount > 0 && (
                <View style={styles.breakoutRow}>
                  <Text style={[styles.breakoutLabel, { color: "#dc2626" }]}>Long-stay promotion</Text>
                  <Text style={[styles.breakoutValue, { color: "#dc2626" }]}>
                    - {listing.currency} {pricingBreakout.discount.toLocaleString()}
                  </Text>
                </View>
              )}

              {isCar && pricingBreakout.delivery > 0 && (
                <View style={styles.breakoutRow}>
                  <Text style={styles.breakoutLabel}>Delivery fee</Text>
                  <Text style={styles.breakoutValue}>
                    {listing.currency} {pricingBreakout.delivery.toLocaleString()}
                  </Text>
                </View>
              )}

              <View style={styles.breakoutRow}>
                <Text style={styles.breakoutLabel}>Zika service fee (5%)</Text>
                <Text style={styles.breakoutValue}>
                  {listing.currency} {pricingBreakout.serviceFee.toLocaleString()}
                </Text>
              </View>

              <View style={styles.breakoutRow}>
                <Text style={styles.breakoutLabel}>Local taxes (10%)</Text>
                <Text style={styles.breakoutValue}>
                  {listing.currency} {pricingBreakout.tax.toLocaleString()}
                </Text>
              </View>

              <View style={styles.breakoutDivider} />

              <View style={[styles.breakoutRow, { marginBottom: 0 }]}>
                <Text style={styles.breakoutTotalLabel}>Total Price</Text>
                <Text style={styles.breakoutTotalValue}>
                  {listing.currency} {pricingBreakout.total.toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* Description */}
          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text
                style={styles.descriptionText}
                numberOfLines={descExpanded ? undefined : 4}
              >
                {listing.description}
              </Text>
              <TouchableOpacity onPress={() => setDescExpanded((v) => !v)}>
                <Text style={styles.readMoreText}>{descExpanded ? "Show less" : "Read more"}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.divider} />

          {/* Amenities */}
          {allAmenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What's included</Text>
              <View style={styles.amenityGrid}>
                {visibleAmenities.map((a, i) => (
                  <View key={i} style={styles.amenityChip}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#1B5E20" style={{ marginRight: 4 }} />
                    <Text style={styles.amenityChipText}>{a.label}</Text>
                  </View>
                ))}
              </View>
              {allAmenities.length > MAX_AMENITIES && (
                <TouchableOpacity onPress={() => setAmenitiesExpanded((v) => !v)}>
                  <Text style={styles.readMoreText}>
                    {amenitiesExpanded
                      ? "Show less"
                      : `Show all ${allAmenities.length} amenities`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.divider} />

          {/* Property details */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Property details</Text>
            {(isHotel || isApartment) && (
              <>
                {listing.checkinTime ? (
                  <DetailRow icon="log-in-outline" label="Check-in from" value={listing.checkinTime} />
                ) : null}
                {listing.checkoutTime ? (
                  <DetailRow icon="log-out-outline" label="Check-out by" value={listing.checkoutTime} />
                ) : null}
                <DetailRow
                  icon="flame-outline"
                  label="Smoking"
                  value={listing.smokingAllowed ? "Allowed" : "Not allowed"}
                />
                <DetailRow
                  icon="paw-outline"
                  label="Pets"
                  value={listing.petsAllowed ? "Allowed" : "Not allowed"}
                />
                {isApartment && listing.minStayNights ? (
                  <DetailRow
                    icon="moon-outline"
                    label="Minimum stay"
                    value={`${listing.minStayNights} night${listing.minStayNights !== 1 ? "s" : ""}`}
                  />
                ) : null}
                {isApartment && listing.longStayEnabled && listing.longStayMinNights != null && listing.longStayDiscountValue != null && (
                  <DetailRow
                    icon="pricetag-outline"
                    label="Long-stay discount"
                    value={
                      listing.longStayDiscountType === "percentage"
                        ? `${listing.longStayDiscountValue}% off for ${listing.longStayMinNights}+ nights`
                        : `${listing.currency ?? ""} ${listing.longStayDiscountValue} off for ${listing.longStayMinNights}+ nights`
                    }
                  />
                )}
              </>
            )}
            {isCar && (
              <>
                {listing.minDriverAge != null && (
                  <DetailRow icon="person-outline" label="Minimum driver age" value={`${listing.minDriverAge} years`} />
                )}
                <DetailRow
                  icon="speedometer-outline"
                  label="Mileage"
                  value={
                    listing.mileagePolicy === "unlimited"
                      ? "Unlimited"
                      : listing.mileageLimitKm != null
                      ? `${listing.mileageLimitKm} km/day`
                      : "See host"
                  }
                />
                {listing.fuelType ? (
                  <DetailRow
                    icon="car-outline"
                    label="Fuel"
                    value={listing.fuelType.charAt(0).toUpperCase() + listing.fuelType.slice(1)}
                  />
                ) : null}
                <DetailRow
                  icon="navigate-outline"
                  label="Delivery"
                  value={
                    listing.deliveryAvailable
                      ? `Available within ${listing.deliveryRadiusKm ?? "?"}km for ${listing.currency ?? ""} ${listing.deliveryFee ?? "?"}`
                      : "Not available"
                  }
                />
              </>
            )}
          </View>

          {/* Host Card Section */}
          <View style={styles.divider} />
          <View style={styles.hostCard}>
            <Image
              source={{ uri: hostAvatar }}
              style={styles.hostAvatar}
            />
            <View style={styles.hostInfo}>
              <Text style={styles.hostTitle}>Hosted by {hostName}</Text>
              <Text style={styles.hostStats}>
                ★ {hostRating} · {hostBookings} bookings · Joined {hostJoinDate}
              </Text>
              <Text style={styles.hostResponse}>
                Response Rate: {hostResponseRate} · Response Time: {hostResponseTime}
              </Text>
            </View>
            <TouchableOpacity style={styles.hostContactBtn} onPress={() => Alert.alert("Message Host", "Host messaging is not available in guest review mode.")}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#1B5E20" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Cancellation policy */}
          {listing.cancellationPolicy && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Cancellation policy</Text>
              <View style={[styles.cancelBadge, { backgroundColor: `${cancellationBadgeColor(listing.cancellationPolicy)}18` }]}>
                <Text style={[styles.cancelBadgeText, { color: cancellationBadgeColor(listing.cancellationPolicy) }]}>
                  {listing.cancellationPolicy.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </View>
              <Text style={styles.cancelDescription}>{cancellationText(listing.cancellationPolicy)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Visual Availability Calendar */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Date Availability</Text>
            <InlineCalendar unavailableRanges={availabilityData?.unavailableRanges ?? []} currency={listing.currency ?? "USD"} />
          </View>

          <View style={styles.divider} />

          {/* Guest Reviews */}
          <View style={styles.section}>
            <ReviewsSection listingId={id} />
          </View>

          <View style={styles.divider} />

          {/* Map view using react-native-maps */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location</Text>
            {listing.lat && listing.lng ? (
              <View style={styles.mapCard}>
                {MapView && Marker ? (
                  <MapView
                    style={styles.detailMap}
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
                      coordinate={{
                        latitude: Number(listing.lat),
                        longitude: Number(listing.lng),
                      }}
                      title={listing.name ?? "Property Location"}
                    />
                  </MapView>
                ) : (
                  <View style={[styles.detailMap, { backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }]}>
                    <View style={{ backgroundColor: "#eff6ff", width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                      <Ionicons name="location" size={24} color="#1B5E20" />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", textAlign: "center" }}>
                      {listing.name ?? "Property Location"}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 4, paddingHorizontal: 20 }}>
                      {[listing.address, listing.town, listing.country].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.openInMapsBtn}
                  onPress={() => {
                    const lat = Number(listing.lat);
                    const lng = Number(listing.lng);
                    const label = encodeURIComponent(listing.name ?? "Listing");
                    const url = Platform.select({
                      ios: `maps://app?daddr=${lat},${lng}&q=${label}`,
                      android: `google.navigation:q=${lat},${lng}`,
                    }) || "";
                    Linking.openURL(url).catch(() => {
                      Alert.alert("Error", "Could not open map navigation.");
                    });
                  }}
                >
                  <Ionicons name="navigate-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.openInMapsBtnText}>Navigate to Property</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>
                  {[listing.town, listing.country].filter(Boolean).join(", ") || "Location not specified"}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom padding so sticky bar doesn't hide content */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyPrice}>
          <Text style={styles.stickyPriceLabel}>{priceLabel}</Text>
        </View>

        {isProvider ? (
          <View style={styles.bookBtnDisabled}>
            <Text style={styles.bookBtnDisabledText}>Provider account</Text>
          </View>
        ) : !hasDates ? (
          <TouchableOpacity style={styles.selectDatesBtn} onPress={() => router.back()}>
            <Text style={styles.selectDatesBtnText}>Select dates</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.bookBtn} onPress={handleBookNow}>
            <Text style={styles.bookBtnText}>Book Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Detail row sub-component ──────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color="#6b7280" style={styles.detailIcon} />
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { flexGrow: 1 },

  // Photos
  photoContainer: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, position: "relative", backgroundColor: "#e5e7eb" },
  photo: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT },
  photoPlaceholder: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: { color: "#9ca3af", fontSize: 14, marginTop: 8 },
  photoCounter: {
    position: "absolute",
    bottom: 12,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    zIndex: 10,
  },
  photoCounterText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  backButton: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  favButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  // Content
  content: { paddingHorizontal: 18, paddingTop: 18, backgroundColor: "#fff" },
  listingName: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8, lineHeight: 28 },

  categoryRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, flexWrap: "wrap" },
  categoryBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  categoryBadgeText: { fontSize: 12, fontWeight: "600", color: "#1B5E20" },
  locationText: { fontSize: 14, color: "#6b7280", flexShrink: 1 },

  subTitle: { fontSize: 14, color: "#374151", marginBottom: 12 },

  price: { fontSize: 24, fontWeight: "800", color: "#111827" },
  deliveryFee: { fontSize: 13, color: "#6b7280", marginBottom: 8 },

  // Dates
  datesSection: { marginTop: 12, marginBottom: 4 },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  datePillText: { fontSize: 14, color: "#1B5E20", fontWeight: "500" },
  noDatesBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  noDatesText: { fontSize: 13, color: "#6b7280" },

  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 20 },

  section: { marginBottom: 4 },
  sectionLabel: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },

  descriptionText: { fontSize: 14, color: "#374151", lineHeight: 22 },
  readMoreText: { fontSize: 14, color: "#1B5E20", fontWeight: "600", marginTop: 8 },

  // Amenities
  amenityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    width: "47%",
  },
  amenityChipText: { fontSize: 13, color: "#374151", flexShrink: 1 },

  // Property details
  detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  detailIcon: { marginRight: 8 },
  detailLabel: { fontSize: 13, color: "#6b7280", width: 150 },
  detailValue: { fontSize: 13, color: "#111827", fontWeight: "500", flex: 1 },

  // Cancellation
  cancelBadge: { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  cancelBadgeText: { fontSize: 13, fontWeight: "600" },
  cancelDescription: { fontSize: 13, color: "#374151", lineHeight: 20 },

  // Map placeholder
  mapPlaceholder: {
    height: 200,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  mapPlaceholderText: { fontSize: 15, color: "#6b7280", fontWeight: "500" },

  // Error
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  errorTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, marginBottom: 8 },
  errorSubtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 24 },
  errorBtn: { backgroundColor: "#1B5E20", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  errorBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Sticky bar
  stickyBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 18,
    paddingVertical: 12,
    paddingBottom: 24,
    gap: 12,
  },
  stickyPrice: { flex: 1 },
  stickyPriceLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  bookBtn: {
    backgroundColor: "#1B5E20",
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  bookBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  bookBtnDisabled: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  bookBtnDisabledText: { color: "#9ca3af", fontWeight: "600", fontSize: 14 },
  selectDatesBtn: {
    borderWidth: 2,
    borderColor: "#1B5E20",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  selectDatesBtnText: { color: "#1B5E20", fontWeight: "700", fontSize: 15 },

  // Fullscreen Photo Modal
  fullscreenModal: { flex: 1, backgroundColor: "#000" },
  fullscreenHeader: { height: 50, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 16, paddingTop: 10 },
  fullscreenCloseBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  fullscreenContent: { flex: 1, justifyContent: "center", alignItems: "center", position: "relative" },
  fullscreenPhotoWrapper: { width: SCREEN_WIDTH, height: "100%", justifyContent: "center", alignItems: "center" },
  fullscreenPhoto: { width: SCREEN_WIDTH, height: "80%" },
  fullscreenCounter: { position: "absolute", bottom: 40, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  fullscreenCounterText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Red Promotion Banner
  promoBanner: { flexDirection: "row", backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 12, padding: 12, gap: 10, marginVertical: 14, alignItems: "center" },
  promoIconContainer: { backgroundColor: "#dc2626", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  promoTitle: { fontSize: 14, fontWeight: "700", color: "#dc2626", marginBottom: 2 },
  promoText: { fontSize: 12, color: "#991b1b", lineHeight: 16 },

  // Offer Badges
  offerBadge: { backgroundColor: "#eff6ff", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#bfdbfe" },
  offerBadgeText: { fontSize: 11, fontWeight: "700", color: "#1B5E20" },

  // Pricing Breakout Card
  breakoutCard: { backgroundColor: "#fafafa", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 16, marginVertical: 16 },
  breakoutTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 12 },
  breakoutRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  breakoutLabel: { fontSize: 13, color: "#4b5563", fontWeight: "500" },
  breakoutValue: { fontSize: 13, color: "#111827", fontWeight: "600" },
  breakoutDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 10 },
  breakoutTotalLabel: { fontSize: 15, fontWeight: "800", color: "#111827" },
  breakoutTotalValue: { fontSize: 16, fontWeight: "800", color: "#1B5E20" },

  // Host Card
  hostCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", gap: 12, marginVertical: 4 },
  hostAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#e5e7eb" },
  hostInfo: { flex: 1 },
  hostTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  hostStats: { fontSize: 12, color: "#4b5563", marginTop: 2 },
  hostResponse: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  hostContactBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },

  // Map Card
  mapCard: { position: "relative", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb", height: 200, marginTop: 10 },
  detailMap: { flex: 1 },
  openInMapsBtn: { position: "absolute", bottom: 12, right: 12, backgroundColor: "#1B5E20", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 },
  openInMapsBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
