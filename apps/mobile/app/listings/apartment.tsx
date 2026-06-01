import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { listingApi, uploadToS3 } from "../../lib/listing-api";
import { K } from "../../constants/theme";
import { ALL_COUNTRIES, CountryData } from "../../constants/countries";
import { getCurrencyForCountry } from "../../lib/currency";
import {
  AmenityCategory,
  AMENITY_CATEGORIES,
  AMENITY_CONFIG,
  emptyAmenities,
  toggleAmenity,
  toAmenitiesPayload,
} from "../../constants/amenities";
import {
  FormField,
  SectionHeader,
  SwitchRow,
  RadioGroup,
  CountryPickerButton,
  CountryPickerModal,
  CurrencyDisplay,
  AmenitiesSection,
  PhotosSection,
  InfoBanner,
  WizardHeader,
  WizardFooter,
} from "./_components";

// ── Config ────────────────────────────────────────────────────────────────────

const CANCELLATION_OPTIONS = [
  { key: "flexible", label: "Flexible", desc: "Full refund up to 24 h before check-in" },
  { key: "moderate", label: "Moderate", desc: "Full refund up to 5 days before check-in" },
  { key: "strict", label: "Strict", desc: "50% refund up to 1 week before check-in" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { key: "percentage", label: "Percentage (%)" },
  { key: "fixed", label: "Fixed Amount" },
];

const STEPS = [
  "Basic Info",
  "Location",
  "Policies",
  "Amenities",
  "Photos",
] as const;

type ApartmentForm = {
  name: string;
  bedrooms: string;
  bathrooms: string;
  maxGuests: string;
  pricePerNight: string;
  currency: string;
  currencySymbol: string;
  description: string;
  // location — geocoding disabled; manual text fields
  address: string;
  town: string;
  country: string;
  // policies
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  minStayNights: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  // long-stay discount
  longStayEnabled: boolean;
  longStayMinNights: string;
  longStayDiscountType: "percentage" | "fixed";
  longStayDiscountValue: string;
  // amenities
  amenities: Record<AmenityCategory, string[]>;
  customAmenities: string[];
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ApartmentListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; cdnUrl: string; position: number }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [customAmenityInput, setCustomAmenityInput] = useState("");

  const [form, setForm] = useState<ApartmentForm>({
    name: "",
    bedrooms: "1",
    bathrooms: "1",
    maxGuests: "2",
    pricePerNight: "",
    currency: "USD",
    currencySymbol: "$",
    description: "",
    address: "",
    town: "",
    country: "",
    checkinTime: "15:00",
    checkoutTime: "11:00",
    cancellationPolicy: "moderate",
    minStayNights: "1",
    smokingAllowed: false,
    petsAllowed: false,
    longStayEnabled: false,
    longStayMinNights: "7",
    longStayDiscountType: "percentage",
    longStayDiscountValue: "",
    amenities: emptyAmenities(),
    customAmenities: [],
  });

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!listing) return;
    const cur = getCurrencyForCountry(listing.country);
    const cData = ALL_COUNTRIES.find((c) => c.code === listing.country) ?? null;
    setSelectedCountry(cData);
    const parsedAmenities = parseAmenitiesToGrouped(
      Array.isArray(listing.amenities) ? listing.amenities : []
    );
    setForm({
      name: listing.name ?? "",
      bedrooms: String(listing.bedrooms ?? 1),
      bathrooms: String(listing.bathrooms ?? 1),
      maxGuests: String(listing.maxGuests ?? 2),
      pricePerNight: String(listing.pricePerNight ?? ""),
      currency: cur.code,
      currencySymbol: cur.symbol,
      description: listing.description ?? "",
      address: listing.address ?? "",
      town: listing.town ?? "",
      country: listing.country ?? "",
      checkinTime: listing.checkinTime ?? "15:00",
      checkoutTime: listing.checkoutTime ?? "11:00",
      cancellationPolicy: listing.cancellationPolicy ?? "moderate",
      minStayNights: String(listing.minStayNights ?? "1"),
      smokingAllowed: listing.smokingAllowed ?? false,
      petsAllowed: listing.petsAllowed ?? false,
      longStayEnabled: listing.longStayEnabled ?? false,
      longStayMinNights: String(listing.longStayMinNights ?? "7"),
      longStayDiscountType: listing.longStayDiscountType ?? "percentage",
      longStayDiscountValue: String(listing.longStayDiscountValue ?? ""),
      amenities: parsedAmenities,
      customAmenities: Array.isArray(listing.customAmenities)
        ? listing.customAmenities.map((a: any) => a.label ?? a)
        : [],
    });
    setPhotos(listing.photos ?? []);
  }, [listing]);

  function set<K extends keyof ApartmentForm>(key: K, value: ApartmentForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function selectCountry(c: CountryData) {
    const cur = getCurrencyForCountry(c.code);
    setSelectedCountry(c);
    setForm((f) => ({
      ...f,
      country: c.code,
      currency: cur.code,
      currencySymbol: cur.symbol,
    }));
  }

  function buildStepPayload(currentStep: number): Record<string, unknown> {
    switch (currentStep) {
      case 0: // Basic Info
        return {
          name: form.name,
          bedrooms: parseInt(form.bedrooms, 10) || 0,
          bathrooms: parseInt(form.bathrooms, 10) || 0,
          maxGuests: parseInt(form.maxGuests, 10) || 1,
          pricePerNight: parseFloat(form.pricePerNight) || null,
          currency: form.currency,
          country: form.country?.trim()?.toUpperCase() || null,
          description: form.description,
        };
      case 1: // Location
        return {
          address: form.address,
          town: form.town,
        };
      case 2: // Policies
        return {
          checkinTime: form.checkinTime,
          checkoutTime: form.checkoutTime,
          cancellationPolicy: form.cancellationPolicy || null,
          minStayNights: parseInt(form.minStayNights, 10) || 1,
          smokingAllowed: form.smokingAllowed,
          petsAllowed: form.petsAllowed,
          longStayEnabled: form.longStayEnabled,
          longStayMinNights: form.longStayEnabled ? parseInt(form.longStayMinNights, 10) || null : null,
          longStayDiscountType: form.longStayEnabled ? form.longStayDiscountType : null,
          longStayDiscountValue: form.longStayEnabled
            ? parseFloat(form.longStayDiscountValue) || null
            : null,
        };
      case 3: // Amenities — send as grouped object, never as empty array
        return {
          amenities: toAmenitiesPayload(form.amenities),
          customAmenities: form.customAmenities,
        };
      case 4: // Photos — uploaded via presign/confirm, no PATCH needed
      default:
        return {};
    }
  }

  async function handleNext() {
    setSaving(true);
    try {
      const payload = buildStepPayload(step);
      if (Object.keys(payload).length > 0) {
        await listingApi.patch(`/listings/${id}`, payload);
      }
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        await handleComplete();
      }
    } catch {
      Alert.alert("Save Failed", "Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    qc.invalidateQueries({ queryKey: ["myListings"] });
    Alert.alert(
      "Listing Saved",
      "Your apartment listing has been saved. It will activate automatically once all required fields are complete and at least 3 photos are uploaded.",
      [
        {
          text: "View My Listings",
          onPress: () => router.replace("/(provider)/listings" as any),
        },
      ]
    );
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  }

  async function pickAndUploadPhoto() {
    if (photos.length >= 30) {
      Alert.alert("Limit Reached", "Maximum 30 photos allowed.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: 30 - photos.length,
      });
      if (result.canceled) return;
      for (const asset of result.assets) {
        const contentType = asset.mimeType ?? "image/jpeg";
        const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
          `/listings/${id}/photos/presign`,
          { contentType, filename: asset.fileName ?? "photo.jpg" }
        );
        const { uploadUrl, s3Key } = presignRes.data.data;
        await uploadToS3(uploadUrl, asset.uri, contentType);
        const confirmRes = await listingApi.post<{ data: { id: string; cdnUrl: string; position: number } }>(
          `/listings/${id}/photos/confirm`,
          { s3Key }
        );
        setPhotos((p) => [...p, confirmRes.data.data]);
      }
    } catch {
      Alert.alert("Upload Failed", "Some photos could not be uploaded. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto(photoId: string) {
    try {
      await listingApi.delete(`/listings/${id}/photos/${photoId}`);
      setPhotos((p) => p.filter((ph) => ph.id !== photoId));
    } catch {
      Alert.alert("Error", "Could not remove this photo.");
    }
  }

  const isLastStep = step === STEPS.length - 1;

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={K.colors.accent} />
        <Text style={s.loadingText}>Loading your listing…</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <WizardHeader
        title="Apartment Listing"
        step={step}
        steps={STEPS}
        onBack={handleBack}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* ── Step 0: Basic Info ──────────────────────────────────────────── */}
        {step === 0 && (
          <View>
            <InfoBanner
              message="Apartments auto-activate once all required fields are complete and at least 3 photos are uploaded. No admin review needed."
              variant="success"
            />
            <View style={s.gap} />

            <SectionHeader title="Apartment Details" icon="home" />

            <FormField
              label="Apartment Name"
              required
              value={form.name}
              onChangeText={(t) => set("name", t)}
              placeholder="e.g. Cosy 2-bed in Westlands"
              maxLength={200}
            />

            <CountryPickerButton
              label="Country"
              required
              selectedCountry={selectedCountry}
              onPress={() => setCountryModalOpen(true)}
            />
            {selectedCountry && (
              <InfoBanner
                message={`Currency set to ${form.currency} (${form.currencySymbol}) — all prices in this listing use this currency.`}
                variant="success"
              />
            )}

            <FormField
              label="Bedrooms"
              required
              hint={form.bedrooms === "0" ? "0 bedrooms = Studio apartment" : undefined}
              value={form.bedrooms}
              onChangeText={(t) => set("bedrooms", t.replace(/\D/g, ""))}
              placeholder="e.g. 2"
              keyboardType="numeric"
            />

            <FormField
              label="Bathrooms"
              required
              value={form.bathrooms}
              onChangeText={(t) => set("bathrooms", t.replace(/\D/g, ""))}
              placeholder="e.g. 1"
              keyboardType="numeric"
            />

            <FormField
              label="Max Guests"
              required
              value={form.maxGuests}
              onChangeText={(t) => set("maxGuests", t.replace(/\D/g, ""))}
              placeholder="e.g. 4"
              keyboardType="numeric"
            />

            <View style={s.gap} />
            <SectionHeader title="Pricing" icon="tag" />

            <View style={s.priceRow}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Price Per Night"
                  required
                  value={form.pricePerNight}
                  onChangeText={(t) => set("pricePerNight", t)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={s.currencyBadgeWrap}>
                <Text style={s.currencyLabel}>Currency</Text>
                <CurrencyDisplay code={form.currency} symbol={form.currencySymbol} />
                <Text style={s.currencyNote}>Auto from country above</Text>
              </View>
            </View>

            <SectionHeader title="Description" icon="align-left" />

            <FormField
              label="About this apartment"
              required
              hint={`${form.description.length}/1000 characters`}
              value={form.description}
              onChangeText={(t) => set("description", t.slice(0, 1000))}
              placeholder="Describe your apartment, neighbourhood, and what makes it special…"
              multiline
              numberOfLines={5}
            />
          </View>
        )}

        {/* ── Step 1: Location ────────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <SectionHeader
              title="Property Location"
              subtitle="Enter your apartment's address manually. Geocoding will be enabled in a future update."
              icon="map-pin"
            />

            <FormField
              label="Street Address"
              required
              value={form.address}
              onChangeText={(t) => set("address", t)}
              placeholder="e.g. Kilimani Road, Apt 4B"
            />

            <FormField
              label="Town / City"
              required
              value={form.town}
              onChangeText={(t) => set("town", t)}
              placeholder="e.g. Nairobi"
            />
          </View>
        )}

        {/* ── Step 2: Policies ─────────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <SectionHeader title="Check-in & Check-out" icon="clock" />

            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Check-in Time"
                  required
                  value={form.checkinTime}
                  onChangeText={(t) => set("checkinTime", t)}
                  placeholder="15:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Check-out Time"
                  required
                  value={form.checkoutTime}
                  onChangeText={(t) => set("checkoutTime", t)}
                  placeholder="11:00"
                />
              </View>
            </View>

            <FormField
              label="Minimum Stay (nights)"
              value={form.minStayNights}
              onChangeText={(t) => set("minStayNights", t.replace(/\D/g, "") || "1")}
              placeholder="1"
              keyboardType="numeric"
            />

            <View style={s.gap} />
            <SectionHeader title="Cancellation Policy" icon="shield" />

            <RadioGroup
              label="Policy"
              required
              options={CANCELLATION_OPTIONS}
              selected={form.cancellationPolicy}
              onSelect={(k) => set("cancellationPolicy", k)}
            />

            <View style={s.gap} />
            <SectionHeader title="House Rules" icon="list" />

            <SwitchRow
              label="Smoking Allowed"
              value={form.smokingAllowed}
              onValueChange={(v) => set("smokingAllowed", v)}
            />
            <SwitchRow
              label="Pets Allowed"
              value={form.petsAllowed}
              onValueChange={(v) => set("petsAllowed", v)}
            />

            <View style={s.gap} />
            <SectionHeader title="Long-Stay Discount" icon="percent" />

            <SwitchRow
              label="Enable Long-Stay Discount"
              hint="Offer a discount for extended stays"
              value={form.longStayEnabled}
              onValueChange={(v) => set("longStayEnabled", v)}
            />

            {form.longStayEnabled && (
              <View style={s.longStayCard}>
                <FormField
                  label="Minimum Nights Threshold"
                  required
                  value={form.longStayMinNights}
                  onChangeText={(t) => set("longStayMinNights", t.replace(/\D/g, ""))}
                  placeholder="e.g. 7"
                  keyboardType="numeric"
                />

                <RadioGroup
                  label="Discount Type"
                  required
                  options={DISCOUNT_TYPE_OPTIONS}
                  selected={form.longStayDiscountType}
                  onSelect={(k) => set("longStayDiscountType", k as "percentage" | "fixed")}
                />

                <FormField
                  label={
                    form.longStayDiscountType === "percentage"
                      ? "Discount Value (%)"
                      : `Discount Amount (${form.currency})`
                  }
                  required
                  value={form.longStayDiscountValue}
                  onChangeText={(t) => set("longStayDiscountValue", t)}
                  placeholder={form.longStayDiscountType === "percentage" ? "e.g. 15" : "e.g. 50"}
                  keyboardType="decimal-pad"
                />

                {form.longStayMinNights && form.longStayDiscountValue ? (
                  <InfoBanner
                    message={`Guests who book ${form.longStayMinNights}+ nights save ${form.longStayDiscountValue}${form.longStayDiscountType === "percentage" ? "%" : ` ${form.currency}`} on the total price.`}
                    variant="success"
                  />
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* ── Step 3: Amenities ───────────────────────────────────────────── */}
        {step === 3 && (
          <AmenitiesSection
            amenities={form.amenities}
            customAmenities={form.customAmenities}
            customInput={customAmenityInput}
            onToggle={(cat, key) =>
              setForm((f) => ({ ...f, amenities: toggleAmenity(f.amenities, cat, key) }))
            }
            onCustomAdd={(label) => {
              if (!label || form.customAmenities.includes(label)) return;
              setForm((f) => ({ ...f, customAmenities: [...f.customAmenities, label] }));
              setCustomAmenityInput("");
            }}
            onCustomRemove={(label) =>
              setForm((f) => ({
                ...f,
                customAmenities: f.customAmenities.filter((a) => a !== label),
              }))
            }
            onCustomInputChange={setCustomAmenityInput}
          />
        )}

        {/* ── Step 4: Photos ──────────────────────────────────────────────── */}
        {step === 4 && (
          <View>
            <InfoBanner
              message="Upload at least 3 photos to auto-activate your listing. The first photo will be your cover image."
              variant="info"
            />
            <View style={s.gap} />
            <PhotosSection
              photos={photos}
              uploading={uploadingPhoto}
              onAdd={pickAndUploadPhoto}
              onDelete={deletePhoto}
              minPhotos={3}
              maxPhotos={30}
            />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <WizardFooter
        onNext={handleNext}
        onBack={handleBack}
        isFirst={step === 0}
        isLast={isLastStep}
        lastLabel="Save & Activate"
        loading={saving}
      />
      </KeyboardAvoidingView>

      <CountryPickerModal
        visible={countryModalOpen}
        selectedCode={form.country}
        onSelect={selectCountry}
        onClose={() => setCountryModalOpen(false)}
      />
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAmenitiesToGrouped(raw: any[]): Record<AmenityCategory, string[]> {
  const result = emptyAmenities();
  const keys = raw.map((a: any) => a.amenityKey ?? a);
  for (const cat of AMENITY_CATEGORIES) {
    for (const item of AMENITY_CONFIG[cat]) {
      if (keys.includes(item.key)) result[cat].push(item.key);
    }
  }
  return result;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: K.colors.bgLight },
  loadingText: { fontSize: K.font.sm, color: K.colors.textMuted },
  scroll: { padding: 20, paddingBottom: 32 },
  gap: { height: 24 },
  priceRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  currencyBadgeWrap: { paddingBottom: 20, paddingTop: 4, alignItems: "flex-start", minWidth: 90 },
  currencyLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark, marginBottom: 8 },
  currencyNote: { fontSize: 10, color: K.colors.textMuted, marginTop: 6, fontStyle: "italic" },
  timeRow: { flexDirection: "row", gap: 12 },
  longStayCard: {
    backgroundColor: "#fff",
    borderRadius: K.radius.lg,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: K.colors.border,
    gap: 4,
  },
});
