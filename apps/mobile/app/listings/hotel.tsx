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
import * as DocumentPicker from "expo-document-picker";
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
  ChipSelector,
  SwitchRow,
  RadioGroup,
  CountryPickerButton,
  CountryPickerModal,
  CurrencyDisplay,
  AmenitiesSection,
  PhotosSection,
  DocumentsSection,
  InfoBanner,
  WizardHeader,
  WizardFooter,
} from "./_components";

// ── Config ────────────────────────────────────────────────────────────────────

const ROOM_TYPES = [
  { key: "standard", label: "Standard" },
  { key: "superior", label: "Superior" },
  { key: "deluxe", label: "Deluxe" },
  { key: "suite", label: "Suite" },
  { key: "junior_suite", label: "Junior Suite" },
  { key: "studio", label: "Studio" },
  { key: "family_room", label: "Family Room" },
  { key: "presidential_suite", label: "Presidential" },
];

const STAR_OPTIONS = [
  { key: "1", label: "★" },
  { key: "2", label: "★★" },
  { key: "3", label: "★★★" },
  { key: "4", label: "★★★★" },
  { key: "5", label: "★★★★★" },
];

const CANCELLATION_OPTIONS = [
  { key: "flexible", label: "Flexible", desc: "Full refund up to 24 h before check-in" },
  { key: "moderate", label: "Moderate", desc: "Full refund up to 5 days before check-in" },
  { key: "strict", label: "Strict", desc: "50% refund up to 1 week before check-in" },
];

const HOTEL_DOCS = [
  { key: "business_licence", label: "Business Licence", icon: "briefcase" as const },
  { key: "operating_permit", label: "Hotel Operating Permit", icon: "file-text" as const },
  { key: "tourism_certificate", label: "Tourism Certificate", icon: "award" as const },
];

const STEPS = [
  "Basic Info",
  "Location",
  "Policies",
  "Amenities",
  "Photos",
  "Documents",
] as const;

