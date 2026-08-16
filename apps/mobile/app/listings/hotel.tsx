import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";
import { ALL_COUNTRIES, CountryData } from "../../constants/countries";
import { ALL_CURRENCIES } from "../../lib/currency";
import type { AmenityCategory } from "../../constants/amenities";
import {
  FormField,
  SectionHeader,
  InfoBanner,
  SwitchRow,
  SelectField,
  CountryPickerButton,
  CountryPickerModal,
  AmenitiesSection,
  PhotosSection,
  DocumentsSection,
  WizardHeader,
  WizardFooter,
} from "./_components";
import { LocationPicker } from "../../components/maps/LocationPicker";
import { RoomTypesSection, useRoomTypes } from "./_room-types";
import { useListingMedia } from "./_media";
import {
  CANCELLATION_POLICIES,
  groupAmenities,
  flattenGroupedAmenities,
  toNullableNumber,
  toNullableInt,
  trimOrNull,
  countryOrNull,
  apiErrorMessage,
} from "./_web-parity";

/**
 * Hotel listing wizard — mirror of the provider web app's HotelForm.
 *
 * Steps, fields, option lists, validation rules and the payload builder are
 * ports of `apps/web/.../_forms/HotelForm.tsx`; only the rendering is native.
 * Every save PATCHes the FULL payload (exactly as web does) — never a
 * per-step slice, which is how the two clients previously drifted.
 */

// ── Steps — mirror of web STEPS (label + sublabel) ──────────────────────────

const STEPS = [
  "Property Info",
  "Pricing & Policies",
  "Room Setup",
  "Media & Documents",
] as const;

const STEP_HINTS = [
  "Name, description & location",
  "Rates, times & cancellation",
  "Room type, inventory & amenities",
  "Photos & verification documents",
] as const;

const HOTEL_DOCS = [
  { key: "business_licence", label: "Business Licence", icon: "briefcase" as const },
  { key: "operating_permit", label: "Hotel Operating Permit", icon: "file-text" as const },
  { key: "tourism_certificate", label: "Tourism Certificate", icon: "award" as const },
];

// ── State — port of web HotelState ──────────────────────────────────────────

type HotelState = {
  name: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  town: string;
  neighborhood: string;
  country: string;
  // claimedStarRating intentionally omitted — ratings come from traveller reviews.
  currency: string;
  minStayNights: string;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  allowPreBooking: boolean;
  selectedAmenities: string[];
  customAmenities: string[];
};

type FormErrors = Partial<Record<keyof HotelState | "photos" | "documents" | "roomTypes", string>>;

function initState(l: any): HotelState {
  return {
    name: l.name ?? "",
    description: l.description ?? "",
    address: l.address ?? "",
    lat: l.lat ?? null,
    lng: l.lng ?? null,
    town: l.town ?? "",
    neighborhood: l.neighborhood ?? "",
    country: l.country ?? "",
    currency: l.currency ?? "USD",
    minStayNights: l.minStayNights ? String(l.minStayNights) : "1",
    checkinTime: l.checkinTime ?? "14:00",
    checkoutTime: l.checkoutTime ?? "11:00",
    cancellationPolicy: l.cancellationPolicy ?? "flexible",
    smokingAllowed: l.smokingAllowed ?? false,
    petsAllowed: l.petsAllowed ?? false,
    allowPreBooking: l.allowPreBooking ?? false,
    selectedAmenities: flattenGroupedAmenities(l.amenities),
    customAmenities: (l.customAmenities ?? [])
      .map((a: any) => (typeof a === "string" ? a : (a?.label ?? "")))
      .filter(Boolean),
  };
}

// ── Payload — port of web buildPayload (full payload every save) ────────────

