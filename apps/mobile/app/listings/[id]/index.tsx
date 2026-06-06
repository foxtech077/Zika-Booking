import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { listingApi, uploadToS3 } from "../../../lib/listing-api";
import { K } from "../../../constants/theme";
import { ALL_COUNTRIES, CountryData } from "../../../constants/countries";
import { getCurrencyForCountry } from "../../../lib/currency";
import {
  AmenityCategory,
  AMENITY_CATEGORIES,
  AMENITY_CONFIG,
  emptyAmenities,
  toggleAmenity,
  toAmenitiesPayload,
} from "../../../constants/amenities";
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
} from "../_components";

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

const CAR_DOCS = [
  { key: "insurance_certificate", label: "Insurance Certificate", icon: "shield" as const },
  { key: "roadworthiness_certificate", label: "Roadworthiness Certificate", icon: "check-circle" as const },
];

const BODY_TYPES = [
  { key: "sedan", label: "Sedan" }, { key: "suv", label: "SUV" },
  { key: "minivan", label: "Minivan" }, { key: "pickup", label: "Pickup" },
  { key: "van", label: "Van" }, { key: "convertible", label: "Convertible" },
  { key: "sports", label: "Sports" }, { key: "other", label: "Other" },
];

const TRANSMISSION_OPTIONS = [
  { key: "manual", label: "Manual" }, { key: "automatic", label: "Automatic" }, { key: "both", label: "Both" },
];

const FUEL_TYPES = [
  { key: "petrol", label: "Petrol" }, { key: "diesel", label: "Diesel" },
  { key: "electric", label: "Electric" }, { key: "hybrid", label: "Hybrid" },
];

const DRIVE_TYPES = [
  { key: "2WD", label: "2WD" }, { key: "4WD", label: "4WD" }, { key: "AWD", label: "AWD" },
];

const MILEAGE_OPTIONS = [
  { key: "unlimited", label: "Unlimited", desc: "No daily mileage limit" },
  { key: "limited", label: "Limited (per day)", desc: "Set a km/day cap" },
];

