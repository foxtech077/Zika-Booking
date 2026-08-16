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
  BackHandler,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useKeyboard } from "../../hooks/useKeyboard";
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
import { LocationPicker } from "../../components/maps/LocationPicker";

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
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  town: string;
  country: string;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  minStayNights: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  longStayEnabled: boolean;
  longStayMinNights: string;
  longStayDiscountType: "percentage" | "fixed";
  longStayDiscountValue: string;
  amenities: Record<AmenityCategory, string[]>;
  customAmenities: string[];
};

type FormErrors = Partial<Record<keyof ApartmentForm | "photos", string>>;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ApartmentListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const isKeyboardOpen = useKeyboard();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; cdnUrl: string; position: number }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [customAmenityInput, setCustomAmenityInput] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

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
    neighborhood: "",
    lat: null,
    lng: null,
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
    const parsedAmenities = parseAmenitiesToGrouped(listing.amenities);
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
      neighborhood: listing.neighborhood ?? "",
      lat: (listing as any).lat ?? null,
      lng: (listing as any).lng ?? null,
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
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
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
    if (errors.country) setErrors((e) => ({ ...e, country: undefined }));
  }

  // ── Step validation ────────────────────────────────────────────────────────

  function validateStep(s: number): boolean {
    const e: FormErrors = {};
    switch (s) {
      case 0:
        if (!form.name.trim()) e.name = "Apartment name is required.";
        if (!form.country) e.country = "Country is required.";
        if (!form.pricePerNight.trim() || parseFloat(form.pricePerNight) <= 0)
          e.pricePerNight = "Price per night is required.";
        if (!form.description.trim()) e.description = "Description is required.";
        if (!form.maxGuests.trim() || parseInt(form.maxGuests, 10) < 1)
          e.maxGuests = "Maximum guests must be at least 1.";
        break;
      case 1:
        if (!form.address.trim()) e.address = "Street address is required.";
        if (!form.town.trim()) e.town = "Town / city is required.";
        break;
      case 2:
        if (!form.checkinTime.trim()) e.checkinTime = "Check-in time is required.";
        if (!form.checkoutTime.trim()) e.checkoutTime = "Check-out time is required.";
        if (!form.cancellationPolicy) e.cancellationPolicy = "Cancellation policy is required.";
        if (form.longStayEnabled) {
          if (!form.longStayMinNights.trim() || parseInt(form.longStayMinNights, 10) < 2)
            e.longStayMinNights = "Minimum nights threshold must be at least 2.";
          if (!form.longStayDiscountValue.trim() || parseFloat(form.longStayDiscountValue) <= 0)
            e.longStayDiscountValue = "Discount value is required.";
        }
        break;
      case 4:
        if (photos.length < 3) e.photos = "At least 3 photos are required to activate your listing.";
        break;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function buildStepPayload(currentStep: number): Record<string, unknown> {
    switch (currentStep) {
      case 0:
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
      case 1:
        return {
          address: form.address,
          town: form.town,
          neighborhood: form.neighborhood || null,
          lat: form.lat,
          lng: form.lng,
        };
      case 2:
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
      case 3:
        return {
          amenities: toAmenitiesPayload(form.amenities),
          customAmenities: form.customAmenities,
        };
      case 4:
      default:
        return {};
    }
  }

  async function handleNext() {
    if (!validateStep(step)) return;
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
      "Your apartment listing has been saved. Would you like to go to the activation screen to publish it now?",
      [
        { text: "Later", onPress: () => router.replace("/(provider)/listings" as any) },
        { text: "Go Live", onPress: () => router.replace(`/listings/${id}/submit` as any) },
      ]
    );
  }

  function handleExitWizard() {
    Alert.alert(
      "Discard listing changes?",
      "You can save this listing as a draft or discard it completely.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Save Draft", 
          onPress: () => {
            qc.invalidateQueries({ queryKey: ["myListings"] });
            router.replace("/(provider)/listings" as any);
          } 
        },
        { 
          text: "Discard", 
          style: "destructive", 
          onPress: async () => {
            if (!id) {
              router.replace("/(provider)/listings" as any);
              return;
            }
            setSaving(true);
            try {
              await listingApi.delete(`/listings/${id}`);
              qc.invalidateQueries({ queryKey: ["myListings"] });
              router.replace("/(provider)/listings" as any);
            } catch {
              Alert.alert("Error", "Could not delete the draft. Please try again.");
            } finally {
              setSaving(false);
            }
          } 
        },
      ]
    );
  }

  useEffect(() => {
    const onBackPress = () => {
      if (step > 0) {
        setStep((s) => s - 1);
        return true;
      }
      handleExitWizard();
      return true;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [step, id]);

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
    else handleExitWizard();
  }

  async function pickAndUploadPhoto(source: "library" | "camera" = "library") {
    if (photos.length >= 30) {
      Alert.alert("Limit Reached", "Maximum 30 photos allowed.");
      return;
    }
    setUploadingPhoto(true);
    try {
      let result;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Camera Permission Needed", "Please allow camera access to take a photo.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"] as any, quality: 0.85 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"] as any,
          quality: 0.85,
          allowsMultipleSelection: true,
          selectionLimit: 30 - photos.length,
        });
      }
      if (result.canceled) return;
      const total = result.assets.length;
      for (let i = 0; i < total; i++) {
        const asset = result.assets[i];
        setUploadProgress({ current: i + 1, total });
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
      if (errors.photos) setErrors((e) => ({ ...e, photos: undefined }));
    } catch {
      Alert.alert("Upload Failed", "Some photos could not be uploaded. Already uploaded photos have been saved.");
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(null);
    }
  }

  async function deletePhoto(photoId: string) {
    try {
      await listingApi.delete(`/listings/${id}/photos/${photoId}`);
      setPhotos((p) => p.filter((ph) => ph.id !== photoId));
    } catch {
      Alert.alert("Error", "Could not delete this photo. Please try again.");
    }
  }

  async function reorderPhoto(photoId: string, direction: "up" | "down") {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= photos.length) return;
    const reordered = [...photos];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx]!, reordered[idx]!];
    setPhotos(reordered);
    try {
      await listingApi.patch(`/listings/${id}/photos/reorder`, {
        orderedIds: reordered.map((p) => p.id),
      });
    } catch {
      setPhotos(photos);
      Alert.alert("Error", "Could not reorder photos. Please try again.");
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
        title="Home Listing"
        step={step}
        steps={STEPS}
        onBack={handleBack}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : isKeyboardOpen
              ? "height"
              : undefined
        }
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
              message="Homes auto-activate once all required fields are complete and at least 3 photos are uploaded. No admin review needed."
              variant="success"
            />
            <View style={s.gap} />

            <SectionHeader title="Home Details" icon="home" />

            <FormField
              label="Home Name"
              required
              value={form.name}
              onChangeText={(t) => set("name", t)}
              placeholder="e.g. Cosy 2-bed in Westlands"
              maxLength={200}
              error={errors.name}
            />

            <CountryPickerButton
              label="Country"
              required
              selectedCountry={selectedCountry}
              onPress={() => setCountryModalOpen(true)}
              error={errors.country}
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
              error={errors.maxGuests}
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
                  error={errors.pricePerNight}
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
              label="About this home"
              required
              hint={`${form.description.length}/1000 characters`}
              value={form.description}
              onChangeText={(t) => set("description", t.slice(0, 1000))}
              placeholder="Describe your home, neighbourhood, and what makes it special…"
              multiline
              numberOfLines={5}
              error={errors.description}
            />
          </View>
        )}

        {/* ── Step 1: Location ────────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <SectionHeader
              title="Property Location"
              subtitle="Search for your building, then drag the pin to its exact entrance."
              icon="map-pin"
            />

            <LocationPicker
              label="Find your apartment"
              value={{ lat: form.lat, lng: form.lng, address: form.address }}
              onChange={(place) => {
                setForm((p) => ({
                  ...p,
                  address: place.address || p.address,
                  town: place.town || p.town,
                  neighborhood: place.neighborhood || p.neighborhood,
                  country: place.country || p.country,
                  lat: place.lat,
                  lng: place.lng,
                }));
                setErrors((e) => ({ ...e, address: undefined }));
              }}
              onCoordinatesChange={(lat, lng) => setForm((p) => ({ ...p, lat, lng }))}
              countryHint={form.country || undefined}
              error={errors.address}
            />

            <FormField
              label="Street Address"
              required
              value={form.address}
              onChangeText={(t) => set("address", t)}
              placeholder="e.g. Kilimani Road, Apt 4B"
              error={errors.address}
            />

            <FormField
              label="Town / City"
              required
              value={form.town}
              onChangeText={(t) => set("town", t)}
              placeholder="e.g. Nairobi"
              error={errors.town}
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

            <FormField
              label="Minimum Stay (nights)"
              value={form.minStayNights}
              onChangeText={(t) => set("minStayNights", t.replace(/\D/g, ""))}
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
                  error={errors.longStayMinNights}
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
                  error={errors.longStayDiscountValue}
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
              uploadProgress={uploadProgress ?? undefined}
              onAdd={() => pickAndUploadPhoto("library")}
              onCapture={() => pickAndUploadPhoto("camera")}
              onDelete={deletePhoto}
              onReorder={reorderPhoto}
              minPhotos={3}
              maxPhotos={30}
              error={errors.photos}
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
        disabled={isLastStep && photos.length < 3}
        disabledHint={
          isLastStep && photos.length < 3
            ? `Upload at least 3 photos to activate. ${photos.length} of 3 uploaded.`
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

function parseAmenitiesToGrouped(raw: any): Record<AmenityCategory, string[]> {
  const result = emptyAmenities();
  if (!raw) return result;

  if (Array.isArray(raw)) {
    const keys = raw.map((a: any) => a?.amenityKey ?? a).filter((k): k is string => typeof k === "string");
    for (const cat of AMENITY_CATEGORIES) {
      for (const item of AMENITY_CONFIG[cat]) {
        if (keys.includes(item.key) || keys.includes(`${cat}:${item.key}`)) {
          result[cat].push(item.key);
        }
      }
    }
  } else if (typeof raw === "object") {
    for (const cat of AMENITY_CATEGORIES) {
      const vals = raw[cat];
      if (Array.isArray(vals)) {
        for (const val of vals) {
          const itemKey = typeof val === "object" ? val?.amenityKey ?? val : val;
          if (typeof itemKey === "string") {
            const cleanKey = itemKey.includes(":") ? itemKey.split(":")[1] : itemKey;
            if (AMENITY_CONFIG[cat].some((item) => item.key === cleanKey)) {
              if (!result[cat].includes(cleanKey)) {
                result[cat].push(cleanKey);
              }
            }
          }
        }
      }
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
