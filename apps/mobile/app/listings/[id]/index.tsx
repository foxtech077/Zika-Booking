import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Switch, Alert, ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { listingApi, uploadToS3 } from "../../../lib/listing-api";

const HOTEL_STEPS = ["Basic Info", "Location", "Pricing", "Amenities", "Photos", "Documents"];
const APARTMENT_STEPS = ["Basic Info", "Location", "Property", "Pricing", "Amenities", "Photos"];
const CAR_STEPS = ["Basic Info", "Location", "Vehicle", "Pricing", "Photos"];

const ROOM_TYPES = ["standard", "superior", "deluxe", "suite", "junior_suite", "studio", "family_room", "presidential_suite"];
const ROOM_TYPE_LABELS: Record<string, string> = {
  standard: "Standard", superior: "Superior", deluxe: "Deluxe", suite: "Suite",
  junior_suite: "Junior Suite", studio: "Studio", family_room: "Family Room", presidential_suite: "Presidential Suite",
};

const BODY_TYPES = ["sedan", "suv", "minivan", "pickup", "van", "convertible", "sports", "other"];
const BODY_TYPE_LABELS: Record<string, string> = {
  sedan: "Sedan", suv: "SUV", minivan: "Minivan", pickup: "Pickup",
  van: "Van", convertible: "Convertible", sports: "Sports", other: "Other",
};

const TRANSMISSION_OPTIONS = ["manual", "automatic", "both"];
const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual", automatic: "Automatic", both: "Both",
};

const FUEL_TYPES = ["petrol", "diesel", "electric", "hybrid"];
const FUEL_TYPE_LABELS: Record<string, string> = {
  petrol: "Petrol", diesel: "Diesel", electric: "Electric", hybrid: "Hybrid",
};

const AMENITY_OPTIONS = [
  { key: "wifi", label: "WiFi", category: "Connectivity" },
  { key: "smart_tv", label: "Smart TV", category: "Connectivity" },
  { key: "work_desk", label: "Work desk", category: "Connectivity" },
  { key: "kitchen", label: "Kitchen / kitchenette", category: "Food & Drink" },
  { key: "breakfast", label: "Breakfast included", category: "Food & Drink" },
  { key: "restaurant", label: "Restaurant on-site", category: "Food & Drink" },
  { key: "minibar", label: "Minibar", category: "Food & Drink" },
  { key: "pool", label: "Swimming pool", category: "Wellness" },
  { key: "gym", label: "Fitness centre", category: "Wellness" },
  { key: "spa", label: "Spa", category: "Wellness" },
  { key: "air_conditioning", label: "Air conditioning", category: "Comfort" },
  { key: "parking", label: "Parking", category: "Comfort" },
  { key: "elevator", label: "Elevator", category: "Comfort" },
  { key: "accessible", label: "Accessible", category: "Comfort" },
  { key: "reception_24h", label: "24h reception", category: "Services" },
  { key: "housekeeping", label: "Daily housekeeping", category: "Services" },
  { key: "airport_shuttle", label: "Airport shuttle", category: "Services" },
  { key: "security_24h", label: "24h security", category: "Services" },
];

const DOC_TYPES = [
  { key: "business_licence", label: "Business Licence" },
  { key: "operating_permit", label: "Hotel Operating Permit" },
  { key: "tourism_certificate", label: "Tourism Authority Certificate" },
];

interface ListingData {
  name: string;
  description: string;
  // hotel-specific
  roomType: string;
  unitCount: string;
  claimedStarRating: string;
  // apartment-specific
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  longStayEnabled: boolean;
  longStayMinNights: string;
  longStayDiscountType: "percentage" | "fixed";
  longStayDiscountValue: string;
  // car-specific
  carMake: string;
  carModel: string;
  carYear: string;
  bodyType: string;
  transmission: string;
  fuelType: string;
  seats: number;
  mileagePolicy: string;
  mileageLimitKm: string;
  minDriverAge: string;
  deliveryAvailable: boolean;
  deliveryFee: string;
  deliveryRadiusKm: string;
  licencePlate: string;
  // shared
  address: string;
  lat: string;
  lng: string;
  town: string;
  country: string;
  pricePerNight: string;
  currency: string;
  minStayNights: string;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  amenities: string[];
  customAmenities: string[];
}