const FUEL_POLICY_OPTIONS = [
  { key: "full_to_full", label: "Full-to-Full", desc: "Return with same fuel level as pickup" },
  { key: "full_to_empty", label: "Full-to-Empty", desc: "Pre-paid full tank, return empty" },
  { key: "same_level", label: "Same Level", desc: "Return with the same level as received" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { key: "percentage", label: "Percentage (%)" },
  { key: "fixed", label: "Fixed Amount" },
];

const HOTEL_STEPS = ["Basic Info", "Location", "Policies", "Amenities", "Photos", "Documents"] as const;
const APT_STEPS = ["Basic Info", "Location", "Policies", "Amenities", "Photos"] as const;
const CAR_STEPS = ["Identity", "Technical", "Pricing", "Features", "Location", "Photos & Docs"] as const;

// ── Form shape ────────────────────────────────────────────────────────────────

type EditForm = {
  // shared
  name: string; description: string; pricePerNight: string;
  currency: string; currencySymbol: string; country: string;
  address: string; town: string;
  checkinTime: string; checkoutTime: string;
  cancellationPolicy: string; minStayNights: string;
  smokingAllowed: boolean; petsAllowed: boolean;
  amenities: Record<AmenityCategory, string[]>; customAmenities: string[];
  // hotel
  roomType: string; unitCount: string; claimedStarRating: string;
  // apartment
  bedrooms: string; bathrooms: string; maxGuests: string;
  longStayEnabled: boolean; longStayMinNights: string;
  longStayDiscountType: "percentage" | "fixed"; longStayDiscountValue: string;
  // car
  carMake: string; carModel: string; carYear: string;
  bodyType: string; colour: string; licencePlate: string;
  odometerReading: string; seats: string; doors: string;
  transmission: string; fuelType: string; driveType: string;
  engineSize: string; airConditioning: boolean;
  mileagePolicy: string; mileageLimitKm: string;
  fuelPolicy: string; securityDeposit: string;
  minDriverAge: string;
  roadsideAssistance: boolean; crossBorderAllowed: boolean;
  airportPickup: boolean; returnSameLocation: boolean;
  deliveryAvailable: boolean; deliveryRadiusKm: string; deliveryFee: string;
  pickupHours: string;
};

type FormErrors = Partial<Record<keyof EditForm | "photos" | "documents", string>>;

const DEFAULTS: EditForm = {
  name: "", description: "", pricePerNight: "",
  currency: "USD", currencySymbol: "$", country: "",
  address: "", town: "",
  checkinTime: "14:00", checkoutTime: "11:00",
  cancellationPolicy: "moderate", minStayNights: "1",
  smokingAllowed: false, petsAllowed: false,
  amenities: emptyAmenities(), customAmenities: [],
  roomType: "", unitCount: "", claimedStarRating: "",
  bedrooms: "1", bathrooms: "1", maxGuests: "2",
  longStayEnabled: false, longStayMinNights: "7",
  longStayDiscountType: "percentage", longStayDiscountValue: "",
  carMake: "", carModel: "", carYear: "",
  bodyType: "", colour: "", licencePlate: "",
  odometerReading: "", seats: "5", doors: "4",
  transmission: "", fuelType: "", driveType: "",
  engineSize: "", airConditioning: true,
  mileagePolicy: "unlimited", mileageLimitKm: "",
  fuelPolicy: "full_to_full", securityDeposit: "", minDriverAge: "21",
  roadsideAssistance: false, crossBorderAllowed: false,
  airportPickup: false, returnSameLocation: true,
  deliveryAvailable: false, deliveryRadiusKm: "", deliveryFee: "",
  pickupHours: "08:00 – 18:00",
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; cdnUrl: string; position: number }>>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; documentType: string }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [customAmenityInput, setCustomAmenityInput] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<EditForm>(DEFAULTS);

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
      description: listing.description ?? "",
      pricePerNight: String(listing.pricePerNight ?? ""),
      currency: cur.code,
      currencySymbol: cur.symbol,
      country: listing.country ?? "",
      address: listing.address ?? "",
      town: listing.town ?? "",
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
      roomType: listing.roomType ?? "",
      unitCount: listing.unitCount != null ? String(listing.unitCount) : "",
      claimedStarRating: String(listing.claimedStarRating ?? ""),
      bedrooms: String(listing.bedrooms ?? 1),
      bathrooms: String(listing.bathrooms ?? 1),
      maxGuests: String(listing.maxGuests ?? 2),
      longStayEnabled: listing.longStayEnabled ?? false,
      longStayMinNights: String(listing.longStayMinNights ?? "7"),
      longStayDiscountType: listing.longStayDiscountType ?? "percentage",
      longStayDiscountValue: String(listing.longStayDiscountValue ?? ""),
      carMake: listing.carMake ?? "",
      carModel: listing.carModel ?? "",
      carYear: String(listing.carYear ?? ""),
      bodyType: listing.bodyType ?? "",
      colour: listing.colour ?? "",
      licencePlate: listing.licencePlate ?? "",
      odometerReading: String(listing.odometerReading ?? ""),
      seats: String(listing.seats ?? 5),
      doors: String(listing.doors ?? 4),
      transmission: listing.transmission ?? "",
      fuelType: listing.fuelType ?? "",
      driveType: listing.driveType ?? "",
      engineSize: listing.engineSize ?? "",
      airConditioning: listing.airConditioning ?? true,
      mileagePolicy: listing.mileagePolicy ?? "unlimited",
      mileageLimitKm: String(listing.mileageLimitKm ?? ""),
      fuelPolicy: listing.fuelPolicy ?? "full_to_full",
      securityDeposit: String(listing.securityDeposit ?? ""),
      minDriverAge: String(listing.minDriverAge ?? "21"),
      roadsideAssistance: listing.roadsideAssistance ?? false,
      crossBorderAllowed: listing.crossBorderAllowed ?? false,
      airportPickup: listing.airportPickup ?? false,
      returnSameLocation: listing.returnSameLocation ?? true,
      deliveryAvailable: listing.deliveryAvailable ?? false,
      deliveryRadiusKm: String(listing.deliveryRadiusKm ?? ""),
      deliveryFee: String(listing.deliveryFee ?? ""),
      pickupHours: listing.pickupHours ?? "08:00 – 18:00",
    });
    setPhotos(listing.photos ?? []);
    setDocuments(listing.documents ?? []);
  }, [listing]);

  const category: "hotel" | "apartment" | "car" = listing?.category ?? "hotel";
  const STEPS = category === "apartment" ? APT_STEPS : category === "car" ? CAR_STEPS : HOTEL_STEPS;
  const isLastStep = step === STEPS.length - 1;

  function set<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function selectCountry(c: CountryData) {
    const cur = getCurrencyForCountry(c.code);
    setSelectedCountry(c);
    setForm((f) => ({ ...f, country: c.code, currency: cur.code, currencySymbol: cur.symbol }));
    if (errors.country) setErrors((e) => ({ ...e, country: undefined }));
  }

  // ── Step validation ────────────────────────────────────────────────────────

  function validateStep(s: number): boolean {
    const e: FormErrors = {};

    if (category === "hotel") {
      switch (s) {
        case 0:
          if (!form.name.trim()) e.name = "Hotel name is required.";
          if (!form.country) e.country = "Country is required.";
          if (!form.roomType) e.roomType = "Room type is required.";
          if (!form.unitCount.trim() || parseInt(form.unitCount, 10) < 1)
            e.unitCount = "Number of units is required (minimum 1).";
          if (!form.pricePerNight.trim() || parseFloat(form.pricePerNight) <= 0)
            e.pricePerNight = "Price per night is required.";
          break;
        case 1:
          if (!form.address.trim()) e.address = "Street address is required.";
          if (!form.town.trim()) e.town = "Town / city is required.";
          break;
        case 2:
          if (!form.checkinTime.trim()) e.checkinTime = "Check-in time is required.";
          if (!form.checkoutTime.trim()) e.checkoutTime = "Check-out time is required.";
          if (!form.cancellationPolicy) e.cancellationPolicy = "Cancellation policy is required.";
          break;
        case 5:
          if (!allHotelDocs) e.documents = "All 3 required documents must be uploaded before submitting.";
          break;
      }
    } else if (category === "apartment") {
      switch (s) {
        case 0:
          if (!form.name.trim()) e.name = "Apartment name is required.";
          if (!form.country) e.country = "Country is required.";
          if (!form.pricePerNight.trim() || parseFloat(form.pricePerNight) <= 0)
            e.pricePerNight = "Price per night is required.";
          break;
        case 1:
          if (!form.address.trim()) e.address = "Street address is required.";
          if (!form.town.trim()) e.town = "Town / city is required.";
          break;
        case 2:
          if (!form.cancellationPolicy) e.cancellationPolicy = "Cancellation policy is required.";
          break;
        case 4:
          if (photos.length < 3) e.photos = "At least 3 photos are required to activate your listing.";
          break;
      }
    } else {
      // car
      switch (s) {
        case 0:
          if (!form.name.trim()) e.name = "Listing title is required.";
          if (!form.country) e.country = "Country is required.";
          if (!form.carMake.trim()) e.carMake = "Make is required.";
          if (!form.carModel.trim()) e.carModel = "Model is required.";
          if (!form.carYear.trim()) e.carYear = "Year is required.";
          if (!form.unitCount.trim() || parseInt(form.unitCount, 10) < 1)
            e.unitCount = "Number of units is required (minimum 1).";
          if (!form.pricePerNight.trim() || parseFloat(form.pricePerNight) <= 0)
            e.pricePerNight = "Price per day is required.";
          break;
        case 1:
          if (!form.transmission) e.transmission = "Transmission type is required.";
          if (!form.fuelType) e.fuelType = "Fuel type is required.";
          break;
        case 4:
          if (!form.address.trim()) e.address = "Pickup address is required.";
          if (!form.town.trim()) e.town = "Town / city is required.";
          break;
        case 5:
          if (photos.length < 1) e.photos = "At least 1 photo is required.";
          break;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Step payloads ──────────────────────────────────────────────────────────

  function buildStepPayload(currentStep: number): Record<string, unknown> {
    if (category === "hotel") {
      switch (currentStep) {
        case 0: return {
          name: form.name, roomType: form.roomType || null,
          unitCount: parseInt(form.unitCount, 10) || null,
          claimedStarRating: parseInt(form.claimedStarRating, 10) || null,
          description: form.description,
          pricePerNight: parseFloat(form.pricePerNight) || null,
          currency: form.currency,
          country: form.country?.trim()?.toUpperCase() || null,
        };
        case 1: return { address: form.address, town: form.town };
        case 2: return {
          checkinTime: form.checkinTime, checkoutTime: form.checkoutTime,
          cancellationPolicy: form.cancellationPolicy || null,
          minStayNights: parseInt(form.minStayNights, 10) || 1,
          smokingAllowed: form.smokingAllowed, petsAllowed: form.petsAllowed,
        };
        case 3: return { amenities: toAmenitiesPayload(form.amenities), customAmenities: form.customAmenities };
        default: return {};
      }
    }
    if (category === "apartment") {
      switch (currentStep) {
        case 0: return {
          name: form.name,
          bedrooms: parseInt(form.bedrooms, 10) || 0,
          bathrooms: parseInt(form.bathrooms, 10) || 0,
          maxGuests: parseInt(form.maxGuests, 10) || 1,
          pricePerNight: parseFloat(form.pricePerNight) || null,
          currency: form.currency,
          country: form.country?.trim()?.toUpperCase() || null,
          description: form.description,
        };
        case 1: return { address: form.address, town: form.town };
        case 2: return {
          checkinTime: form.checkinTime, checkoutTime: form.checkoutTime,
          cancellationPolicy: form.cancellationPolicy || null,
          minStayNights: parseInt(form.minStayNights, 10) || 1,
          smokingAllowed: form.smokingAllowed, petsAllowed: form.petsAllowed,
          longStayEnabled: form.longStayEnabled,
          longStayMinNights: form.longStayEnabled ? parseInt(form.longStayMinNights, 10) || null : null,
          longStayDiscountType: form.longStayEnabled ? form.longStayDiscountType : null,
          longStayDiscountValue: form.longStayEnabled ? parseFloat(form.longStayDiscountValue) || null : null,
        };
        case 3: return { amenities: toAmenitiesPayload(form.amenities), customAmenities: form.customAmenities };
        default: return {};
      }
    }
    // car
    switch (currentStep) {
      case 0: return {
        name: form.name, carMake: form.carMake, carModel: form.carModel,
        carYear: parseInt(form.carYear, 10) || null, bodyType: form.bodyType || null,
        unitCount: parseInt(form.unitCount, 10) || null,
        colour: form.colour, licencePlate: form.licencePlate,
        odometerReading: parseInt(form.odometerReading, 10) || null,
        pricePerNight: parseFloat(form.pricePerNight) || null,
        currency: form.currency, country: form.country?.trim()?.toUpperCase() || null,
      };
      case 1: return {
        seats: parseInt(form.seats, 10) || 1, doors: parseInt(form.doors, 10) || 2,
        transmission: form.transmission || null, fuelType: form.fuelType || null,
        driveType: form.driveType || null, engineSize: form.engineSize,
        airConditioning: form.airConditioning,
      };
      case 2: return {
        securityDeposit: parseFloat(form.securityDeposit) || null,
        minStayNights: parseInt(form.minStayNights, 10) || 1,
        minDriverAge: parseInt(form.minDriverAge, 10) || null,
        mileagePolicy: form.mileagePolicy,
        mileageLimitKm: form.mileagePolicy === "limited" ? parseInt(form.mileageLimitKm, 10) || null : null,
        fuelPolicy: form.fuelPolicy || null, cancellationPolicy: form.cancellationPolicy || null,
      };
      case 3: return {
        roadsideAssistance: form.roadsideAssistance, crossBorderAllowed: form.crossBorderAllowed,
        airportPickup: form.airportPickup, returnSameLocation: form.returnSameLocation,
        deliveryAvailable: form.deliveryAvailable,
        deliveryRadiusKm: form.deliveryAvailable ? parseInt(form.deliveryRadiusKm, 10) || null : null,
        deliveryFee: form.deliveryAvailable ? parseFloat(form.deliveryFee) || null : null,
      };
      case 4: return { address: form.address, town: form.town, pickupHours: form.pickupHours };
      default: return {};
    }
  }

  async function handleNext() {
    if (!validateStep(step)) return;
    setSaving(true);
    try {
      const payload = buildStepPayload(step);
      if (Object.keys(payload).length > 0) {
        await listingApi.patch(`/listings/${id}`, payload);
        qc.invalidateQueries({ queryKey: ["listing", id] });
        qc.invalidateQueries({ queryKey: ["myListings"] });
      }
      setStep((s) => s + 1);
    } catch {
      Alert.alert("Save Failed", "Could not save your changes. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalSave() {
    if (!validateStep(step)) return;
    setSaving(true);
    try {
      const payload = buildStepPayload(step);
      if (Object.keys(payload).length > 0) {
        await listingApi.patch(`/listings/${id}`, payload);
      }
      qc.invalidateQueries({ queryKey: ["myListings"] });
      qc.invalidateQueries({ queryKey: ["listing", id] });
      Alert.alert(
        "Listing Saved",
        "Your changes have been saved. Would you like to go to the activation and submission screen now?",
        [
          { text: "Later", onPress: () => router.back() },
          { text: "Go Live / Submit", onPress: () => router.replace(`/listings/${id}/submit` as any) },
        ]
      );
    } catch {
      Alert.alert("Save Failed", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleHotelResubmit() {
    if (!validateStep(step)) return;
    setSubmitting(true);
    try {
      const payload = buildStepPayload(step);
      if (Object.keys(payload).length > 0) {
        await listingApi.patch(`/listings/${id}`, payload);
      }
      await listingApi.post(`/listings/${id}/submit`);
      qc.invalidateQueries({ queryKey: ["myListings"] });
      Alert.alert("Submitted", "Your listing has been resubmitted for admin review.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  }

  async function pickAndUploadPhoto() {
    if (photos.length >= 30) { Alert.alert("Limit Reached", "Maximum 30 photos."); return; }
    setUploadingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any, quality: 0.85,
        allowsMultipleSelection: true, selectionLimit: 30 - photos.length,
      });
      if (result.canceled) return;
      const total = result.assets.length;
      for (let i = 0; i < total; i++) {
        const asset = result.assets[i];
        setUploadProgress({ current: i + 1, total });
        const contentType = asset.mimeType ?? "image/jpeg";
        const presign = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
          `/listings/${id}/photos/presign`, { contentType, filename: asset.fileName ?? "photo.jpg" }
        );
        await uploadToS3(presign.data.data.uploadUrl, asset.uri, contentType);
        const confirm = await listingApi.post<{ data: { id: string; cdnUrl: string; position: number } }>(
          `/listings/${id}/photos/confirm`, { s3Key: presign.data.data.s3Key }
        );
        setPhotos((p) => [...p, confirm.data.data]);
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
    } catch { Alert.alert("Error", "Could not delete this photo. Please try again."); }
  }

  async function pickAndUploadDocument(docType: string, docLabel: string) {
    setUploadingDoc(docType);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const contentType = asset.mimeType ?? "application/pdf";
      const presign = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
        `/listings/${id}/documents/presign`, { contentType, documentType: docType }
      );
      await uploadToS3(presign.data.data.uploadUrl, asset.uri, contentType);
      const confirm = await listingApi.post<{ data: { id: string; documentType: string } }>(
        `/listings/${id}/documents/confirm`,
        { s3Key: presign.data.data.s3Key, documentType: docType, contentType }
      );
      setDocuments((d) => [...d.filter((doc) => doc.documentType !== docType), confirm.data.data]);
      if (errors.documents) setErrors((e) => ({ ...e, documents: undefined }));
    } catch { Alert.alert("Upload Failed", `Could not upload ${docLabel}. Please try again.`); }
    finally { setUploadingDoc(null); }
  }

  async function deleteDocument(docId: string, docLabel: string) {
    try {
      await listingApi.delete(`/listings/${id}/documents/${docId}`);
      setDocuments((d) => d.filter((doc) => doc.id !== docId));
    } catch { Alert.alert("Error", `Could not delete ${docLabel}. Please try again.`); }
  }

  const allHotelDocs = HOTEL_DOCS.every((d) => documents.some((doc) => doc.documentType === d.key));
  const isHotelLastStep = category === "hotel" && isLastStep;
  const canSubmitHotel = !isHotelLastStep || allHotelDocs;

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={K.colors.accent} />
      </View>
    );
  }

  const lastLabel = category === "hotel"
    ? (listing?.status === "rejected" ? "Re-submit for Review" : "Submit for Review")
    : "Save Changes";

  return (
    <View style={s.container}>
      <WizardHeader title="Edit Listing" step={step} steps={STEPS} onBack={handleBack} />

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
          {/* ── HOTEL STEPS ──────────────────────────────────────────────── */}

          {category === "hotel" && step === 0 && (
            <View>
              <SectionHeader title="Hotel Details" icon="home" />
              <FormField label="Hotel Name" required value={form.name}
                onChangeText={(t) => set("name", t)} placeholder="e.g. Grand Nairobi Hotel" maxLength={200}
                error={errors.name} />
              <CountryPickerButton label="Country" required selectedCountry={selectedCountry}
                onPress={() => setCountryModalOpen(true)} error={errors.country} />
              {selectedCountry && (
                <InfoBanner message={`Currency set to ${form.currency} (${form.currencySymbol})`} variant="success" />
              )}
              <ChipSelector label="Room Type" required options={ROOM_TYPES}
                selected={form.roomType} onSelect={(k) => set("roomType", k)} horizontal error={errors.roomType} />
              <FormField label="Number of Units" required value={form.unitCount}
                onChangeText={(t) => set("unitCount", t.replace(/\D/g, ""))}
                placeholder="e.g. 45" keyboardType="numeric" error={errors.unitCount} />
              <ChipSelector label="Star Rating" options={STAR_OPTIONS}
                selected={form.claimedStarRating} onSelect={(k) => set("claimedStarRating", k)} horizontal />
              <SectionHeader title="Pricing" icon="tag" />
              <View style={s.priceRow}>
                <View style={{ flex: 1 }}>
                  <FormField label="Price Per Night" required value={form.pricePerNight}
                    onChangeText={(t) => set("pricePerNight", t)} placeholder="0.00" keyboardType="decimal-pad"
                    error={errors.pricePerNight} />
                </View>
                <View style={s.currencyWrap}>
                  <CurrencyDisplay code={form.currency} symbol={form.currencySymbol} />
                </View>
              </View>
              <FormField label="Description" required
                hint={`${form.description.length}/1000`}
                value={form.description}
                onChangeText={(t) => set("description", t.slice(0, 1000))}
                placeholder="Describe your hotel…" multiline numberOfLines={5} />
            </View>
          )}

          {category === "hotel" && step === 1 && (
            <View>
              <SectionHeader title="Property Location" icon="map-pin"
                subtitle="Enter the property's full address below." />
              <FormField label="Street Address" required value={form.address}
                onChangeText={(t) => set("address", t)} placeholder="e.g. Upper Hill Road"
                error={errors.address} />
              <FormField label="Town / City" required value={form.town}
                onChangeText={(t) => set("town", t)} placeholder="e.g. Nairobi"
                error={errors.town} />
            </View>
          )}

          {category === "hotel" && step === 2 && (
            <View>
              <SectionHeader title="Check-in & Check-out" icon="clock" />
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FormField label="Check-in Time" required value={form.checkinTime}
                    onChangeText={(t) => set("checkinTime", t)} placeholder="14:00"
                    error={errors.checkinTime} />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Check-out Time" required value={form.checkoutTime}
                    onChangeText={(t) => set("checkoutTime", t)} placeholder="11:00"
                    error={errors.checkoutTime} />
                </View>
              </View>
              <FormField label="Minimum Stay (nights)" value={form.minStayNights}
                onChangeText={(t) => set("minStayNights", t.replace(/\D/g, "") || "1")}
                placeholder="1" keyboardType="numeric" />
              <RadioGroup label="Cancellation Policy" required options={CANCELLATION_OPTIONS}
                selected={form.cancellationPolicy} onSelect={(k) => set("cancellationPolicy", k)} />
              <SwitchRow label="Smoking Allowed" value={form.smokingAllowed}
                onValueChange={(v) => set("smokingAllowed", v)} />
              <SwitchRow label="Pets Allowed" value={form.petsAllowed}
                onValueChange={(v) => set("petsAllowed", v)} />
            </View>
          )}

          {category === "hotel" && step === 3 && (
            <AmenitiesSection
              amenities={form.amenities} customAmenities={form.customAmenities}
              customInput={customAmenityInput}
              onToggle={(cat, key) => setForm((f) => ({ ...f, amenities: toggleAmenity(f.amenities, cat, key) }))}
              onCustomAdd={(label) => {
                if (!label || form.customAmenities.includes(label)) return;
                setForm((f) => ({ ...f, customAmenities: [...f.customAmenities, label] }));
                setCustomAmenityInput("");
              }}
              onCustomRemove={(label) => setForm((f) => ({ ...f, customAmenities: f.customAmenities.filter((a) => a !== label) }))}
              onCustomInputChange={setCustomAmenityInput}
            />
          )}

          {category === "hotel" && step === 4 && (
            <PhotosSection photos={photos} uploading={uploadingPhoto}
              uploadProgress={uploadProgress ?? undefined}
              onAdd={pickAndUploadPhoto} onDelete={deletePhoto} minPhotos={1} maxPhotos={30}
              error={errors.photos} />
          )}

          {category === "hotel" && step === 5 && (
            <DocumentsSection docTypes={HOTEL_DOCS} documents={documents}
              uploadingDoc={uploadingDoc} onUpload={pickAndUploadDocument} onDelete={deleteDocument}
              note="All 3 documents are required to submit or resubmit your hotel listing." />
          )}

          {/* ── APARTMENT STEPS ──────────────────────────────────────────── */}

          {category === "apartment" && step === 0 && (
            <View>
              <SectionHeader title="Apartment Details" icon="home" />
              <FormField label="Apartment Name" required value={form.name}
                onChangeText={(t) => set("name", t)} placeholder="e.g. Cosy 2-bed" maxLength={200}
                error={errors.name} />
              <CountryPickerButton label="Country" required selectedCountry={selectedCountry}
                onPress={() => setCountryModalOpen(true)} error={errors.country} />
              {selectedCountry && (
                <InfoBanner message={`Currency: ${form.currency} (${form.currencySymbol})`} variant="success" />
              )}
              <FormField label="Bedrooms" required value={form.bedrooms}
                onChangeText={(t) => set("bedrooms", t.replace(/\D/g, ""))} placeholder="e.g. 2" keyboardType="numeric" />
              <FormField label="Bathrooms" required value={form.bathrooms}
                onChangeText={(t) => set("bathrooms", t.replace(/\D/g, ""))} placeholder="e.g. 1" keyboardType="numeric" />
              <FormField label="Max Guests" required value={form.maxGuests}
                onChangeText={(t) => set("maxGuests", t.replace(/\D/g, ""))} placeholder="e.g. 4" keyboardType="numeric" />
              <View style={s.priceRow}>
                <View style={{ flex: 1 }}>
                  <FormField label="Price Per Night" required value={form.pricePerNight}
                    onChangeText={(t) => set("pricePerNight", t)} placeholder="0.00" keyboardType="decimal-pad"
                    error={errors.pricePerNight} />
                </View>
                <View style={s.currencyWrap}>
                  <CurrencyDisplay code={form.currency} symbol={form.currencySymbol} />
                </View>
              </View>
              <FormField label="Description" hint={`${form.description.length}/1000`}
                value={form.description} onChangeText={(t) => set("description", t.slice(0, 1000))}
                placeholder="Describe your apartment…" multiline numberOfLines={5} />
            </View>
          )}

          {category === "apartment" && step === 1 && (
            <View>
              <SectionHeader title="Property Location" icon="map-pin" />
              <FormField label="Street Address" required value={form.address}
                onChangeText={(t) => set("address", t)} placeholder="e.g. Kilimani Road"
                error={errors.address} />
              <FormField label="Town / City" required value={form.town}
                onChangeText={(t) => set("town", t)} placeholder="e.g. Nairobi"
                error={errors.town} />
            </View>
          )}

          {category === "apartment" && step === 2 && (
            <View>
              <SectionHeader title="Policies" icon="clock" />
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FormField label="Check-in" value={form.checkinTime}
                    onChangeText={(t) => set("checkinTime", t)} placeholder="15:00" />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Check-out" value={form.checkoutTime}
                    onChangeText={(t) => set("checkoutTime", t)} placeholder="11:00" />
                </View>
              </View>
              <FormField label="Minimum Stay (nights)" value={form.minStayNights}
                onChangeText={(t) => set("minStayNights", t.replace(/\D/g, "") || "1")}
                placeholder="1" keyboardType="numeric" />
              <RadioGroup label="Cancellation Policy" required options={CANCELLATION_OPTIONS}
                selected={form.cancellationPolicy} onSelect={(k) => set("cancellationPolicy", k)} />
              <SwitchRow label="Smoking Allowed" value={form.smokingAllowed}
                onValueChange={(v) => set("smokingAllowed", v)} />
              <SwitchRow label="Pets Allowed" value={form.petsAllowed}
                onValueChange={(v) => set("petsAllowed", v)} />
              <SwitchRow label="Long-Stay Discount" hint="Offer discount for extended stays"
                value={form.longStayEnabled} onValueChange={(v) => set("longStayEnabled", v)} />
              {form.longStayEnabled && (
                <View style={s.longStayCard}>
                  <FormField label="Minimum Nights Threshold" value={form.longStayMinNights}
                    onChangeText={(t) => set("longStayMinNights", t.replace(/\D/g, ""))}
                    placeholder="7" keyboardType="numeric" />
                  <RadioGroup label="Discount Type" options={DISCOUNT_TYPE_OPTIONS}
                    selected={form.longStayDiscountType}
                    onSelect={(k) => set("longStayDiscountType", k as "percentage" | "fixed")} />
                  <FormField
                    label={form.longStayDiscountType === "percentage" ? "Discount (%)" : `Discount (${form.currency})`}
                    value={form.longStayDiscountValue}
                    onChangeText={(t) => set("longStayDiscountValue", t)} keyboardType="decimal-pad" />
                </View>
              )}
            </View>
          )}

          {category === "apartment" && step === 3 && (
            <AmenitiesSection
              amenities={form.amenities} customAmenities={form.customAmenities}
              customInput={customAmenityInput}
              onToggle={(cat, key) => setForm((f) => ({ ...f, amenities: toggleAmenity(f.amenities, cat, key) }))}
              onCustomAdd={(label) => {
                if (!label || form.customAmenities.includes(label)) return;
                setForm((f) => ({ ...f, customAmenities: [...f.customAmenities, label] }));
                setCustomAmenityInput("");
              }}
              onCustomRemove={(label) => setForm((f) => ({ ...f, customAmenities: f.customAmenities.filter((a) => a !== label) }))}
              onCustomInputChange={setCustomAmenityInput}
            />
          )}

          {category === "apartment" && step === 4 && (
            <View>
              <InfoBanner message="At least 3 photos required for auto-activation." variant="info" />
              <View style={{ height: 16 }} />
              <PhotosSection photos={photos} uploading={uploadingPhoto}
                uploadProgress={uploadProgress ?? undefined}
                onAdd={pickAndUploadPhoto} onDelete={deletePhoto} minPhotos={3} maxPhotos={30}
                error={errors.photos} />
            </View>
          )}

          {/* ── CAR STEPS ────────────────────────────────────────────────── */}

          {category === "car" && step === 0 && (
            <View>
              <SectionHeader title="Vehicle Identity" icon="truck" />
              <FormField label="Listing Title" required value={form.name}
                onChangeText={(t) => set("name", t)} placeholder="e.g. Toyota Land Cruiser 2022" maxLength={200}
                error={errors.name} />
              <CountryPickerButton label="Country" required selectedCountry={selectedCountry}
                onPress={() => setCountryModalOpen(true)} error={errors.country} />
              {selectedCountry && (
                <InfoBanner message={`Currency: ${form.currency} (${form.currencySymbol})`} variant="success" />
              )}
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FormField label="Make" required value={form.carMake}
                    onChangeText={(t) => set("carMake", t)} placeholder="Toyota" error={errors.carMake} />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Model" required value={form.carModel}
                    onChangeText={(t) => set("carModel", t)} placeholder="Land Cruiser" error={errors.carModel} />
                </View>
              </View>
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FormField label="Year" required value={form.carYear}
                    onChangeText={(t) => set("carYear", t.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2022" keyboardType="numeric" maxLength={4} error={errors.carYear} />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Colour" value={form.colour}
                    onChangeText={(t) => set("colour", t)} placeholder="Silver" />
                </View>
              </View>
              <ChipSelector label="Vehicle Category" required options={BODY_TYPES}
                selected={form.bodyType} onSelect={(k) => set("bodyType", k)} error={errors.bodyType} />
              <FormField label="Number of Units" required
                hint="How many vehicles of this type do you have?"
                value={form.unitCount}
                onChangeText={(t) => set("unitCount", t.replace(/\D/g, ""))}
                placeholder="e.g. 3" keyboardType="numeric" error={errors.unitCount} />
              <FormField label="Licence Plate" hint="Shown only after booking confirmation"
                value={form.licencePlate} onChangeText={(t) => set("licencePlate", t.toUpperCase())}
                placeholder="KAA 123A" autoCapitalize="characters" />
              <View style={s.priceRow}>
                <View style={{ flex: 1 }}>
                  <FormField label="Price Per Day" required value={form.pricePerNight}
                    onChangeText={(t) => set("pricePerNight", t)} placeholder="0.00" keyboardType="decimal-pad"
                    error={errors.pricePerNight} />
                </View>
                <View style={s.currencyWrap}>
                  <CurrencyDisplay code={form.currency} symbol={form.currencySymbol} />
                </View>
              </View>
            </View>
          )}

          {category === "car" && step === 1 && (
            <View>
              <SectionHeader title="Vehicle Specifications" icon="settings" />
              <FormField label="Seats" required value={form.seats}
                onChangeText={(t) => set("seats", t.replace(/\D/g, ""))} placeholder="5" keyboardType="numeric" />
              <FormField label="Doors" value={form.doors}
                onChangeText={(t) => set("doors", t.replace(/\D/g, ""))} placeholder="4" keyboardType="numeric" />
              <ChipSelector label="Transmission" required options={TRANSMISSION_OPTIONS}
                selected={form.transmission} onSelect={(k) => set("transmission", k)} error={errors.transmission} />
              <ChipSelector label="Fuel Type" required options={FUEL_TYPES}
                selected={form.fuelType} onSelect={(k) => set("fuelType", k)} error={errors.fuelType} />
              <ChipSelector label="Drive Type" options={DRIVE_TYPES}
                selected={form.driveType} onSelect={(k) => set("driveType", k)} />
              <FormField label="Engine Size" hint="e.g. 2.5L" value={form.engineSize}
                onChangeText={(t) => set("engineSize", t)} placeholder="2.5L" />
              <SwitchRow label="Air Conditioning" value={form.airConditioning}
                onValueChange={(v) => set("airConditioning", v)} />
            </View>
          )}

          {category === "car" && step === 2 && (
            <View>
              <SectionHeader title="Rental Conditions" icon="clipboard" />
              <FormField label={`Security Deposit (${form.currency})`} value={form.securityDeposit}
                onChangeText={(t) => set("securityDeposit", t)} placeholder="500.00" keyboardType="decimal-pad" />
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FormField label="Min Rental Days" value={form.minStayNights}
                    onChangeText={(t) => set("minStayNights", t.replace(/\D/g, "") || "1")}
                    placeholder="1" keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Min Driver Age" value={form.minDriverAge}
                    onChangeText={(t) => set("minDriverAge", t.replace(/\D/g, ""))}
                    placeholder="21" keyboardType="numeric" />
                </View>
              </View>
              <RadioGroup label="Mileage Policy" required options={MILEAGE_OPTIONS}
                selected={form.mileagePolicy} onSelect={(k) => set("mileagePolicy", k)} />
              {form.mileagePolicy === "limited" && (
                <FormField label="Mileage Limit (km/day)" value={form.mileageLimitKm}
                  onChangeText={(t) => set("mileageLimitKm", t.replace(/\D/g, ""))}
                  placeholder="200" keyboardType="numeric" />
              )}
              <RadioGroup label="Fuel Policy" required options={FUEL_POLICY_OPTIONS}
                selected={form.fuelPolicy} onSelect={(k) => set("fuelPolicy", k)} />
              <RadioGroup label="Cancellation Policy" required options={CANCELLATION_OPTIONS}
                selected={form.cancellationPolicy} onSelect={(k) => set("cancellationPolicy", k)} />
            </View>
          )}

          {category === "car" && step === 3 && (
            <View>
              <SectionHeader title="Features" icon="star" />
              <SwitchRow label="Roadside Assistance" hint="24/7 emergency breakdown support"
                value={form.roadsideAssistance} onValueChange={(v) => set("roadsideAssistance", v)} />
              <SwitchRow label="Cross-Border Allowed" hint="Can be driven across borders"
                value={form.crossBorderAllowed} onValueChange={(v) => set("crossBorderAllowed", v)} />
              <SwitchRow label="Airport Pickup" hint="Offer pickup/drop-off at airport"
                value={form.airportPickup} onValueChange={(v) => set("airportPickup", v)} />
              <SwitchRow label="Return to Same Location"
                value={form.returnSameLocation} onValueChange={(v) => set("returnSameLocation", v)} />
              <SwitchRow label="Delivery Available" hint="Deliver to guest location"
                value={form.deliveryAvailable} onValueChange={(v) => set("deliveryAvailable", v)} />
              {form.deliveryAvailable && (
                <View style={s.longStayCard}>
                  <FormField label="Delivery Radius (km)" value={form.deliveryRadiusKm}
                    onChangeText={(t) => set("deliveryRadiusKm", t.replace(/\D/g, ""))}
                    placeholder="30" keyboardType="numeric" />
                  <FormField label={`Delivery Fee (${form.currency})`} value={form.deliveryFee}
                    onChangeText={(t) => set("deliveryFee", t)} placeholder="15.00" keyboardType="decimal-pad" />
                </View>
              )}
            </View>
          )}

          {category === "car" && step === 4 && (
            <View>
              <SectionHeader title="Pickup Location" icon="map-pin" />
              <FormField label="Pickup Address" required value={form.address}
                onChangeText={(t) => set("address", t)} placeholder="e.g. Jomo Kenyatta Airport"
                error={errors.address} />
              <FormField label="Town / City" required value={form.town}
                onChangeText={(t) => set("town", t)} placeholder="e.g. Nairobi"
                error={errors.town} />
              <FormField label="Pickup Hours" value={form.pickupHours}
                onChangeText={(t) => set("pickupHours", t)} placeholder="08:00 – 18:00" />
            </View>
          )}

          {category === "car" && step === 5 && (
            <View>
              <PhotosSection photos={photos} uploading={uploadingPhoto}
                uploadProgress={uploadProgress ?? undefined}
                onAdd={pickAndUploadPhoto} onDelete={deletePhoto} minPhotos={1} maxPhotos={30}
                error={errors.photos} />
              <View style={{ height: 20 }} />
              <DocumentsSection docTypes={CAR_DOCS} documents={documents}
                uploadingDoc={uploadingDoc} onUpload={pickAndUploadDocument} onDelete={deleteDocument}
                note="Insurance and roadworthiness documents required." />
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        <WizardFooter
          onNext={isLastStep ? (category === "hotel" ? handleHotelResubmit : handleFinalSave) : handleNext}
          onBack={handleBack}
          isFirst={step === 0}
          isLast={isLastStep}
          lastLabel={lastLabel}
          loading={saving || submitting}
          disabled={isHotelLastStep && !canSubmitHotel}
          disabledHint={isHotelLastStep && !canSubmitHotel ? "Upload all 3 required documents first." : undefined}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: K.colors.bgLight },
  scroll: { padding: 20, paddingBottom: 32 },
  priceRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  currencyWrap: { paddingTop: 24, paddingBottom: 20 },
  twoCol: { flexDirection: "row", gap: 12 },
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
