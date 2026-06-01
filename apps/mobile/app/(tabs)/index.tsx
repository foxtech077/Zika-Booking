import { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { listingApi } from "../../lib/listing-api";

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

// ── Listing Card ──────────────────────────────────────────────────────────────

function ListingCard({
  item, onPress, width = 200, badgeLabel, badgeColor,
}: {
  item: SearchResult; onPress: () => void; width?: number;
  badgeLabel?: string; badgeColor?: string;
}) {
  const isCar = item.listingType === "car";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  const unit = isCar ? "day" : "night";
  return (
    <TouchableOpacity style={[c.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View>
        {item.primaryPhotoUrl ? (
          <Image source={{ uri: item.primaryPhotoUrl }} style={c.photo} resizeMode="cover" />
        ) : (
          <View style={[c.photo, { backgroundColor: "#D1FAE5" }]} />
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

function NearbyCard({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const isCar = item.listingType === "car";
  const rate = isCar ? item.dailyRate : item.nightlyRate;
  return (
    <TouchableOpacity style={nb.card} onPress={onPress} activeOpacity={0.85}>
      {item.primaryPhotoUrl ? (
        <Image source={{ uri: item.primaryPhotoUrl }} style={nb.photo} resizeMode="cover" />
      ) : (
        <View style={[nb.photo, { backgroundColor: "#D1FAE5" }]} />
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
  const [location, setLocation] = useState("Nairobi");

  // ── API Queries ──────────────────────────────────────────────────────────
  const { data: hotelsData, isLoading: hotelsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-hotels"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=hotel&lat=-1.2921&lng=36.8219&radius_km=50&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  const { data: apartmentsData, isLoading: aptsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-apartments"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=apartment&lat=-1.2921&lng=36.8219&radius_km=50&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  const { data: carsData, isLoading: carsLoading } = useQuery<SearchResult[]>({
    queryKey: ["home-cars"],
    queryFn: async () => {
      const res = await listingApi.get<SearchResponse>(
        "/search?category=car&lat=-1.2921&lng=36.8219&radius_km=50&limit=30"
      );
      return res.data.data.results ?? [];
    },
    staleTime: 60000,
  });

  // ── Curated segments ─────────────────────────────────────────────────────
  const bestOffers = [
    ...(hotelsData ?? []).filter((h) => h.nightlyRate != null && h.nightlyRate <= 15000),
    ...(apartmentsData ?? []).filter((a) => a.longStayDiscountEnabled),
  ].slice(0, 8);

  const recommended = [
    ...(hotelsData ?? []).filter((h) => (h.starRating ?? 0) >= 4 || h.isAccredited),
    ...(apartmentsData ?? []).filter((a) => a.isAccredited),
  ].slice(0, 8);

  const featured = (hotelsData ?? [])
    .filter((h) => h.isAccredited || (h.starRating ?? 0) >= 5)
    .slice(0, 3);

  const nearbyAll = [
    ...(hotelsData ?? []),
    ...(apartmentsData ?? []),
  ].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5);

  const premiumCars = (carsData ?? []).slice(0, 6);

  const trending = [
    ...(hotelsData ?? []).slice(0, 2),
    ...(apartmentsData ?? []).slice(0, 2),
  ].slice(0, 4);

  function navToListing(id: string, _isCar?: boolean) {
    router.push({ pathname: `/listing/${id}` as any });
  }

  function handleSearch() {
    if (!location.trim()) {
      Alert.alert("Location required", "Please enter a city.");
      return;
    }
    router.push({
      pathname: "/search",
      params: { category: category === "cars" ? "car" : category === "apartments" ? "apartment" : "hotel", placeName: location },
    });
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

        {/* ── Search Box ── */}
        <View style={s.searchCard}>
          <Ionicons name="location-outline" size={18} color={GREEN} style={{ marginRight: 10 }} />
          <TextInput
            style={s.locationInput}
            value={location}
            onChangeText={setLocation}
            placeholder="Where to?"
            placeholderTextColor={MUTED}
          />
        </View>
        <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
          <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.searchBtnText}>Search {category === "cars" ? "Cars" : "Stays"}</Text>
        </TouchableOpacity>

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
                <TouchableOpacity key={item.id} style={s.featuredCard} onPress={() => navToListing(item.id, false)} activeOpacity={0.88}>
                  {item.primaryPhotoUrl ? (
                    <Image source={{ uri: item.primaryPhotoUrl }} style={s.featuredPhoto} resizeMode="cover" />
                  ) : (
                    <View style={[s.featuredPhoto, { backgroundColor: "#D1FAE5" }]} />
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
                <NearbyCard key={item.id} item={item} onPress={() => navToListing(item.id, item.listingType === "car")} />
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
                  <TouchableOpacity
                    key={item.id}
                    style={[c.card, { width: 220, marginRight: idx < premiumCars.length - 1 ? 12 : 0 }]}
                    onPress={() => navToListing(item.id, true)}
                    activeOpacity={0.85}
                  >
                    {item.primaryPhotoUrl ? (
                      <Image source={{ uri: item.primaryPhotoUrl }} style={[c.photo, { height: 140 }]} resizeMode="cover" />
                    ) : (
                      <View style={[c.photo, { height: 140, backgroundColor: "#D1FAE5" }]} />
                    )}
                    <View style={c.body}>
                      <View style={s.carBadge}><Text style={s.carBadgeText}>LUXURY</Text></View>
                      <Text style={c.title} numberOfLines={1}>{item.carMake} {item.carModel} {item.carYear}</Text>
                      <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{item.transmission} · {item.seats} seats</Text>
                      <Text style={c.price}>{fmtPrice(item.dailyRate, item.currency)}<Text style={c.priceUnit}>/day</Text></Text>
                    </View>
                  </TouchableOpacity>
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
                <TouchableOpacity key={item.id} style={s.trendCard} onPress={() => navToListing(item.id, false)} activeOpacity={0.85}>
                  {item.primaryPhotoUrl ? (
                    <Image source={{ uri: item.primaryPhotoUrl }} style={s.trendPhoto} resizeMode="cover" />
                  ) : (
                    <View style={[s.trendPhoto, { backgroundColor: "#D1FAE5" }]} />
                  )}
                  <View style={s.trendOverlay}>
                    <Text style={s.trendTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.trendPrice}>{fmtPrice(item.nightlyRate ?? item.dailyRate, item.currency)}</Text>
                  </View>
                </TouchableOpacity>
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
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 13,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  locationInput: { flex: 1, fontSize: 15, color: TEXT, fontWeight: "500" },

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
