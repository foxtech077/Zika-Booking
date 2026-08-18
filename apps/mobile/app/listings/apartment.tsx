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
  WizardHeader,
  WizardFooter,
} from "./_components";
import { LocationPicker } from "../../components/maps/LocationPicker";
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
 * Apartment/home listing wizard — mirror of the provider web app's
 * ApartmentForm. Steps, fields, validation and the payload builder are ports
 * of `apps/web/.../_forms/ApartmentForm.tsx`; only the rendering is native.
 * Every save PATCHes the FULL payload, exactly as web does.
 */

const STEPS = [
  "Property Info",
  "Pricing & Policies",
  "Property Details",
  "Amenities",
  "Media",
] as const;

const STEP_HINTS = [
  "Name, type & location",
  "Rates, times & cancellation",
  "Specs, guests & amenities",
  "Services & amenities",
  "Photos (min 3 required)",
] as const;

const CANCELLATION_POLICY_VALUES = new Set(CANCELLATION_POLICIES.map((x) => x.value));

// ── State — port of web ApartmentState ──────────────────────────────────────

type ApartmentState = {
  name: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  town: string;
  neighborhood: string;
  country: string;
  pricePerNight: string;
  currency: string;
  minStayNights: string;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  allowPreBooking: boolean;
  bedrooms: string;
  bathrooms: string;
  maxGuests: string;
  longStayEnabled: boolean;
  longStayMinNights: string;
  longStayDiscountValue: string;
  selectedAmenities: string[];
  customAmenities: string[];
};

type FormErrors = Partial<Record<keyof ApartmentState | "photos", string>>;

function initState(l: any): ApartmentState {
  return {
    name: l.name ?? "",
    description: l.description ?? "",
    address: l.address ?? "",
    lat: toNullableNumber(l.lat),
    lng: toNullableNumber(l.lng),
    town: l.town ?? "",
    neighborhood: l.neighborhood ?? "",
    country: l.country ?? "",
    pricePerNight: l.pricePerNight ? String(l.pricePerNight) : "",
    currency: l.currency ?? "USD",
    minStayNights: l.minStayNights ? String(l.minStayNights) : "1",
    checkinTime: l.checkinTime ?? "14:00",
    checkoutTime: l.checkoutTime ?? "11:00",
    cancellationPolicy: l.cancellationPolicy ?? "flexible",
    smokingAllowed: l.smokingAllowed ?? false,
    petsAllowed: l.petsAllowed ?? false,
    allowPreBooking: l.allowPreBooking ?? false,
    bedrooms: l.bedrooms != null ? String(l.bedrooms) : "",
    bathrooms: l.bathrooms != null ? String(l.bathrooms) : "",
    maxGuests: l.maxGuests != null ? String(l.maxGuests) : "",
    longStayEnabled: l.longStayEnabled ?? false,
    longStayMinNights: l.longStayMinNights != null ? String(l.longStayMinNights) : "30",
    longStayDiscountValue: l.longStayDiscountValue != null ? String(l.longStayDiscountValue) : "",
    selectedAmenities: flattenGroupedAmenities(l.amenities),
    customAmenities: (l.customAmenities ?? [])
      .map((x: any) => (typeof x === "string" ? x : (x?.label ?? "")))
      .filter(Boolean),
  };
}

// ── Payload — port of web buildPayload (full payload every save) ────────────