type HotelForm = {
  name: string;
  roomType: string;
  unitCount: string;
  claimedStarRating: string;
  description: string;
  pricePerNight: string;
  currency: string;
  currencySymbol: string;
  // location — geocoding disabled; replaced with manual text fields
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
  // amenities
  amenities: Record<AmenityCategory, string[]>;
  customAmenities: string[];
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HotelListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; cdnUrl: string; position: number }>>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; documentType: string }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [customAmenityInput, setCustomAmenityInput] = useState("");

  const [form, setForm] = useState<HotelForm>({
    name: "",
    roomType: "",
    unitCount: "",
    claimedStarRating: "",
    description: "",
    pricePerNight: "",
    currency: "USD",
    currencySymbol: "$",
    address: "",
    town: "",
    country: "",
    checkinTime: "14:00",
    checkoutTime: "11:00",
    cancellationPolicy: "moderate",
    minStayNights: "1",
    smokingAllowed: false,
    petsAllowed: false,
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
      roomType: listing.roomType ?? "",
      unitCount: String(listing.unitCount ?? ""),
      claimedStarRating: String(listing.claimedStarRating ?? ""),
      description: listing.description ?? "",
      pricePerNight: String(listing.pricePerNight ?? ""),
      currency: cur.code,
      currencySymbol: cur.symbol,
      address: listing.address ?? "",
      town: listing.town ?? "",
      country: listing.country ?? "",
      checkinTime: listing.checkinTime ?? "14:00",
      checkoutTime: listing.checkoutTime ?? "11:00",
      cancellationPolicy: listing.cancellationPolicy ?? "moderate",
      minStayNights: String(listing.minStayNights ?? "1"),
      smokingAllowed: listing.smokingAllowed ?? false,
      petsAllowed: listing.petsAllowed ?? false,
      amenities: parsedAmenities,
      customAmenities: Array.isArray(listing.customAmenities)
        ? listing.customAmenities.map((a: any) => a.label ?? a)
        : [],
    });
    setPhotos(listing.photos ?? []);
    setDocuments(listing.documents ?? []);
  }, [listing]);

  function set<K extends keyof HotelForm>(key: K, value: HotelForm[K]) {
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

  // Only send fields that belong to the current step — prevents backend
  // validation errors from incomplete future-step data (e.g. amenities: []).
  function buildStepPayload(currentStep: number): Record<string, unknown> {
    switch (currentStep) {
      case 0: // Basic Info
        return {
          name: form.name,
          roomType: form.roomType || null,
          unitCount: parseInt(form.unitCount, 10) || null,
          claimedStarRating: parseInt(form.claimedStarRating, 10) || null,
          description: form.description,
          pricePerNight: parseFloat(form.pricePerNight) || null,
          currency: form.currency,
          country: form.country?.trim()?.toUpperCase() || null,
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
        };
      case 3: // Amenities — send as grouped object, never as empty array
        return {
          amenities: toAmenitiesPayload(form.amenities),
          customAmenities: form.customAmenities,
        };
      case 4: // Photos — uploaded via presign/confirm, no PATCH needed
      case 5: // Documents — uploaded via presign/confirm, no PATCH needed
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
      setStep((s) => s + 1);
    } catch {
      Alert.alert("Save Failed", "Could not save your changes. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Documents are uploaded via presign/confirm — no PATCH needed before submit
      await listingApi.post(`/listings/${id}/submit`);
      qc.invalidateQueries({ queryKey: ["myListings"] });
      Alert.alert(
        "Submitted for Review",
        "Your hotel listing has been submitted. Our team will review it within 24–48 hours and notify you once approved.",
        [
          {
            text: "View My Listings",
            onPress: () => router.replace("/(provider)/listings" as any),
          },
        ]
      );
    } catch {
      Alert.alert("Submission Failed", "Could not submit your listing. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

  async function pickAndUploadDocument(docType: string, docLabel: string) {
    setUploadingDoc(docType);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const contentType = asset.mimeType ?? "application/pdf";
      const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
        `/listings/${id}/documents/presign`,
        { contentType, documentType: docType }
      );
      const { uploadUrl, s3Key } = presignRes.data.data;
      await uploadToS3(uploadUrl, asset.uri, contentType);
      const confirmRes = await listingApi.post<{ data: { id: string; documentType: string } }>(
        `/listings/${id}/documents/confirm`,
        { s3Key, documentType: docType, contentType }
      );
      setDocuments((d) => [
        ...d.filter((doc) => doc.documentType !== docType),
        confirmRes.data.data,
      ]);
    } catch {
      Alert.alert("Upload Failed", `Could not upload ${docLabel}. Please try again.`);
    } finally {
      setUploadingDoc(null);
    }
  }

  const allDocsUploaded = HOTEL_DOCS.every((d) => documents.some((doc) => doc.documentType === d.key));
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
        title="Hotel Listing"
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
              message="Hotels require admin review before going live. Once approved, your listing will be visible to travellers."
              variant="info"
            />
            <View style={s.sectionGap} />

            <SectionHeader title="Hotel Details" icon="home" />

            <FormField
              label="Hotel Name"
              required
              value={form.name}
              onChangeText={(t) => set("name", t)}
              placeholder="e.g. Grand Nairobi Hotel"
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

            <ChipSelector
              label="Room Type"
              required
              options={ROOM_TYPES}
              selected={form.roomType}
              onSelect={(k) => set("roomType", k)}
              horizontal
            />

            <FormField
              label="Number of Units"
              required
              hint="Total rooms of this type available"
              value={form.unitCount}
              onChangeText={(t) => set("unitCount", t.replace(/\D/g, ""))}
              placeholder="e.g. 45"
              keyboardType="numeric"
            />

            <ChipSelector
              label="Self-Assessed Star Rating"
              hint="Your own rating — not verified"
              options={STAR_OPTIONS}
              selected={form.claimedStarRating}
              onSelect={(k) => set("claimedStarRating", k)}
              horizontal
            />

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
              </View>
            </View>

            <SectionHeader title="Description" icon="align-left" />

            <FormField
              label="About this hotel"
              required
              hint={`${form.description.length}/1000 characters`}
              value={form.description}
              onChangeText={(t) => set("description", t.slice(0, 1000))}
              placeholder="Describe your hotel, its atmosphere, unique features…"
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
              subtitle="Enter your hotel's address manually. Geocoding will be enabled in a future update."
              icon="map-pin"
            />

            <FormField
              label="Street Address"
              required
              value={form.address}
              onChangeText={(t) => set("address", t)}
              placeholder="e.g. Upper Hill Road, Plot 15"
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
                  placeholder="14:00"
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

            <View style={s.sectionGap} />
            <SectionHeader title="Cancellation Policy" icon="shield" />

            <RadioGroup
              label="Policy"
              required
              options={CANCELLATION_OPTIONS}
              selected={form.cancellationPolicy}
              onSelect={(k) => set("cancellationPolicy", k)}
            />

            <View style={s.sectionGap} />
            <SectionHeader title="House Rules" icon="list" />

            <SwitchRow
              label="Smoking Allowed"
              hint="Allow guests to smoke on premises"
              value={form.smokingAllowed}
              onValueChange={(v) => set("smokingAllowed", v)}
            />
            <SwitchRow
              label="Pets Allowed"
              hint="Allow guests to bring pets"
              value={form.petsAllowed}
              onValueChange={(v) => set("petsAllowed", v)}
            />
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
          <PhotosSection
            photos={photos}
            uploading={uploadingPhoto}
            onAdd={pickAndUploadPhoto}
            onDelete={deletePhoto}
            minPhotos={1}
            maxPhotos={30}
          />
        )}

        {/* ── Step 5: Documents ───────────────────────────────────────────── */}
        {step === 5 && (
          <DocumentsSection
            docTypes={HOTEL_DOCS}
            documents={documents}
            uploadingDoc={uploadingDoc}
            onUpload={pickAndUploadDocument}
            note="All 3 documents are required before your listing can be submitted for admin review."
          />
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <WizardFooter
        onNext={isLastStep ? handleSubmit : handleNext}
        onBack={handleBack}
        isFirst={step === 0}
        isLast={isLastStep}
        lastLabel="Submit for Review"
        loading={saving || submitting}
        disabled={isLastStep && !allDocsUploaded}
        disabledHint={
          isLastStep && !allDocsUploaded
            ? "Upload all 3 required documents to submit."
            : undefined
        }
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
  sectionGap: { height: 24 },
  priceRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  currencyBadgeWrap: { paddingBottom: 20, paddingTop: 4, alignItems: "flex-start", minWidth: 90 },
  currencyLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark, marginBottom: 8 },
  currencyNote: { fontSize: 10, color: K.colors.textMuted, marginTop: 6, fontStyle: "italic" },
  timeRow: { flexDirection: "row", gap: 12 },
});