interface Photo { id: string; cdnUrl: string; position: number }
interface Document { id: string; documentType: string }

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [customAmenityInput, setCustomAmenityInput] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const [form, setForm] = useState<ListingData>({
    name: "", description: "",
    roomType: "", unitCount: "", claimedStarRating: "",
    bedrooms: 1, bathrooms: 1, maxGuests: 2,
    longStayEnabled: false, longStayMinNights: "7",
    longStayDiscountType: "percentage", longStayDiscountValue: "",
    carMake: "", carModel: "", carYear: "",
    bodyType: "", transmission: "", fuelType: "",
    seats: 1, mileagePolicy: "unlimited", mileageLimitKm: "",
    minDriverAge: "", deliveryAvailable: false, deliveryFee: "", deliveryRadiusKm: "",
    licencePlate: "",
    address: "", lat: "", lng: "", town: "", country: "",
    pricePerNight: "", currency: "USD", minStayNights: "1",
    checkinTime: "", checkoutTime: "", cancellationPolicy: "",
    smokingAllowed: false, petsAllowed: false, amenities: [], customAmenities: [],
  });

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const category: "hotel" | "apartment" | "car" = listing?.category ?? "hotel";
  const STEPS = category === "apartment" ? APARTMENT_STEPS : category === "car" ? CAR_STEPS : HOTEL_STEPS;
  const minPhotos = category === "apartment" ? 3 : 1;

  useEffect(() => {
    if (!listing) return;
    setForm({
      name: listing.name ?? "",
      description: listing.description ?? "",
      roomType: listing.roomType ?? "",
      unitCount: listing.unitCount?.toString() ?? "",
      claimedStarRating: listing.claimedStarRating?.toString() ?? "",
      bedrooms: listing.bedrooms ?? 1,
      bathrooms: listing.bathrooms ?? 1,
      maxGuests: listing.maxGuests ?? 2,
      longStayEnabled: listing.longStayEnabled ?? false,
      longStayMinNights: listing.longStayMinNights?.toString() ?? "7",
      longStayDiscountType: listing.longStayDiscountType ?? "percentage",
      longStayDiscountValue: listing.longStayDiscountValue?.toString() ?? "",
      carMake: listing.carMake ?? "",
      carModel: listing.carModel ?? "",
      carYear: listing.carYear?.toString() ?? "",
      bodyType: listing.bodyType ?? "",
      transmission: listing.transmission ?? "",
      fuelType: listing.fuelType ?? "",
      seats: listing.seats ?? 1,
      mileagePolicy: listing.mileagePolicy ?? "unlimited",
      mileageLimitKm: listing.mileageLimitKm?.toString() ?? "",
      minDriverAge: listing.minDriverAge?.toString() ?? "",
      deliveryAvailable: listing.deliveryAvailable ?? false,
      deliveryFee: listing.deliveryFee?.toString() ?? "",
      deliveryRadiusKm: listing.deliveryRadiusKm?.toString() ?? "",
      licencePlate: listing.licencePlate ?? "",
      address: listing.address ?? "",
      lat: listing.lat?.toString() ?? "",
      lng: listing.lng?.toString() ?? "",
      town: listing.town ?? "",
      country: listing.country ?? "",
      pricePerNight: listing.pricePerNight?.toString() ?? "",
      currency: listing.currency ?? "USD",
      minStayNights: listing.minStayNights?.toString() ?? "1",
      checkinTime: listing.checkinTime ?? "",
      checkoutTime: listing.checkoutTime ?? "",
      cancellationPolicy: listing.cancellationPolicy ?? "",
      smokingAllowed: listing.smokingAllowed ?? false,
      petsAllowed: listing.petsAllowed ?? false,
      amenities: listing.amenities?.map((a: any) => a.amenityKey) ?? [],
      customAmenities: listing.customAmenities?.map((a: any) => a.label) ?? [],
    });
    setPhotos(listing.photos ?? []);
    setDocuments(listing.documents ?? []);
  }, [listing]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ListingData>) => {
      const payload: Record<string, unknown> = { ...data };
      if (data.unitCount !== undefined) payload.unitCount = parseInt(data.unitCount as string, 10) || null;
      if (data.claimedStarRating !== undefined) payload.claimedStarRating = parseInt(data.claimedStarRating as string, 10) || null;
      if (data.pricePerNight !== undefined) payload.pricePerNight = parseFloat(data.pricePerNight as string) || null;
      if (data.minStayNights !== undefined) payload.minStayNights = parseInt(data.minStayNights as string, 10) || 1;
      if (data.lat !== undefined) payload.lat = parseFloat(data.lat as string) || null;
      if (data.lng !== undefined) payload.lng = parseFloat(data.lng as string) || null;
      if (data.longStayMinNights !== undefined) payload.longStayMinNights = parseInt(data.longStayMinNights as string, 10) || null;
      if (data.longStayDiscountValue !== undefined) payload.longStayDiscountValue = parseFloat(data.longStayDiscountValue as string) || null;
      if (data.carYear !== undefined) payload.carYear = parseInt(data.carYear as string, 10) || null;
      if (data.seats !== undefined) payload.seats = parseInt(String(data.seats), 10) || null;
      if (data.mileageLimitKm !== undefined) payload.mileageLimitKm = parseInt(data.mileageLimitKm as string, 10) || null;
      if (data.minDriverAge !== undefined) payload.minDriverAge = parseInt(data.minDriverAge as string, 10) || null;
      if (data.deliveryFee !== undefined) payload.deliveryFee = parseFloat(data.deliveryFee as string) || null;
      if (data.deliveryRadiusKm !== undefined) payload.deliveryRadiusKm = parseInt(data.deliveryRadiusKm as string, 10) || null;
      await listingApi.patch(`/listings/${id}`, payload);
    },
  });

  async function saveAndNext() {
    setSaving(true);
    try {
      await saveMutation.mutateAsync(form);
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        router.push(`/listings/${id}/submit`);
      }
    } catch {
      Alert.alert("Error", "Failed to save. Please check your inputs and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGeocode() {
    if (!form.address.trim()) return Alert.alert("Enter an address first.");
    setGeocoding(true);
    try {
      const res = await listingApi.get<{ data: any }>(`/geocode?placeId=${encodeURIComponent(form.address)}`);
      const geo = res.data.data;
      setForm((f) => ({ ...f, lat: geo.lat?.toString() ?? "", lng: geo.lng?.toString() ?? "", town: geo.town ?? f.town, country: geo.country ?? f.country }));
    } catch {
      Alert.alert("Geocoding", "Could not find this location. Try a different address or enter coordinates manually.");
    } finally {
      setGeocoding(false);
    }
  }

  async function pickAndUploadPhoto() {
    if (photos.length >= 30) return Alert.alert("Maximum 30 photos allowed.");
    setUploadingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: 30 - photos.length,
      });
      if (result.canceled) return;
      for (const asset of result.assets) {
        if (photos.length >= 30) break;
        const contentType = asset.mimeType ?? "image/jpeg";
        const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
          `/listings/${id}/photos/presign`, { contentType, filename: asset.fileName ?? "photo.jpg" }
        );
        const { uploadUrl, s3Key } = presignRes.data.data;
        await uploadToS3(uploadUrl, asset.uri, contentType);
        const confirmRes = await listingApi.post<{ data: Photo }>(`/listings/${id}/photos/confirm`, { s3Key });
        setPhotos((p) => [...p, confirmRes.data.data]);
      }
    } catch {
      Alert.alert("Upload failed", "Some photos could not be uploaded. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto(photoId: string) {
    try {
      await listingApi.delete(`/listings/${id}/photos/${photoId}`);
      setPhotos((p) => p.filter((ph) => ph.id !== photoId));
    } catch {
      Alert.alert("Error", "Could not remove photo.");
    }
  }

  async function pickAndUploadDocument(docType: string, docLabel: string) {
    setUploadingDoc(docType);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const contentType = asset.mimeType ?? "application/pdf";
      const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
        `/listings/${id}/documents/presign`, { contentType, documentType: docType }
      );
      const { uploadUrl, s3Key } = presignRes.data.data;
      await uploadToS3(uploadUrl, asset.uri, contentType);
      const confirmRes = await listingApi.post<{ data: Document }>(
        `/listings/${id}/documents/confirm`, { s3Key, documentType: docType, contentType }
      );
      setDocuments((d) => [...d.filter((doc) => doc.documentType !== docType), confirmRes.data.data]);
    } catch {
      Alert.alert("Upload failed", `Could not upload ${docLabel}. Please try again.`);
    } finally {
      setUploadingDoc(null);
    }
  }

  // Map logical step index to a step name for branched rendering
  function stepName(): string {
    return STEPS[step] ?? "";
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <TouchableOpacity key={s} onPress={() => setStep(i)} style={styles.stepItem}>
            <View style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Step: Basic Info (all categories) ─────────────────────────── */}
        {stepName() === "Basic Info" && (
          <View>
            <Text style={styles.stepTitle}>Basic Information</Text>
            {category === "apartment" && (
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>Your apartment will go live automatically once all required fields are filled and at least 3 photos are uploaded. No admin review needed.</Text>
              </View>
            )}
            {category === "car" && (
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>Your car rental will go live automatically once all required fields are filled and at least 1 photo is uploaded. No admin review needed.</Text>
              </View>
            )}
            <FormField
              label={category === "car" ? "Listing title *" : "Property name *"}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              placeholder={
                category === "apartment"
                  ? "e.g. Cosy 2-bed in Westlands"
                  : category === "car"
                  ? "e.g. Toyota Land Cruiser 2022 – Nairobi"
                  : "e.g. Grand Nairobi Hotel"
              }
              maxLength={200}
            />

            {category === "hotel" && (
              <>
                <Text style={styles.fieldLabel}>Room type *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {ROOM_TYPES.map((rt) => (
                    <TouchableOpacity
                      key={rt}
                      style={[styles.chip, form.roomType === rt && styles.chipSelected]}
                      onPress={() => setForm((f) => ({ ...f, roomType: rt }))}
                    >
                      <Text style={[styles.chipText, form.roomType === rt && styles.chipTextSelected]}>{ROOM_TYPE_LABELS[rt]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <FormField label="Number of units *" value={form.unitCount} onChangeText={(t) => setForm((f) => ({ ...f, unitCount: t.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="e.g. 45" />
                <FormField label="Self-assessed star rating" value={form.claimedStarRating} onChangeText={(t) => setForm((f) => ({ ...f, claimedStarRating: t.replace(/\D/g, "").slice(0, 1) }))} keyboardType="numeric" placeholder="1–5 (optional)" />
              </>
            )}

            <FormField
              label={`Description (${form.description.length}/1000)`}
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t.slice(0, 1000) }))}
              placeholder={category === "car" ? "Describe your vehicle…" : "Describe your property…"}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
          </View>
        )}

        {/* ── Step: Location (all categories) ───────────────────────────── */}
        {stepName() === "Location" && (
          <View>
            <Text style={styles.stepTitle}>Location</Text>
            <Text style={styles.hint}>
              {category === "car"
                ? "Enter the pick-up address and tap \"Find Location\" to get coordinates."
                : "Enter your property address and tap \"Find Location\" to get coordinates."}
            </Text>
            <FormField
              label={category === "car" ? "Pick-up address *" : "Address *"}
              value={form.address}
              onChangeText={(t) => setForm((f) => ({ ...f, address: t }))}
              placeholder="e.g. Upper Hill, Nairobi"
            />
            <TouchableOpacity style={styles.geocodeBtn} onPress={handleGeocode} disabled={geocoding}>
              {geocoding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.geocodeBtnText}>Find Location</Text>}
            </TouchableOpacity>
            {form.lat && form.lng ? (
              <Text style={styles.geocodeResult}>✓ Coordinates: {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}</Text>
            ) : null}
            <FormField label="Town / City" value={form.town} onChangeText={(t) => setForm((f) => ({ ...f, town: t }))} placeholder="e.g. Nairobi" />
            <FormField label="Country (2-letter code)" value={form.country} onChangeText={(t) => setForm((f) => ({ ...f, country: t.toUpperCase().slice(0, 2) }))} placeholder="e.g. KE" autoCapitalize="characters" maxLength={2} />
            <FormField label="Latitude (manual override)" value={form.lat} onChangeText={(t) => setForm((f) => ({ ...f, lat: t }))} keyboardType="decimal-pad" placeholder="e.g. -1.286389" />
            <FormField label="Longitude (manual override)" value={form.lng} onChangeText={(t) => setForm((f) => ({ ...f, lng: t }))} keyboardType="decimal-pad" placeholder="e.g. 36.817223" />
          </View>
        )}

        {/* ── Step: Property Details (apartment only) ────────────────────── */}
        {stepName() === "Property" && (
          <View>
            <Text style={styles.stepTitle}>Property Details</Text>
            <Stepper
              label="Bedrooms"
              value={form.bedrooms}
              min={0}
              onChange={(v) => setForm((f) => ({ ...f, bedrooms: v }))}
              hint={form.bedrooms === 0 ? "0 bedrooms = Studio apartment" : undefined}
            />
            <Stepper
              label="Bathrooms"
              value={form.bathrooms}
              min={0}
              onChange={(v) => setForm((f) => ({ ...f, bathrooms: v }))}
            />
            <Stepper
              label="Max guests *"
              value={form.maxGuests}
              min={1}
              onChange={(v) => setForm((f) => ({ ...f, maxGuests: v }))}
            />
          </View>
        )}

        {/* ── Step: Vehicle Details (car only) ──────────────────────────── */}
        {stepName() === "Vehicle" && (
          <View>
            <Text style={styles.stepTitle}>Vehicle Details</Text>

            <FormField
              label="Car make *"
              value={form.carMake}
              onChangeText={(t) => setForm((f) => ({ ...f, carMake: t }))}
              placeholder="e.g. Toyota"
            />
            <FormField
              label="Car model *"
              value={form.carModel}
              onChangeText={(t) => setForm((f) => ({ ...f, carModel: t }))}
              placeholder="e.g. Land Cruiser"
            />
            <FormField
              label="Year of manufacture *"
              value={form.carYear}
              onChangeText={(t) => setForm((f) => ({ ...f, carYear: t.replace(/\D/g, "").slice(0, 4) }))}
              keyboardType="numeric"
              placeholder="e.g. 2022"
              maxLength={4}
            />

            <Text style={styles.fieldLabel}>Body type *</Text>
            <View style={styles.chipWrap}>
              {BODY_TYPES.map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[styles.chip, form.bodyType === bt && styles.chipSelected]}
                  onPress={() => setForm((f) => ({ ...f, bodyType: bt }))}
                >
                  <Text style={[styles.chipText, form.bodyType === bt && styles.chipTextSelected]}>{BODY_TYPE_LABELS[bt]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Transmission *</Text>
            <View style={styles.chipWrap}>
              {TRANSMISSION_OPTIONS.map((tr) => (
                <TouchableOpacity
                  key={tr}
                  style={[styles.chip, form.transmission === tr && styles.chipSelected]}
                  onPress={() => setForm((f) => ({ ...f, transmission: tr }))}
                >
                  <Text style={[styles.chipText, form.transmission === tr && styles.chipTextSelected]}>{TRANSMISSION_LABELS[tr]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Fuel type *</Text>
            <View style={styles.chipWrap}>
              {FUEL_TYPES.map((ft) => (
                <TouchableOpacity
                  key={ft}
                  style={[styles.chip, form.fuelType === ft && styles.chipSelected]}
                  onPress={() => setForm((f) => ({ ...f, fuelType: ft }))}
                >
                  <Text style={[styles.chipText, form.fuelType === ft && styles.chipTextSelected]}>{FUEL_TYPE_LABELS[ft]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Stepper
              label="Number of seats *"
              value={form.seats}
              min={1}
              max={15}
              onChange={(v) => setForm((f) => ({ ...f, seats: v }))}
            />

            <Text style={styles.fieldLabel}>Mileage policy *</Text>
            {[
              { value: "unlimited", label: "Unlimited" },
              { value: "limited", label: "Limited (per day)" },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radioRow, form.mileagePolicy === opt.value && styles.radioRowSelected]}
                onPress={() => setForm((f) => ({ ...f, mileagePolicy: opt.value }))}
              >
                <View style={[styles.radio, form.mileagePolicy === opt.value && styles.radioSelected]} />
                <Text style={styles.radioLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            {form.mileagePolicy === "limited" && (
              <FormField
                label="Mileage limit (km/day) *"
                value={form.mileageLimitKm}
                onChangeText={(t) => setForm((f) => ({ ...f, mileageLimitKm: t.replace(/\D/g, "") }))}
                keyboardType="numeric"
                placeholder="e.g. 200"
              />
            )}

            <View style={styles.licencePlateSection}>
              <FormField
                label="Licence plate (optional)"
                value={form.licencePlate}
                onChangeText={(t) => setForm((f) => ({ ...f, licencePlate: t.toUpperCase() }))}
                placeholder="e.g. KAA 123A"
                autoCapitalize="characters"
              />
              <Text style={styles.licencePlateNote}>Guests see this only after booking confirmation.</Text>
            </View>
          </View>
        )}

        {/* ── Step: Pricing (hotel) / Pricing & Policies (apartment/car) ── */}
        {stepName() === "Pricing" && (
          <View>
            <Text style={styles.stepTitle}>Pricing & Policies</Text>
            <FormField
              label={category === "car" ? "Daily rate (price per day) *" : "Price per night *"}
              value={form.pricePerNight}
              onChangeText={(t) => setForm((f) => ({ ...f, pricePerNight: t }))}
              keyboardType="decimal-pad"
              placeholder="e.g. 120.00"
            />
            <FormField label="Currency (ISO 4217) *" value={form.currency} onChangeText={(t) => setForm((f) => ({ ...f, currency: t.toUpperCase().slice(0, 3) }))} autoCapitalize="characters" maxLength={3} placeholder="USD" />

            {category !== "car" && (
              <>
                <FormField label="Minimum stay (nights)" value={form.minStayNights} onChangeText={(t) => setForm((f) => ({ ...f, minStayNights: t.replace(/\D/g, "") || "1" }))} keyboardType="numeric" placeholder="1" />
                <FormField label="Check-in time (HH:MM)" value={form.checkinTime} onChangeText={(t) => setForm((f) => ({ ...f, checkinTime: t }))} placeholder="e.g. 14:00" />
                <FormField label="Check-out time (HH:MM)" value={form.checkoutTime} onChangeText={(t) => setForm((f) => ({ ...f, checkoutTime: t }))} placeholder="e.g. 11:00" />
              </>
            )}

            <Text style={styles.fieldLabel}>Cancellation policy *</Text>
            {["flexible", "moderate", "strict"].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.radioRow, form.cancellationPolicy === p && styles.radioRowSelected]}
                onPress={() => setForm((f) => ({ ...f, cancellationPolicy: p }))}
              >
                <View style={[styles.radio, form.cancellationPolicy === p && styles.radioSelected]} />
                <Text style={styles.radioLabel}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Smoking allowed</Text>
              <Switch value={form.smokingAllowed} onValueChange={(v) => setForm((f) => ({ ...f, smokingAllowed: v }))} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Pets allowed</Text>
              <Switch value={form.petsAllowed} onValueChange={(v) => setForm((f) => ({ ...f, petsAllowed: v }))} />
            </View>

            {/* Car-specific pricing fields */}
            {category === "car" && (
              <View style={styles.carPricingSection}>
                <FormField
                  label="Minimum driver age *"
                  value={form.minDriverAge}
                  onChangeText={(t) => setForm((f) => ({ ...f, minDriverAge: t.replace(/\D/g, "") }))}
                  keyboardType="numeric"
                  placeholder="e.g. 21"
                />

                <View style={styles.toggleRow}>
                  <Text style={styles.fieldLabel}>Delivery available</Text>
                  <Switch value={form.deliveryAvailable} onValueChange={(v) => setForm((f) => ({ ...f, deliveryAvailable: v }))} />
                </View>

                {form.deliveryAvailable && (
                  <View style={styles.deliveryConfig}>
                    <FormField
                      label="Delivery fee *"
                      value={form.deliveryFee}
                      onChangeText={(t) => setForm((f) => ({ ...f, deliveryFee: t }))}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 15.00"
                    />
                    <FormField
                      label="Delivery radius (km) *"
                      value={form.deliveryRadiusKm}
                      onChangeText={(t) => setForm((f) => ({ ...f, deliveryRadiusKm: t.replace(/\D/g, "") }))}
                      keyboardType="numeric"
                      placeholder="e.g. 30"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Long-stay discount — apartments only */}
            {category === "apartment" && (
              <View style={styles.longStaySection}>
                <View style={styles.toggleRow}>
                  <Text style={styles.fieldLabel}>Long-stay discount</Text>
                  <Switch value={form.longStayEnabled} onValueChange={(v) => setForm((f) => ({ ...f, longStayEnabled: v }))} />
                </View>
                {form.longStayEnabled && (
                  <View style={styles.longStayConfig}>
                    <FormField
                      label="Minimum nights threshold *"
                      value={form.longStayMinNights}
                      onChangeText={(t) => setForm((f) => ({ ...f, longStayMinNights: t.replace(/\D/g, "") }))}
                      keyboardType="numeric"
                      placeholder="e.g. 7"
                    />
                    <Text style={styles.fieldLabel}>Discount type *</Text>
                    <View style={styles.discountTypeRow}>
                      {(["percentage", "fixed"] as const).map((dt) => (
                        <TouchableOpacity
                          key={dt}
                          style={[styles.discountTypeBtn, form.longStayDiscountType === dt && styles.discountTypeBtnSelected]}
                          onPress={() => setForm((f) => ({ ...f, longStayDiscountType: dt }))}
                        >
                          <Text style={[styles.discountTypeBtnText, form.longStayDiscountType === dt && styles.discountTypeBtnTextSelected]}>
                            {dt === "percentage" ? "Percentage (%)" : "Fixed amount"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <FormField
                      label={`Discount value * ${form.longStayDiscountType === "percentage" ? "(%)" : "(amount)"}`}
                      value={form.longStayDiscountValue}
                      onChangeText={(t) => setForm((f) => ({ ...f, longStayDiscountValue: t }))}
                      keyboardType="decimal-pad"
                      placeholder={form.longStayDiscountType === "percentage" ? "e.g. 15" : "e.g. 50"}
                    />
                    {form.longStayMinNights && form.longStayDiscountValue ? (
                      <Text style={styles.longStayPreview}>
                        Preview: Guests who book {form.longStayMinNights}+ nights save {form.longStayDiscountValue}{form.longStayDiscountType === "percentage" ? "%" : ` ${form.currency}`} on the total.
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Step: Amenities (all categories) ──────────────────────────── */}
        {stepName() === "Amenities" && (
          <View>
            <Text style={styles.stepTitle}>Services & Amenities</Text>
            <Text style={styles.hint}>{form.amenities.length} selected</Text>
            <View style={styles.amenityGrid}>
              {AMENITY_OPTIONS.map((a) => {
                const selected = form.amenities.includes(a.key);
                return (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.amenityChip, selected && styles.amenityChipSelected]}
                    onPress={() => setForm((f) => ({
                      ...f,
                      amenities: selected ? f.amenities.filter((k) => k !== a.key) : [...f.amenities, a.key],
                    }))}
                  >
                    <Text style={[styles.amenityChipText, selected && styles.amenityChipTextSelected]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>Custom amenity</Text>
            <View style={styles.customAmenityRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={customAmenityInput}
                onChangeText={(t) => setCustomAmenityInput(t.slice(0, 60))}
                placeholder="e.g. Rooftop bar"
                maxLength={60}
              />
              <TouchableOpacity
                style={styles.addChipBtn}
                onPress={() => {
                  const label = customAmenityInput.trim();
                  if (!label || form.customAmenities.includes(label)) return;
                  setForm((f) => ({ ...f, customAmenities: [...f.customAmenities, label] }));
                  setCustomAmenityInput("");
                }}
              >
                <Text style={{ color: "#1a73e8", fontWeight: "600" }}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.customChipList}>
              {form.customAmenities.map((a) => (
                <View key={a} style={styles.customChip}>
                  <Text style={styles.customChipText}>{a}</Text>
                  <TouchableOpacity onPress={() => setForm((f) => ({ ...f, customAmenities: f.customAmenities.filter((x) => x !== a) }))}>
                    <Text style={{ color: "#6b7280", marginLeft: 4 }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Step: Photos (all categories) ─────────────────────────────── */}
        {stepName() === "Photos" && (
          <View>
            <Text style={styles.stepTitle}>Photos</Text>
            <Text style={styles.hint}>
              {category === "apartment"
                ? "Upload at least 3 photos to activate your listing. Up to 30. First photo is your cover. JPEG, PNG, or WEBP. Max 5 MB each."
                : category === "car"
                ? "Upload at least 1 photo to activate your listing. Up to 30. First photo is your cover image. JPEG, PNG, or WEBP. Max 5 MB each."
                : "Up to 30 photos. First photo is your cover image. JPEG, PNG, or WEBP. Max 5 MB each."}
            </Text>

            {category === "apartment" && (
              <View style={[styles.photoCounter, photos.length >= 3 && styles.photoCounterDone]}>
                <Text style={[styles.photoCounterText, photos.length >= 3 && styles.photoCounterTextDone]}>
                  {photos.length} / 3 minimum {photos.length >= 3 ? "✓" : ""}
                </Text>
              </View>
            )}

            {category === "car" && (
              <View style={[styles.photoCounter, photos.length >= 1 && styles.photoCounterDone]}>
                <Text style={[styles.photoCounterText, photos.length >= 1 && styles.photoCounterTextDone]}>
                  {photos.length} / 1 minimum {photos.length >= 1 ? "✓" : ""}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUploadPhoto} disabled={uploadingPhoto}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color="#1a73e8" />
                : <Text style={styles.uploadBtnText}>+ Add photos ({photos.length}/30)</Text>}
            </TouchableOpacity>

            <View style={styles.photoGrid}>
              {photos.map((p, i) => (
                <View key={p.id} style={styles.photoItem}>
                  {i === 0 && <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>Cover</Text></View>}
                  <Text style={styles.photoUrl} numberOfLines={1}>{p.cdnUrl.split("/").pop()}</Text>
                  <TouchableOpacity onPress={() => deletePhoto(p.id)}>
                    <Text style={styles.deletePhoto}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Step: Documents (hotel only) ──────────────────────────────── */}
        {stepName() === "Documents" && (
          <View>
            <Text style={styles.stepTitle}>Accreditation Documents</Text>
            <Text style={styles.hint}>All 3 documents are required to submit for review. PDF, JPEG, PNG, or WEBP. Max 10 MB each.</Text>
            {DOC_TYPES.map((doc) => {
              const uploaded = documents.find((d) => d.documentType === doc.key);
              const isUploading = uploadingDoc === doc.key;
              return (
                <View key={doc.key} style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{doc.label}</Text>
                    {uploaded ? <Text style={styles.docUploaded}>✓ Uploaded</Text> : <Text style={styles.docMissing}>Not uploaded</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.docUploadBtn}
                    onPress={() => pickAndUploadDocument(doc.key, doc.label)}
                    disabled={isUploading}
                  >
                    {isUploading
                      ? <ActivityIndicator size="small" color="#1a73e8" />
                      : <Text style={styles.docUploadBtnText}>{uploaded ? "Replace" : "Upload"}</Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.navBar}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
          onPress={saveAndNext}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <Text style={styles.nextBtnText}>
              {step === STEPS.length - 1
                ? (category === "apartment" || category === "car" ? "Review & Go Live" : "Review & Submit")
                : "Save & Next"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Stepper component ─────────────────────────────────────────────────────────

function Stepper({ label, value, min = 0, max, onChange, hint }: {
  label: string; value: number; min?: number; max?: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <View style={styles.stepperGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.stepperHint}>{hint}</Text>}
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={[styles.stepperBtn, value <= min && styles.stepperBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepperBtn, max !== undefined && value >= max && styles.stepperBtnDisabled]}
          onPress={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
          disabled={max !== undefined && value >= max}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── FormField component ───────────────────────────────────────────────────────

function FormField({ label, style, ...props }: { label: string; style?: object } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, style]} {...props} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  stepBar: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", justifyContent: "space-between" },
  stepItem: { alignItems: "center", flex: 1 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#d1d5db", marginBottom: 4 },
  stepDotActive: { backgroundColor: "#1a73e8", width: 10, height: 10, borderRadius: 5 },
  stepDotDone: { backgroundColor: "#16a34a" },
  stepLabel: { fontSize: 9, color: "#9ca3af", textAlign: "center" },
  stepLabelActive: { color: "#1a73e8", fontWeight: "600" },
  scroll: { padding: 16, paddingBottom: 32 },
  stepTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 16 },
  hint: { fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 18 },
  infoBanner: { backgroundColor: "#eff6ff", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#bfdbfe" },
  infoBannerText: { fontSize: 13, color: "#1d4ed8", lineHeight: 18 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: "#fff" },
  textArea: { height: 100, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", marginBottom: 16 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, backgroundColor: "#fff" },
  chipSelected: { backgroundColor: "#1a73e8", borderColor: "#1a73e8" },
  chipText: { fontSize: 13, color: "#374151" },
  chipTextSelected: { color: "#fff" },
  geocodeBtn: { backgroundColor: "#1a73e8", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginBottom: 8 },
  geocodeBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  geocodeResult: { fontSize: 13, color: "#16a34a", marginBottom: 12 },
  radioRow: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, marginBottom: 8, backgroundColor: "#fff" },
  radioRowSelected: { borderColor: "#1a73e8", backgroundColor: "#eff6ff" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#d1d5db", marginRight: 10 },
  radioSelected: { borderColor: "#1a73e8", backgroundColor: "#1a73e8" },
  radioLabel: { fontSize: 14, color: "#374151", textTransform: "capitalize" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  longStaySection: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 16 },
  longStayConfig: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, marginTop: 12, gap: 4 },
  longStayPreview: { fontSize: 13, color: "#059669", backgroundColor: "#ecfdf5", borderRadius: 8, padding: 10, marginTop: 4 },
  discountTypeRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  discountTypeBtn: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: "#fff" },
  discountTypeBtnSelected: { borderColor: "#1a73e8", backgroundColor: "#eff6ff" },
  discountTypeBtnText: { fontSize: 13, color: "#374151" },
  discountTypeBtnTextSelected: { color: "#1a73e8", fontWeight: "600" },
  carPricingSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 16 },
  deliveryConfig: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, marginTop: 12 },
  licencePlateSection: { marginTop: 8 },
  licencePlateNote: { fontSize: 12, color: "#6b7280", marginTop: 2, marginBottom: 8, fontStyle: "italic" },
  amenityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  amenityChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff" },
  amenityChipSelected: { backgroundColor: "#eff6ff", borderColor: "#1a73e8" },
  amenityChipText: { fontSize: 13, color: "#374151" },
  amenityChipTextSelected: { color: "#1a73e8", fontWeight: "500" },
  customAmenityRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  addChipBtn: { borderWidth: 1, borderColor: "#1a73e8", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center" },
  customChipList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  customChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  customChipText: { fontSize: 13, color: "#374151" },
  photoCounter: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 10, marginBottom: 12, alignItems: "center", borderWidth: 1, borderColor: "#fcd34d" },
  photoCounterDone: { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" },
  photoCounterText: { fontSize: 14, fontWeight: "600", color: "#92400e" },
  photoCounterTextDone: { color: "#065f46" },
  uploadBtn: { borderWidth: 2, borderColor: "#1a73e8", borderStyle: "dashed", borderRadius: 12, paddingVertical: 18, alignItems: "center", marginBottom: 16 },
  uploadBtnText: { color: "#1a73e8", fontWeight: "600", fontSize: 15 },
  photoGrid: { gap: 8 },
  photoItem: { backgroundColor: "#fff", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#e5e7eb", flexDirection: "row", alignItems: "center" },
  coverBadge: { backgroundColor: "#1a73e8", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 },
  coverBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  photoUrl: { flex: 1, fontSize: 12, color: "#374151" },
  deletePhoto: { color: "#dc2626", fontSize: 12, fontWeight: "500" },
  docRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 10 },
  docUploaded: { fontSize: 13, color: "#16a34a", fontWeight: "500" },
  docMissing: { fontSize: 13, color: "#9ca3af" },
  docUploadBtn: { borderWidth: 1, borderColor: "#1a73e8", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  docUploadBtnText: { color: "#1a73e8", fontWeight: "600", fontSize: 13 },
  stepperGroup: { marginBottom: 20 },
  stepperHint: { fontSize: 12, color: "#6b7280", marginBottom: 6, fontStyle: "italic" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1a73e8", alignItems: "center", justifyContent: "center" },
  stepperBtnDisabled: { backgroundColor: "#d1d5db" },
  stepperBtnText: { color: "#fff", fontSize: 22, fontWeight: "700", lineHeight: 28 },
  stepperValue: { fontSize: 24, fontWeight: "700", color: "#111827", minWidth: 40, textAlign: "center" },
  navBar: { flexDirection: "row", padding: 16, gap: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  backBtn: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  backBtnText: { fontSize: 15, fontWeight: "500", color: "#374151" },
  nextBtn: { flex: 2, backgroundColor: "#1a73e8", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