function buildPayload(s: ApartmentState): Record<string, unknown> {
  const p: Record<string, unknown> = {};

  p.name = s.name.trim();
  p.description = trimOrNull(s.description);
  p.address = trimOrNull(s.address);
  p.lat = toNullableNumber(s.lat);
  p.lng = toNullableNumber(s.lng);
  p.town = trimOrNull(s.town);
  p.neighborhood = trimOrNull(s.neighborhood);
  p.country = countryOrNull(s.country);

  const price = toNullableNumber(s.pricePerNight);
  if (price !== null && price > 0) p.pricePerNight = price;
  if (s.currency) p.currency = s.currency;

  const nights = toNullableInt(s.minStayNights);
  if (nights !== null && nights >= 1) p.minStayNights = nights;
  p.checkinTime = s.checkinTime || null;
  p.checkoutTime = s.checkoutTime || null;
  if (CANCELLATION_POLICY_VALUES.has(s.cancellationPolicy)) {
    p.cancellationPolicy = s.cancellationPolicy;
  }

  p.smokingAllowed = s.smokingAllowed;
  p.petsAllowed = s.petsAllowed;
  p.allowPreBooking = s.allowPreBooking;

  // apartment-specific specs
  const bedrooms = toNullableInt(s.bedrooms);
  p.bedrooms = bedrooms !== null && bedrooms >= 0 ? bedrooms : null;
  const bathrooms = toNullableInt(s.bathrooms);
  p.bathrooms = bathrooms !== null && bathrooms >= 0 ? bathrooms : null;
  const guests = toNullableInt(s.maxGuests);
  p.maxGuests = guests !== null && guests >= 1 ? guests : null;

  const lsNights = toNullableInt(s.longStayMinNights);
  const lsValue = toNullableNumber(s.longStayDiscountValue);
  const hasValidLongStay =
    s.longStayEnabled &&
    lsNights !== null &&
    lsNights >= 1 &&
    lsValue !== null &&
    lsValue > 0 &&
    lsValue <= 100;

  p.longStayEnabled = hasValidLongStay;
  p.longStayMinNights = hasValidLongStay ? lsNights : null;
  p.longStayDiscountType = hasValidLongStay ? "percentage" : null;
  p.longStayDiscountValue = hasValidLongStay ? lsValue : null;

  p.amenities = groupAmenities(s.selectedAmenities);
  p.customAmenities = s.customAmenities.map((x) => x.trim()).filter(Boolean);

  return p;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function ApartmentWizard() {
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

  const [form, setForm] = useState<ApartmentState>(() => initState({}));

  const media = useListingMedia(listingId);

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

  function set<Key extends keyof ApartmentState>(key: Key, value: ApartmentState[Key]) {
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
        if (!form.name.trim()) e.name = "Apartment name is required.";
        if (!form.address.trim()) e.address = "Address is required.";
        break;
      case 1: // Pricing & Policies
        if (!(Number(form.pricePerNight) > 0)) e.pricePerNight = "Price per night must be greater than 0.";
        if (!form.currency) e.currency = "Currency is required.";
        if (!(Number(form.minStayNights) >= 1)) e.minStayNights = "Minimum stay must be at least 1 night.";
        if (!form.checkinTime) e.checkinTime = "Check-in time is required.";
        if (!form.checkoutTime) e.checkoutTime = "Check-out time is required.";
        if (!form.cancellationPolicy) e.cancellationPolicy = "Cancellation policy is required.";
        break;
      case 2: // Property Details
        if (!(Number(form.maxGuests) >= 1)) e.maxGuests = "Maximum guests must be at least 1.";
        if (form.bedrooms !== "" && Number(form.bedrooms) < 0) e.bedrooms = "Bedrooms cannot be negative.";
        if (form.bathrooms !== "" && Number(form.bathrooms) < 0) e.bathrooms = "Bathrooms cannot be negative.";
        if (form.longStayEnabled && form.longStayMinNights !== "" && !(Number(form.longStayMinNights) >= 1))
          e.longStayMinNights = "Long-stay minimum nights must be ≥ 1.";
        if (form.longStayEnabled && form.longStayDiscountValue !== "" && !(Number(form.longStayDiscountValue) > 0))
          e.longStayDiscountValue = "Long-stay discount value must be > 0.";
        break;
      case 4: // Media
        if (media.photos.length < 3) e.photos = "At least 3 photos are required to activate your listing.";
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
      "Apartment Listing Saved",
      "Your listing has been saved. Review the requirements and activate it whenever you are ready.",
      [
        { text: "Later", onPress: () => router.replace("/(provider)/listings" as any) },
        { text: "Review & Activate", onPress: () => router.replace(`/listings/${listingId}/submit` as any) },
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
      <WizardHeader title="Apartment Listing" step={step} steps={STEPS} onBack={handleBack} />

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

          {/* ── Step 0: Property Info — name, type & location ─────────────── */}
          {step === 0 && (
            <View>
              <InfoBanner
                message="Apartments go live as soon as the requirements are met — no admin review needed."
                variant="info"
              />
              <View style={s.gap} />

              <FormField
                label="Listing Title"
                required
                value={form.name}
                onChangeText={(t) => set("name", t)}
                placeholder="e.g. Sunny 2-Bedroom in Kilimani"
                maxLength={200}
                error={errors.name}
              />

              <FormField
                label="Description"
                required
                hint={`${form.description.length}/1000 characters`}
                value={form.description}
                onChangeText={(t) => set("description", t.slice(0, 1000))}
                placeholder="Describe your home, the space, and what makes it special…"
                multiline
                numberOfLines={5}
                error={errors.description}
              />

              <SectionHeader
                title="Location"
                subtitle="Search for your building, then drag the pin to its exact entrance."
                icon="map-pin"
              />

              <LocationPicker
                label="Find your apartment"
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

              <FormField
                label="Price per Night"
                required
                value={form.pricePerNight}
                onChangeText={(t) => set("pricePerNight", t)}
                placeholder="0.00"
                keyboardType="decimal-pad"
                error={errors.pricePerNight}
              />

              <SelectField
                label="Currency"
                required
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

          {/* ── Step 2: Property Details — specs, guests & long stay ──────── */}
          {step === 2 && (
            <View>
              <SectionHeader title="Property Details" icon="layout" />

              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Bedrooms"
                    value={form.bedrooms}
                    onChangeText={(t) => set("bedrooms", t.replace(/\D/g, ""))}
                    placeholder="0"
                    keyboardType="number-pad"
                    hint={form.bedrooms === "0" ? "0 bedrooms = Studio" : undefined}
                    error={errors.bedrooms}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Bathrooms"
                    value={form.bathrooms}
                    onChangeText={(t) => set("bathrooms", t.replace(/\D/g, ""))}
                    placeholder="0"
                    keyboardType="number-pad"
                    error={errors.bathrooms}
                  />
                </View>
              </View>

              <FormField
                label="Max Guests"
                required
                value={form.maxGuests}
                onChangeText={(t) => set("maxGuests", t.replace(/\D/g, ""))}
                placeholder="e.g. 4"
                keyboardType="number-pad"
                error={errors.maxGuests}
              />

              <SectionHeader
                title="Long-Stay Discount"
                subtitle="Offer a discount for extended bookings."
                icon="percent"
              />

              <SwitchRow
                label="Enabled"
                value={form.longStayEnabled}
                onValueChange={(v) => set("longStayEnabled", v)}
              />

              {form.longStayEnabled && (
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <FormField
                      label="Min Nights"
                      value={form.longStayMinNights}
                      onChangeText={(t) => set("longStayMinNights", t.replace(/\D/g, ""))}
                      placeholder="30"
                      keyboardType="number-pad"
                      error={errors.longStayMinNights}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField
                      label="Discount (%)"
                      value={form.longStayDiscountValue}
                      onChangeText={(t) => set("longStayDiscountValue", t)}
                      placeholder="E.g., 10"
                      keyboardType="decimal-pad"
                      error={errors.longStayDiscountValue}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Step 3: Amenities ──────────────────────────────────────────── */}
          {step === 3 && (
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
          )}

          {/* ── Step 4: Media ──────────────────────────────────────────────── */}
          {step === 4 && (
            <PhotosSection
              photos={media.photos}
              uploading={media.uploadingPhoto}
              uploadProgress={media.uploadProgress ?? undefined}
              onAdd={() => media.pickAndUploadPhoto("library")}
              onCapture={() => media.pickAndUploadPhoto("camera")}
              onDelete={media.deletePhoto}
              onReorder={media.reorderPhoto}
              minPhotos={3}
              maxPhotos={30}
              error={errors.photos}
            />
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
