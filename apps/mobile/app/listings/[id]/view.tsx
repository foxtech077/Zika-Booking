import { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { listingApi } from "../../../lib/listing-api";
import { K } from "../../../constants/theme";
import { formatCurrency } from "../../../lib/currency";
import { AMENITY_CATEGORIES, AMENITY_CONFIG } from "../../../constants/amenities";
import { getListingDisplayStatus } from "../../../lib/listing-validation";

const { width: W } = Dimensions.get("window");
const CAROUSEL_H = 300;

const AMENITY_LABELS: Record<string, string> = Object.values(AMENITY_CONFIG)
  .flat()
  .reduce((acc, item) => ({ ...acc, [item.key]: item.label }), {} as Record<string, string>);

const ROOM_TYPE_LABELS: Record<string, string> = {
  standard: "Standard", superior: "Superior", deluxe: "Deluxe", suite: "Suite",
  junior_suite: "Junior Suite", studio: "Studio", family_room: "Family Room",
  presidential_suite: "Presidential Suite",
};
const BODY_TYPE_LABELS: Record<string, string> = {
  sedan: "Sedan", suv: "SUV", minivan: "Minivan", pickup: "Pickup",
  van: "Van", convertible: "Convertible", sports: "Sports", other: "Other",
};
const TRANSMISSION_LABELS: Record<string, string> = { manual: "Manual", automatic: "Automatic", both: "Both" };
const FUEL_TYPE_LABELS: Record<string, string> = { petrol: "Petrol", diesel: "Diesel", electric: "Electric", hybrid: "Hybrid" };
const CAT_LABEL: Record<string, string> = { hotel: "Hotel", apartment: "Apartment", car: "Car Rental" };

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  active:         { label: "Active",           bg: "#059669", text: "#fff", icon: "check-circle" },
  approved:       { label: "Active",           bg: "#059669", text: "#fff", icon: "check-circle" },
  draft:          { label: "Draft",            bg: "#475569", text: "#fff", icon: "edit-2" },
  pending_review: { label: "Pending Approval", bg: "#D97706", text: "#fff", icon: "clock" },
  rejected:       { label: "Rejected",         bg: "#DC2626", text: "#fff", icon: "x-circle" },
  deactivated:    { label: "Paused",           bg: "#64748B", text: "#fff", icon: "pause-circle" },
  suspended:      { label: "Suspended",        bg: "#DC2626", text: "#fff", icon: "alert-circle" },
};

const STATUS_BODY: Record<string, string | undefined> = {
  draft:          "Complete all required fields and photos to publish this listing.",
  pending_review: "Our team is reviewing your submission. You will be notified within 2-3 business days.",
  rejected:       "",
  deactivated:    "Your listing is temporarily offline. Resume it anytime from the listings page.",
  suspended:      "This listing has been suspended by our team. Contact support for assistance.",
};

const DOC_LABELS: Record<string, string> = {
  business_licence:    "Business Licence",
  operating_permit:    "Hotel Operating Permit",
  tourism_certificate: "Tourism Authority Certificate",
};

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={vs.card}>
      <Text style={vs.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={vs.detailRow}>
      <View style={vs.detailIcon}>
        <Feather name={icon as any} size={13} color={K.colors.accent} />
      </View>
      <Text style={vs.detailLabel}>{label}</Text>
      <Text style={vs.detailValue} numberOfLines={2}>{String(value)}</Text>
    </View>
  );
}

function PolicyRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={vs.policyRow}>
      <Feather name={ok ? "check-circle" : "x-circle"} size={15} color={ok ? K.colors.accent : K.colors.error} />
      <Text style={vs.policyLabel}>{label}</Text>
    </View>
  );
}