function buildPayload(s: HotelState): Record<string, unknown> {
  const p: Record<string, unknown> = {};

  p.name = s.name.trim();
  p.description = trimOrNull(s.description);
  p.address = trimOrNull(s.address);
  p.lat = toNullableNumber(s.lat);
  p.lng = toNullableNumber(s.lng);
  p.town = trimOrNull(s.town);
  p.neighborhood = trimOrNull(s.neighborhood);
  p.country = countryOrNull(s.country);

  if (s.currency) p.currency = s.currency;

  const nights = toNullableInt(s.minStayNights);
  if (nights !== null && nights >= 1) p.minStayNights = nights;

  p.checkinTime = s.checkinTime || null;
  p.checkoutTime = s.checkoutTime || null;
  if (s.cancellationPolicy) p.cancellationPolicy = s.cancellationPolicy;

  p.smokingAllowed = s.smokingAllowed;
  p.petsAllowed = s.petsAllowed;
  p.allowPreBooking = s.allowPreBooking;

  p.amenities = groupAmenities(s.selectedAmenities);
  p.customAmenities = s.customAmenities
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return p;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function HotelWizard() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const listingId = String(id ?? "");
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [customAmenityInput, setCustomAmenityInput] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [isKeyboardOpen, setKeyboardOpen] = useState(false);

  const [form, setForm] = useState<HotelState>(() => initState({}));

  const media = useListingMedia(listingId);
  const { data: roomTypes = [] } = useRoomTypes(listingId);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${listingId}`);
      return res.data.data;
    },
    enabled: !!listingId,
  });

  // Hydrate once per listing load; re-hydrating on every refetch would wipe
  // unsaved edits mid-wizard.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!listing || hydratedRef.current) return;
    hydratedRef.current = true;
    setForm(initState(listing));
    setSelectedCountry(ALL_COUNTRIES.find((c) => c.code === listing.country) ?? null);
    media.seed(listing.photos ?? [], listing.documents ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Hardware back = wizard back.
  useEffect(() => {
    const onBackPress = () => {
      if (step > 0) {
        setStep((s) => s - 1);
        return true;
      }
      handleExit();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function set<Key extends keyof HotelState>(key: Key, value: HotelState[Key]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function selectCountry(c: CountryData) {
    setSelectedCountry(c);
    set("country", c.code);
  }

  // ── Validation — port of web validateStep ─────────────────────────────────

  function validateStep(idx: number): boolean {
    const e: FormErrors = {};
    switch (idx) {
      case 0: // Property Info
        if (!form.name.trim()) e.name = "Hotel name is required.";
        if (!form.address.trim()) e.address = "Address is required.";
        break;
      case 1: // Pricing & Policies
        if (!form.currency) e.currency = "Currency is required.";
        if (!(Number(form.minStayNights) >= 1)) e.minStayNights = "Minimum stay must be at least 1 night.";
        if (!form.checkinTime) e.checkinTime = "Check-in time is required.";
        if (!form.checkoutTime) e.checkoutTime = "Check-out time is required.";
        if (!form.cancellationPolicy) e.cancellationPolicy = "Cancellation policy is required.";
        break;
      case 2: // Room Setup — mirrors the backend submission rule
        if (roomTypes.length === 0)
          e.roomTypes = "At least one active room type is required before proceeding.";
        break;
      case 3: // Media & Documents
        if (media.photos.length < 1) e.photos = "At least 1 photo is required.";
        break;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Save — full payload each time, exactly as web does ───────────────────

  async function saveAll(): Promise<boolean> {
    try {
      await listingApi.patch(`/listings/${listingId}`, buildPayload(form));
      return true;
    } catch (e) {
      Alert.alert("Save Failed", apiErrorMessage(e));
      return false;
    }
  }

  async function handleNext() {
    if (!validateStep(step)) return;
    setSaving(true);
    const ok = await saveAll();
    setSaving(false);
    if (ok) setStep((s) => s + 1);
  }

  async function handleFinish() {
    if (!validateStep(step)) return;
    setSaving(true);
    const ok = await saveAll();
    setSaving(false);
    if (!ok) return;
    qc.invalidateQueries({ queryKey: ["myListings"] });
    Alert.alert(
      "Hotel Listing Saved",
      "Your hotel listing has been saved. Would you like to review the submission requirements and submit it for review now?",
      [
        { text: "Later", onPress: () => router.replace("/(provider)/listings" as any) },
        { text: "Submit Now", onPress: () => router.replace(`/listings/${listingId}/submit` as any) },
      ]
    );
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
    else handleExit();
  }

  function handleExit() {
    Alert.alert("Leave listing setup?", "Your saved steps are kept. You can continue anytime from My Listings.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => router.replace("/(provider)/listings" as any) },
    ]);
  }

  const allDocsUploaded = HOTEL_DOCS.every((d) =>
    media.documents.some((doc) => doc.documentType === d.key)
  );
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
      <WizardHeader title="Hotel Listing" step={step} steps={STEPS} onBack={handleBack} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : isKeyboardOpen ? "height" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          <Text style={s.stepHint}>{STEP_HINTS[step]}</Text>

          {/* ── Step 0: Property Info — name, description & location ──────── */}
          {step === 0 && (
            <View>
              <InfoBanner
                message="Hotels require admin review before going live. Once approved, your listing will be visible to travellers."
                variant="info"
              />
              <View style={s.gap} />

              <FormField
                label="Hotel / Property Name"
                required
                value={form.name}
                onChangeText={(t) => set("name", t)}
                placeholder="e.g. Grand Nairobi Hotel"
                maxLength={200}
                error={errors.name}
              />

              <FormField
                label="Description"
                required
                hint={`${form.description.length}/1000 characters`}
                value={form.description}
                onChangeText={(t) => set("description", t.slice(0, 1000))}
                placeholder="Describe your hotel, its atmosphere, unique features…"
                multiline
                numberOfLines={5}
                error={errors.description}
              />

              <SectionHeader
                title="Location"
                subtitle="Search for your hotel, then drag the pin to its exact entrance."
                icon="map-pin"
              />

              <LocationPicker
                label="Find your hotel"
                value={{ lat: form.lat, lng: form.lng, address: form.address }}
                onChange={(place) => {
                  setForm((f) => ({
                    ...f,
                    address: place.address || f.address,
                    town: place.town || f.town,
                    neighborhood: place.neighborhood || f.neighborhood,
                    country: place.country || f.country,
                    lat: place.lat,
                    lng: place.lng,
                  }));
                  if (place.country) {
                    setSelectedCountry(ALL_COUNTRIES.find((c) => c.code === place.country) ?? null);
                  }
                  setErrors((e) => ({ ...e, address: undefined }));
                }}
                onCoordinatesChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
                countryHint={form.country || undefined}
                error={errors.address}
              />

              <FormField
                label="Full address"
                required
                value={form.address}
                onChangeText={(t) => set("address", t)}
                placeholder="Filled in from the search — edit if needed"
                error={errors.address}
              />

              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Town / City"
                    value={form.town}
                    onChangeText={(t) => set("town", t)}
                    placeholder="Filled in from the map"
                    error={errors.town}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Neighborhood"
                    value={form.neighborhood}
                    onChangeText={(t) => set("neighborhood", t)}
                    placeholder="Neighborhood"
                    error={errors.neighborhood}
                  />
                </View>
              </View>

              <CountryPickerButton
                label="Country"
                required
                selectedCountry={selectedCountry}
                onPress={() => setCountryModalOpen(true)}
                error={errors.country}
              />
            </View>
          )}

          {/* ── Step 1: Pricing & Policies ─────────────────────────────────── */}
          {step === 1 && (
            <View>
              <SectionHeader title="Pricing" icon="tag" />

              <SelectField
                label="Listing Currency"
                required
                hint="Nightly rates are set per room type in the next step."
                options={ALL_CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.symbol}` }))}
                selected={form.currency}
                onSelect={(v) => set("currency", v)}
                error={errors.currency}
              />

              <FormField
                label="Minimum Stay (nights)"
                required
                value={form.minStayNights}
                onChangeText={(t) => set("minStayNights", t.replace(/\D/g, ""))}
                placeholder="1"
                keyboardType="number-pad"
                error={errors.minStayNights}
              />

              <SelectField
                label="Cancellation Policy"
                required
                options={CANCELLATION_POLICIES}
                selected={form.cancellationPolicy}
                onSelect={(v) => set("cancellationPolicy", v)}
                error={errors.cancellationPolicy}
              />

              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Check-in Time"
                    required
                    value={form.checkinTime}
                    onChangeText={(t) => set("checkinTime", t)}
                    placeholder="14:00"
                    error={errors.checkinTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Check-out Time"
                    required
                    value={form.checkoutTime}
                    onChangeText={(t) => set("checkoutTime", t)}
                    placeholder="11:00"
                    error={errors.checkoutTime}
                  />
                </View>
              </View>

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
              <SwitchRow
                label="Allow pre-booking messages"
                hint="Let guests message you before they book"
                value={form.allowPreBooking}
                onValueChange={(v) => set("allowPreBooking", v)}
              />
            </View>
          )}

          {/* ── Step 2: Room Setup — room types, inventory & amenities ────── */}
          {step === 2 && (
            <View>
              <RoomTypesSection
                listingId={listingId}
                currency={form.currency}
                error={errors.roomTypes}
              />

              <View style={s.gap} />

              <AmenitiesSection
                amenities={groupAmenities(form.selectedAmenities) as Record<AmenityCategory, string[]>}
                customAmenities={form.customAmenities}
                customInput={customAmenityInput}
                onToggle={(_cat, key) =>
                  setForm((f) => ({
                    ...f,
                    selectedAmenities: f.selectedAmenities.includes(key)
                      ? f.selectedAmenities.filter((k) => k !== key)
                      : [...f.selectedAmenities, key],
                  }))
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
            </View>
          )}

          {/* ── Step 3: Media & Documents ──────────────────────────────────── */}
          {step === 3 && (
            <View>
              <PhotosSection
                photos={media.photos}
                uploading={media.uploadingPhoto}
                uploadProgress={media.uploadProgress ?? undefined}
                onAdd={() => media.pickAndUploadPhoto("library")}
                onCapture={() => media.pickAndUploadPhoto("camera")}
                onDelete={media.deletePhoto}
                onReorder={media.reorderPhoto}
                minPhotos={1}
                maxPhotos={30}
                error={errors.photos}
              />

              <View style={s.gap} />

              <DocumentsSection
                docTypes={HOTEL_DOCS}
                documents={media.documents}
                uploadingDoc={media.uploadingDoc}
                onUpload={media.pickAndUploadDocument}
                onDelete={media.deleteDocument}
                note="All 3 documents are required before your listing can be submitted for admin review."
              />
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        <WizardFooter
          onNext={isLastStep ? handleFinish : handleNext}
          onBack={handleBack}
          isFirst={step === 0}
          isLast={isLastStep}
          lastLabel="Save & Finish"
          loading={saving}
          disabled={isLastStep && !allDocsUploaded}
          disabledHint={
            isLastStep && !allDocsUploaded
              ? "Upload all 3 required documents before finishing."
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: K.colors.bgApp },
  loadingText: { fontSize: 14, color: K.colors.textMuted },
  scroll: { paddingHorizontal: 18, paddingTop: 14 },
  stepHint: { fontSize: 12, color: K.colors.textMuted, marginBottom: 12 },
  row2: { flexDirection: "row", gap: 12 },
  gap: { height: 18 },
});