export default function ViewListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [imgIdx, setImgIdx] = useState(0);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const idx = viewableItems[0]?.index;
      if (idx != null) setImgIdx(idx);
    }
  ).current;

  const { data: listing, isLoading, isError, refetch } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <View style={vs.center}><ActivityIndicator size="large" color={K.colors.accent} /></View>;
  }

  if (isError || !listing) {
    return (
      <View style={vs.center}>
        <Feather name="alert-circle" size={44} color={K.colors.error} />
        <Text style={vs.centerText}>Could not load listing</Text>
        <TouchableOpacity style={vs.retryBtn} onPress={() => refetch()}>
          <Text style={vs.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const category: "hotel" | "apartment" | "car" = listing.category ?? "hotel";
  const photos: Array<{ cdnUrl: string }> = Array.isArray(listing.photos) ? listing.photos : [];
  const documents: Array<{ documentType: string }> = Array.isArray(listing.documents) ? listing.documents : [];
  const customAmenities: string[] = Array.isArray(listing.customAmenities)
    ? listing.customAmenities.map((a: any) => a.label ?? a).filter(Boolean) : [];

  // Helper to ensure predefined amenities are grouped
  const groupedAmenities: Record<string, string[]> = (() => {
    const empty: Record<string, string[]> = {
      Connectivity: [],
      "Food & Drink": [],
      Wellness: [],
      Comfort: [],
      Services: [],
    };
    if (!listing.amenities) return empty;
    
    if (Array.isArray(listing.amenities)) {
      for (const item of listing.amenities) {
        const key = item?.amenityKey ?? item;
        if (typeof key === "string") {
          const cleanKey = key.includes(":") ? key.split(":")[1] : key;
          let foundCat = "Services";
          for (const cat of AMENITY_CATEGORIES) {
            if (AMENITY_CONFIG[cat].some(i => i.key === cleanKey)) {
              foundCat = cat;
              break;
            }
          }
          if (!empty[foundCat].includes(cleanKey)) {
            empty[foundCat].push(cleanKey);
          }
        }
      }
      return empty;
    } else if (typeof listing.amenities === "object") {
      for (const cat of AMENITY_CATEGORIES) {
        const vals = listing.amenities[cat];
        if (Array.isArray(vals)) {
          for (const val of vals) {
            const itemKey = typeof val === "object" ? val?.amenityKey ?? val : val;
            if (typeof itemKey === "string") {
              const cleanKey = itemKey.includes(":") ? itemKey.split(":")[1] : itemKey;
              if (!empty[cat].includes(cleanKey)) {
                empty[cat].push(cleanKey);
              }
            }
          }
        }
      }
      return empty;
    }
    return empty;
  })();

  const { status: displayStatus, missingFields } = getListingDisplayStatus(listing);
  const sc = STATUS_CFG[displayStatus] ?? { label: displayStatus, bg: "#64748B", text: "#fff", icon: "info" };
  const isActive = displayStatus === "active";
  const canEdit = displayStatus !== "pending_review" && displayStatus !== "suspended";
  const editRoute = `/listings/${id}` as any;
  const priceLabel = listing.pricePerNight != null
    ? formatCurrency(listing.pricePerNight, listing.currency ?? "USD") : null;

  return (
    <View style={vs.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={{ height: CAROUSEL_H }}>
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({ item }) => (
                <Image source={{ uri: item.cdnUrl }} style={{ width: W, height: CAROUSEL_H }} resizeMode="cover" />
              )}
            />
          ) : (
            <View style={vs.noPhoto}>
              <Feather name="image" size={52} color="rgba(255,255,255,0.2)" />
              <Text style={vs.noPhotoText}>No photos added yet</Text>
            </View>
          )}

          <View style={vs.imgGradient} pointerEvents="none" />

          <SafeAreaView edges={["top"]} style={vs.imgHeader} pointerEvents="box-none">
            <TouchableOpacity style={vs.imgBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity style={vs.imgBtn} onPress={() => router.push(editRoute)} activeOpacity={0.8}>
                <Feather name="edit-2" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </SafeAreaView>

          <View style={[vs.imgStatus, { backgroundColor: sc.bg }]}>
            <Feather name={sc.icon as any} size={10} color={sc.text} />
            <Text style={[vs.imgStatusText, { color: sc.text }]}>{sc.label}</Text>
          </View>

          {photos.length > 1 && (
            <View style={vs.imgFooter}>
              <View style={vs.dots}>
                {photos.slice(0, 10).map((_, i) => (
                  <View key={i} style={[vs.dot, i === imgIdx && vs.dotActive]} />
                ))}
              </View>
              <View style={vs.imgCount}>
                <Feather name="image" size={10} color="rgba(255,255,255,0.8)" />
                <Text style={vs.imgCountText}>{imgIdx + 1} / {photos.length}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={vs.titleBlock}>
          <View style={vs.catBadge}>
            <Text style={vs.catBadgeText}>{CAT_LABEL[category] ?? category}</Text>
          </View>
          <Text style={vs.listingName}>{listing.name ?? "Untitled Listing"}</Text>
          {(listing.address || listing.town || listing.country) && (
            <View style={vs.locationRow}>
              <Feather name="map-pin" size={13} color={K.colors.accent} />
              <Text style={vs.locationText} numberOfLines={2}>
                {[listing.address, listing.town, listing.country].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}
          {priceLabel && (
            <View style={vs.priceRow}>
              <Text style={vs.priceValue}>{priceLabel}</Text>
              <Text style={vs.priceUnit}> / {category === "car" ? "day" : "night"}</Text>
            </View>
          )}
        </View>

        {!isActive && STATUS_BODY[displayStatus] !== undefined && (
          <View style={[vs.statusCard, { borderLeftColor: sc.bg }]}>
            <View style={[vs.statusDot, { backgroundColor: sc.bg }]} />
            <View style={{ flex: 1 }}>
              <Text style={vs.statusCardTitle}>{sc.label}</Text>
              {!!STATUS_BODY[displayStatus] && (
                <Text style={vs.statusCardBody}>{STATUS_BODY[displayStatus]}</Text>
              )}
              {!!listing.rejectionNote && (
                <Text style={vs.rejectionNote}>Reason: {listing.rejectionNote}</Text>
              )}
              {displayStatus === "draft" && missingFields.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: "700", fontSize: K.font.sm, color: K.colors.error, marginBottom: 4 }}>
                    Missing required fields:
                  </Text>
                  {missingFields.map((field) => (
                    <Text key={field} style={{ fontSize: K.font.xs, color: K.colors.textMuted, lineHeight: 18 }}>
                      • {field}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {!!listing.description && (
          <SectionCard title="Description">
            <Text style={vs.description}>{listing.description}</Text>
          </SectionCard>
        )}

        <SectionCard title={category === "car" ? "Vehicle Details" : "Property Details"}>
          {category === "hotel" && (
            <>
              <DetailRow icon="layers"  label="Room Type"    value={ROOM_TYPE_LABELS[listing.roomType] ?? listing.roomType} />
              <DetailRow icon="home"    label="Total Units"  value={listing.unitCount != null ? `${listing.unitCount} units` : null} />
              <DetailRow icon="star"    label="Star Rating"  value={listing.claimedStarRating != null ? `${listing.claimedStarRating} stars` : null} />
              <DetailRow icon="log-in"  label="Check-in"    value={listing.checkinTime} />
              <DetailRow icon="log-out" label="Check-out"   value={listing.checkoutTime} />
              <DetailRow icon="moon"    label="Min Stay"    value={listing.minStayNights != null ? `${listing.minStayNights} night${Number(listing.minStayNights) !== 1 ? "s" : ""}` : null} />
              <DetailRow icon="shield"  label="Cancellation" value={listing.cancellationPolicy ? cap(listing.cancellationPolicy) : null} />
            </>
          )}
          {category === "apartment" && (
            <>
              <DetailRow icon="home"    label="Bedrooms"    value={listing.bedrooms === 0 ? "Studio" : listing.bedrooms != null ? `${listing.bedrooms} bedroom${listing.bedrooms !== 1 ? "s" : ""}` : null} />
              <DetailRow icon="droplet" label="Bathrooms"   value={listing.bathrooms != null ? `${listing.bathrooms} bathroom${listing.bathrooms !== 1 ? "s" : ""}` : null} />
              <DetailRow icon="users"   label="Max Guests"  value={listing.maxGuests != null ? `${listing.maxGuests} guest${listing.maxGuests !== 1 ? "s" : ""}` : null} />
              <DetailRow icon="log-in"  label="Check-in"    value={listing.checkinTime} />
              <DetailRow icon="log-out" label="Check-out"   value={listing.checkoutTime} />
              <DetailRow icon="moon"    label="Min Stay"    value={listing.minStayNights != null ? `${listing.minStayNights} night${Number(listing.minStayNights) !== 1 ? "s" : ""}` : null} />
              <DetailRow icon="shield"  label="Cancellation" value={listing.cancellationPolicy ? cap(listing.cancellationPolicy) : null} />
              {listing.longStayEnabled && listing.longStayDiscountValue != null && (
                <DetailRow icon="percent" label="Long-stay Discount"
                  value={`${listing.longStayDiscountValue}${listing.longStayDiscountType === "percentage" ? "%" : ` ${listing.currency ?? "USD"}`} off for ${listing.longStayMinNights ?? "?"}+ nights`}
                />
              )}
            </>
          )}
          {category === "car" && (
            <>
              <DetailRow icon="truck"      label="Make & Model"   value={[listing.carMake, listing.carModel].filter(Boolean).join(" ") || null} />
              <DetailRow icon="calendar"   label="Year"           value={listing.carYear} />
              <DetailRow icon="box"        label="Body Type"      value={BODY_TYPE_LABELS[listing.bodyType] ?? listing.bodyType} />
              <DetailRow icon="settings"   label="Transmission"   value={TRANSMISSION_LABELS[listing.transmission] ?? listing.transmission} />
              <DetailRow icon="zap"        label="Fuel Type"      value={FUEL_TYPE_LABELS[listing.fuelType] ?? listing.fuelType} />
              <DetailRow icon="users"      label="Seats"          value={listing.seats != null ? `${listing.seats} seat${listing.seats !== 1 ? "s" : ""}` : null} />
              <DetailRow icon="navigation" label="Mileage"
                value={listing.mileagePolicy === "unlimited" ? "Unlimited" : listing.mileagePolicy === "limited" && listing.mileageLimitKm ? `Limited - ${listing.mileageLimitKm} km/day` : listing.mileagePolicy ?? null}
              />
              <DetailRow icon="user-check" label="Min Driver Age"  value={listing.minDriverAge ? `${listing.minDriverAge} years` : null} />
              <DetailRow icon="shield"     label="Cancellation"    value={listing.cancellationPolicy ? cap(listing.cancellationPolicy) : null} />
              {listing.deliveryAvailable && (
                <DetailRow icon="package" label="Delivery"
                  value={listing.deliveryFee != null ? `Available - ${formatCurrency(listing.deliveryFee, listing.currency ?? "USD")} fee - ${listing.deliveryRadiusKm ?? "-"} km radius` : "Available"}
                />
              )}
              {!!listing.licencePlate && <DetailRow icon="credit-card" label="Licence Plate" value={listing.licencePlate} />}
            </>
          )}
        </SectionCard>

        {(() => {
          const hasPredefined = AMENITY_CATEGORIES.some(
            (cat) => groupedAmenities[cat] && groupedAmenities[cat].length > 0
          );
          if (!hasPredefined) return null;

          return (
            <SectionCard title="Amenities">
              {AMENITY_CATEGORIES.map((cat) => {
                const vals = groupedAmenities[cat];
                if (!vals || vals.length === 0) return null;

                return (
                  <View key={cat} style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: K.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                      {cat}
                    </Text>
                    <View style={vs.amenitiesGrid}>
                      {vals.map((key) => (
                        <View key={key} style={vs.chip}>
                          <Text style={vs.chipText}>
                            {AMENITY_LABELS[key] ?? cap(key.replace(/_/g, " "))}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </SectionCard>
          );
        })()}

        {customAmenities.length > 0 && (
          <SectionCard title="Custom Amenities">
            <View style={vs.amenitiesGrid}>
              {customAmenities.map((lbl) => (
                <View key={`c-${lbl}`} style={[vs.chip, vs.chipCustom]}>
                  <Text style={[vs.chipText, vs.chipTextCustom]}>{lbl}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {(listing.smokingAllowed !== undefined || listing.petsAllowed !== undefined) && (
          <SectionCard title="House Rules">
            <PolicyRow ok={!listing.smokingAllowed} label={listing.smokingAllowed ? "Smoking allowed" : "No smoking"} />
            <PolicyRow ok={!!listing.petsAllowed} label={listing.petsAllowed ? "Pets welcome" : "Pets not allowed"} />
          </SectionCard>
        )}

        {category === "hotel" && (
          <SectionCard title="Accreditation Documents">
            {(["business_licence", "operating_permit", "tourism_certificate"] as const).map((key) => {
              const uploaded = documents.some((d) => d.documentType === key);
              return (
                <View key={key} style={vs.docRow}>
                  <Feather name={uploaded ? "check-circle" : "circle"} size={16} color={uploaded ? K.colors.accent : "#CBD5E1"} />
                  <Text style={[vs.docLabel, !uploaded && vs.docLabelMuted]}>{DOC_LABELS[key]}</Text>
                  <View style={[vs.docPill, { backgroundColor: uploaded ? "#D1FAE5" : "#F1F5F9" }]}>
                    <Text style={[vs.docPillText, { color: uploaded ? "#065F46" : "#94A3B8" }]}>{uploaded ? "Uploaded" : "Missing"}</Text>
                  </View>
                </View>
              );
            })}
          </SectionCard>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={vs.bottomBar}>
        {displayStatus === "pending_review" ? (
          <View style={vs.pendingBar}>
            <Feather name="clock" size={15} color={K.colors.warning} />
            <Text style={vs.pendingBarText}>Under review - editing is disabled</Text>
          </View>
        ) : displayStatus === "suspended" ? (
          <View style={[vs.pendingBar, { backgroundColor: "#FEF2F2" }]}>
            <Feather name="alert-circle" size={15} color={K.colors.error} />
            <Text style={[vs.pendingBarText, { color: "#B91C1C" }]}>Suspended - editing is disabled</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity 
              style={[vs.editBtn, { flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: K.colors.darkGreen }]} 
              onPress={() => router.push(editRoute)} 
              activeOpacity={0.88}
            >
              <Feather name="edit-2" size={17} color={K.colors.darkGreen} />
              <Text style={[vs.editBtnText, { color: K.colors.darkGreen }]}>Edit Listing</Text>
            </TouchableOpacity>
            
            {(displayStatus === "draft" || displayStatus === "rejected" || displayStatus === "deactivated") && (
              <TouchableOpacity 
                style={[vs.editBtn, { flex: 1 }]} 
                onPress={() => router.push(`/listings/${id}/submit` as any)} 
                activeOpacity={0.88}
              >
                <Feather name="zap" size={17} color="#fff" />
                <Text style={vs.editBtnText}>
                  {category === "hotel" ? "Submit Review" : "Go Live"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const vs = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: K.colors.bgLight, gap: 14, padding: 24 },
  centerText: { fontSize: K.font.base, color: K.colors.textMuted },
  retryBtn: { backgroundColor: K.colors.accent, borderRadius: K.radius.md, paddingHorizontal: 28, paddingVertical: 11, marginTop: 8 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },

  noPhoto: { width: W, height: CAROUSEL_H, backgroundColor: K.colors.darkGreen, alignItems: "center", justifyContent: "center", gap: 10 },
  noPhotoText: { color: "rgba(255,255,255,0.45)", fontSize: K.font.sm },
  imgGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 110, backgroundColor: "rgba(0,0,0,0.42)" },
  imgHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 10 },
  imgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center", justifyContent: "center" },
  imgStatus: { position: "absolute", bottom: 48, left: 14, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  imgStatusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  imgFooter: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  dots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { width: 20, backgroundColor: "#fff", borderRadius: 3 },
  imgCount: { position: "absolute", right: 14, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: K.radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  imgCountText: { fontSize: 10, color: "rgba(255,255,255,0.9)", fontWeight: "700" },

  titleBlock: { backgroundColor: "#fff", padding: 20, borderBottomWidth: 1, borderBottomColor: K.colors.border },
  catBadge: { alignSelf: "flex-start", backgroundColor: K.colors.accentDim, borderRadius: K.radius.full, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  catBadgeText: { fontSize: K.font.xs, fontWeight: "800", color: K.colors.accent, textTransform: "uppercase", letterSpacing: 1 },
  listingName: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, lineHeight: 30, marginBottom: 8 },
  locationRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 12 },
  locationText: { flex: 1, fontSize: K.font.sm, color: K.colors.textMuted, lineHeight: 18 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  priceValue: { fontSize: 28, fontWeight: "900", color: K.colors.darkGreen },
  priceUnit: { fontSize: K.font.sm, color: K.colors.textMuted },

  statusCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16, borderRadius: K.radius.lg, padding: 14, borderLeftWidth: 4, ...K.shadow.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  statusCardTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 3 },
  statusCardBody: { fontSize: K.font.sm, color: K.colors.textMuted, lineHeight: 18 },
  rejectionNote: { fontSize: K.font.sm, color: K.colors.error, lineHeight: 18, fontWeight: "600", marginTop: 3 },

  card: { backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16, borderRadius: K.radius.xl, padding: 18, ...K.shadow.sm },
  cardTitle: { fontSize: 10, fontWeight: "800", color: K.colors.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },
  description: { fontSize: K.font.base, color: K.colors.textMid, lineHeight: 24 },

  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F8FAFB" },
  detailIcon: { width: 28, height: 28, borderRadius: K.radius.sm, backgroundColor: K.colors.accentDim, alignItems: "center", justifyContent: "center" },
  detailLabel: { flex: 1, fontSize: K.font.sm, color: K.colors.textMuted },
  detailValue: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, textAlign: "right", maxWidth: "56%" as any },

  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: K.colors.accentDim, borderRadius: K.radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  chipCustom: { backgroundColor: "#F1F5F9" },
  chipText: { fontSize: K.font.xs, fontWeight: "700", color: K.colors.accent },
  chipTextCustom: { color: K.colors.textMid },

  policyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F8FAFB" },
  policyLabel: { fontSize: K.font.sm, color: K.colors.textMid, fontWeight: "500" },

  docRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F8FAFB" },
  docLabel: { flex: 1, fontSize: K.font.sm, color: K.colors.textDark, fontWeight: "500" },
  docLabelMuted: { color: K.colors.textMuted },
  docPill: { borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  docPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },

  bottomBar: { backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: K.colors.border },
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: K.colors.darkGreen, borderRadius: K.radius.lg, paddingVertical: 15, ...K.shadow.md },
  editBtnText: { fontSize: K.font.base, fontWeight: "700", color: "#fff" },
  pendingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: K.radius.lg, paddingVertical: 14 },
  pendingBarText: { fontSize: K.font.sm, fontWeight: "600", color: "#92400E" },
});
