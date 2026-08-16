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
  Modal,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { listingApi, uploadToS3 } from "../../lib/listing-api";
import { K } from "../../constants/theme";
import { ALL_COUNTRIES, CountryData } from "../../constants/countries";
import { getCurrencyForCountry } from "../../lib/currency";
import {
  FormField,
  SectionHeader,
  ChipSelector,
  SwitchRow,
  RadioGroup,
  CountryPickerButton,
  CountryPickerModal,
  CurrencyDisplay,
  PhotosSection,
  DocumentsSection,
  InfoBanner,
  WizardHeader,
  WizardFooter,
} from "./_components";
import { LocationPicker } from "../../components/maps/LocationPicker";

// ── Config ────────────────────────────────────────────────────────────────────

const CAR_CATEGORIES = [
  { key: "Economy", label: "Economy" },
  { key: "Compact", label: "Compact" },
  { key: "SUV", label: "SUV" },
  { key: "Minivan", label: "Minivan" },
  { key: "Pickup", label: "Pickup" },
  { key: "Luxury", label: "Luxury" },
  { key: "Electric", label: "Electric" },
  { key: "Convertible", label: "Convertible" },
];

const INSURANCE_TYPE_OPTIONS = [
  { key: "basic", label: "Basic" },
  { key: "standard", label: "Standard" },
  { key: "comprehensive", label: "Comprehensive" },
  { key: "premium", label: "Premium" },
  { key: "basic_third_party", label: "Third Party" },
  { key: "premium_zero_excess", label: "Zero Excess" },
];

const TRANSMISSION_OPTIONS = [
  { key: "manual", label: "Manual" },
  { key: "automatic", label: "Automatic" },
  { key: "semi_auto", label: "Semi-Automatic" },
];

const FUEL_TYPES = [
  { key: "petrol", label: "Petrol" },
  { key: "diesel", label: "Diesel" },
  { key: "electric", label: "Electric" },
  { key: "hybrid", label: "Hybrid" },
];

const DRIVE_TYPES = [
  { key: "2WD", label: "2WD" },
  { key: "4WD", label: "4WD" },
  { key: "AWD", label: "AWD" },
];

const MILEAGE_OPTIONS = [
  { key: "unlimited", label: "Unlimited", desc: "No daily mileage limit" },
  { key: "limited", label: "Limited (per day)", desc: "Set a km/day cap — extra km billed separately" },
];

const FUEL_POLICY_OPTIONS = [
  { key: "full_to_full", label: "Full-to-Full", desc: "Return with same fuel level as pickup" },
  { key: "full_to_empty", label: "Full-to-Empty", desc: "Pre-paid full tank, return empty" },
  { key: "same_level", label: "Same Level", desc: "Return with the same level as received" },
];

const CANCELLATION_OPTIONS = [
  { key: "flexible", label: "Flexible", desc: "Full refund up to 24 h before pickup" },
  { key: "moderate", label: "Moderate", desc: "Full refund up to 5 days before pickup" },
  { key: "strict", label: "Strict", desc: "50% refund up to 1 week before pickup" },
];

const CAR_DOCS = [
  { key: "vehicle_registration", label: "Vehicle Registration", icon: "file-text" as const },
  { key: "insurance_certificate", label: "Insurance Certificate", icon: "shield" as const },
  { key: "roadworthiness_certificate", label: "Roadworthiness Certificate", icon: "check-circle" as const },
];

const STEPS = [
  "Identity",
  "Technical",
  "Pricing",
  "Features",
  "Location",
  "Photos & Docs",
] as const;

type CarForm = {
  // identity
  name: string;
  carMake: string;
  carModel: string;
  carYear: string;
  carCategory: string;
  unitCount: string;
  colour: string;
  licencePlate: string;
  odometerReading: string;
  // technical
  seats: string;
  doors: string;
  transmission: string;
  fuelType: string;
  driveType: string;
  engineSize: string;
  airConditioning: boolean;
  // pricing
  pricePerNight: string; // used as "per day"
  currency: string;
  currencySymbol: string;
  minStayNights: string; // used as "min rental days"
  minDriverAge: string;
  mileagePolicy: string;
  mileageLimitKm: string;
  extraKmRate: string;
  fuelPolicy: string;
  insuranceType: string;
  securityDeposit: string;
  cancellationPolicy: string;
  driverProvided: boolean;
  // features
  roadsideAssistance: boolean;
  crossBorderAllowed: boolean;
  airportPickup: boolean;
  returnSameLocation: boolean;
  deliveryAvailable: boolean;
  deliveryRadiusKm: string;
  deliveryFee: string;
  // location
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  town: string;
  country: string;
  pickupHours: string;
};

type FormErrors = Partial<Record<keyof CarForm | "photos", string>>;

// ── Time Range Picker ─────────────────────────────────────────────────────────

const HOUR_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    opts.push(`${String(h).padStart(2, "0")}:00`);
    opts.push(`${String(h).padStart(2, "0")}:30`);
  }
  opts.push("24:00");
  return opts;
})();

function parsePickupHours(val: string): [string, string] {
  const m = val.match(/^(\d{2}:\d{2})\s*[–\-]\s*(\d{2}:\d{2})$/);
  if (m) return [m[1]!, m[2]!];
  return ["08:00", "18:00"];
}

function TimeRangePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState<"from" | "to" | null>(null);
  const [from, to] = parsePickupHours(value);

  function select(time: string) {
    if (!open) return;
    const newFrom = open === "from" ? time : from;
    const newTo   = open === "to"   ? time : to;
    onChange(`${newFrom} – ${newTo}`);
    setOpen(null);
  }

  return (
    <View>
      <Text style={s.trpLabel}>Pickup Hours</Text>
      <Text style={s.trpHint}>Operating hours for pickup and return</Text>
      <View style={s.trpRow}>
        <TouchableOpacity style={s.trpBtn} onPress={() => setOpen("from")} activeOpacity={0.75}>
          <Text style={s.trpBtnHint}>FROM</Text>
          <Text style={s.trpBtnValue}>{from}</Text>
        </TouchableOpacity>
        <Text style={s.trpSepText}>–</Text>
        <TouchableOpacity style={s.trpBtn} onPress={() => setOpen("to")} activeOpacity={0.75}>
          <Text style={s.trpBtnHint}>UNTIL</Text>
          <Text style={s.trpBtnValue}>{to}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={s.trpOverlay}>
          <View style={s.trpSheet}>
            <View style={s.trpSheetHeader}>
              <Text style={s.trpSheetTitle}>
                {open === "from" ? "Opens at" : "Closes at"}
              </Text>
              <TouchableOpacity
                onPress={() => setOpen(null)}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              >
                <Text style={s.trpClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={HOUR_OPTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const active = item === (open === "from" ? from : to);
                return (
                  <TouchableOpacity
                    style={[s.trpOption, active && s.trpOptionActive]}
                    onPress={() => select(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.trpOptionText, active && s.trpOptionTextActive]}>
                      {item}
                    </Text>
                    {active && <Text style={s.trpCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CarListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const isKeyboardOpen = useKeyboard();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; cdnUrl: string; position: number }>>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; documentType: string }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [form, setForm] = useState<CarForm>({
    name: "",
    carMake: "",
    carModel: "",
    carYear: "",
    carCategory: "",
    unitCount: "",   // starts empty — no hardcoded default
    colour: "",
    licencePlate: "",
    odometerReading: "",
    seats: "5",
    doors: "4",
    transmission: "",
    fuelType: "",
    driveType: "",
    engineSize: "",
    airConditioning: true,
    pricePerNight: "",
    currency: "USD",
    currencySymbol: "$",
    minStayNights: "1",
    minDriverAge: "21",
    mileagePolicy: "unlimited",
    mileageLimitKm: "",
    extraKmRate: "",
    fuelPolicy: "full_to_full",
    insuranceType: "",
    securityDeposit: "",
    driverProvided: false,
    cancellationPolicy: "moderate",
    roadsideAssistance: false,
    crossBorderAllowed: false,
    airportPickup: false,
    returnSameLocation: true,
    deliveryAvailable: false,
    deliveryRadiusKm: "",
    deliveryFee: "",
    address: "",
    neighborhood: "",
    lat: null,
    lng: null,
    town: "",
    country: "",
    pickupHours: "08:00 – 18:00",
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
    setForm({
      name: listing.name ?? "",
      carMake: listing.carMake ?? "",
      carModel: listing.carModel ?? "",
      carYear: String(listing.carYear ?? ""),
      carCategory: listing.carCategory ?? "",
      unitCount: listing.unitCount != null ? String(listing.unitCount) : "",
      colour: listing.colour ?? "",
      licencePlate: listing.licencePlate ?? "",
      odometerReading: String(listing.odometerReading ?? ""),
      seats: String(listing.seats ?? 5),
      doors: String(listing.doors ?? 4),
      transmission: listing.transmission === "both"
        ? "semi_auto"
        : TRANSMISSION_OPTIONS.some((o) => o.key === listing.transmission)
          ? listing.transmission
          : "",
      fuelType: listing.fuelType ?? "",
      driveType: DRIVE_TYPES.some((o) => o.key === listing.driveType)
        ? listing.driveType
        : "",
      engineSize: listing.engineSize ?? "",
      airConditioning: listing.airConditioning ?? true,
      pricePerNight: String(listing.pricePerDay ?? listing.pricePerNight ?? ""),
      currency: cur.code,
      currencySymbol: cur.symbol,
      minStayNights: String(listing.minStayNights ?? "1"),
      minDriverAge: String(listing.minimumDriverAge ?? "21"),
      mileagePolicy: listing.mileagePolicy ?? "unlimited",
      mileageLimitKm: String(listing.mileageLimitKm ?? ""),
      extraKmRate: String(listing.extraKmRate ?? ""),
      fuelPolicy: listing.fuelPolicy ?? "full_to_full",
      insuranceType: listing.insuranceType ?? "",
      securityDeposit: String(listing.securityDeposit ?? ""),
      driverProvided: listing.driverProvided ?? false,
      cancellationPolicy: listing.cancellationPolicy ?? "moderate",
      roadsideAssistance: listing.roadsideAssistance ?? false,
      crossBorderAllowed: listing.crossBorderAllowed ?? false,
      airportPickup: listing.airportPickup ?? false,
      returnSameLocation: listing.returnSameLocation ?? true,
      deliveryAvailable: listing.deliveryAvailable ?? false,
      deliveryRadiusKm: String(listing.deliveryRadiusKm ?? ""),
      deliveryFee: String(listing.deliveryFee ?? ""),
      address: listing.address ?? "",
      neighborhood: listing.neighborhood ?? "",
      lat: (listing as any).lat ?? null,
      lng: (listing as any).lng ?? null,
      town: listing.town ?? "",
      country: listing.country ?? "",
      pickupHours: listing.pickupHours ?? "08:00 – 18:00",
    });
    setPhotos(listing.photos ?? []);
    setDocuments(listing.documents ?? []);
  }, [listing]);

  function set<K extends keyof CarForm>(key: K, value: CarForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
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
        if (!form.name.trim()) e.name = "Listing title is required.";
        if (!form.country) e.country = "Country is required.";
        if (!form.carMake.trim()) e.carMake = "Make is required.";
        if (!form.carModel.trim()) e.carModel = "Model is required.";
        if (!form.carYear.trim()) e.carYear = "Year is required.";
        if (!form.carCategory) e.carCategory = "Vehicle category is required.";
        if (!form.unitCount.trim() || parseInt(form.unitCount, 10) < 1)
          e.unitCount = "Number of units is required (minimum 1).";
        if (!form.pricePerNight.trim() || parseFloat(form.pricePerNight) <= 0)
          e.pricePerNight = "Price per day is required.";
        break;
      case 1:
        if (!form.seats.trim() || parseInt(form.seats, 10) < 1) e.seats = "Number of seats is required.";
        if (!form.transmission) e.transmission = "Transmission type is required.";
        if (!form.fuelType) e.fuelType = "Fuel type is required.";
        break;
      case 2:
        if (!form.minDriverAge.trim() || parseInt(form.minDriverAge, 10) < 16)
          e.minDriverAge = "Minimum driver age is required.";
        if (!form.cancellationPolicy) e.cancellationPolicy = "Cancellation policy is required.";
        if (form.mileagePolicy === "limited" && (!form.mileageLimitKm.trim() || parseInt(form.mileageLimitKm, 10) < 1))
          e.mileageLimitKm = "Daily mileage limit is required when policy is 'Limited'.";
        if (form.mileagePolicy === "limited" && (!form.extraKmRate.trim() || parseFloat(form.extraKmRate) <= 0))
          e.extraKmRate = "Extra km rate is required when policy is 'Limited'.";
        break;
      case 3:
        if (form.mileagePolicy === "limited" && (!form.extraKmRate.trim() || parseFloat(form.extraKmRate) <= 0))
          e.extraKmRate = "Extra km rate is required when policy is 'Limited'.";
        break;
      case 4:
        if (!form.address.trim()) e.address = "Pickup address is required.";
        if (!form.town.trim()) e.town = "Town / city is required.";
        break;
      case 5:
        if (photos.length < 1) e.photos = "At least 1 photo is required.";
        break;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function buildStepPayload(currentStep: number): Record<string, unknown> {
    switch (currentStep) {
      case 0: // Identity + Price Per Day
        return {
          name: form.name,
          carMake: form.carMake,
          carModel: form.carModel,
          carYear: parseInt(form.carYear, 10) || null,
          carCategory: form.carCategory || null,
          unitCount: parseInt(form.unitCount, 10) || null,
          colour: form.colour,
          licencePlate: form.licencePlate,
          odometerReading: parseInt(form.odometerReading, 10) || null,
          pricePerDay: parseFloat(form.pricePerNight) || null,
          currency: form.currency,
          country: form.country?.trim()?.toUpperCase() || null,
        };
      case 1: // Technical
        return {
          seats: parseInt(form.seats, 10) || 1,
          doors: parseInt(form.doors, 10) || 2,
          transmission: (() => {
            const t = form.transmission === "both" ? "semi_auto" : form.transmission;
            return (["manual", "automatic", "semi_auto"] as const).includes(
              t as "manual" | "automatic" | "semi_auto",
            )
              ? t
              : null;
          })(),
          fuelType: form.fuelType || null,
          driveType: (["2WD", "4WD", "AWD"] as const).includes(
            form.driveType as "2WD" | "4WD" | "AWD",
          )
            ? form.driveType
            : null,
          engineSize: form.engineSize,
          airConditioning: form.airConditioning,
        };
      case 2: // Rental Conditions
        return {
          securityDeposit: parseFloat(form.securityDeposit) || null,
          driverProvided: form.driverProvided,
          minStayNights: parseInt(form.minStayNights, 10) || 1,
          minimumDriverAge: parseInt(form.minDriverAge, 10) || null,
          mileagePolicy: form.mileagePolicy,
          mileageLimitKm: form.mileagePolicy === "limited" ? parseInt(form.mileageLimitKm, 10) || null : null,
          extraKmRate: form.mileagePolicy === "limited" ? parseFloat(form.extraKmRate) || null : null,
          fuelPolicy: form.fuelPolicy || null,
          insuranceType: form.insuranceType || null,
          cancellationPolicy: form.cancellationPolicy || null,
        };
      case 3: // Features
        return {
          roadsideAssistance: form.roadsideAssistance,
          crossBorderAllowed: form.crossBorderAllowed,
          airportPickup: form.airportPickup,
          returnSameLocation: form.returnSameLocation,
          deliveryAvailable: form.deliveryAvailable,
          deliveryRadiusKm: form.deliveryAvailable ? parseInt(form.deliveryRadiusKm, 10) || null : null,
          deliveryFee: form.deliveryAvailable ? parseFloat(form.deliveryFee) || null : null,
          extraKmRate: form.mileagePolicy === "limited" ? parseFloat(form.extraKmRate) || null : null,
        };
      case 4: // Location
        return {
          address: form.address,
          town: form.town,
          neighborhood: form.neighborhood || null,
          lat: form.lat,
          lng: form.lng,
          pickupHours: form.pickupHours,
        };
      case 5: // Photos & Docs — uploaded via presign/confirm, no PATCH needed
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
      Alert.alert("Save Failed", "Could not save your changes. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    qc.invalidateQueries({ queryKey: ["myListings"] });
    Alert.alert(
      "Vehicle Listing Saved",
      "Your vehicle listing has been saved. Would you like to go to the activation screen to publish it now?",
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

  async function deleteDocument(docId: string, docLabel: string) {
    try {
      await listingApi.delete(`/listings/${id}/documents/${docId}`);
      setDocuments((d) => d.filter((doc) => doc.id !== docId));
    } catch {
      Alert.alert("Error", `Could not delete ${docLabel}. Please try again.`);
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
        title="Vehicle Listing"
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
        {/* ── Step 0: Identity ────────────────────────────────────────────── */}
        {step === 0 && (
          <View>
            <InfoBanner
              message="Vehicle listings auto-activate once all required fields are complete and at least 1 photo is uploaded."
              variant="success"
            />
            <View style={s.gap} />

            <SectionHeader title="Listing Identity" icon="truck" />

            <FormField
              label="Listing Title"
              required
              value={form.name}
              onChangeText={(t) => set("name", t)}
              placeholder="e.g. Toyota Land Cruiser 2022 – Nairobi"
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

            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Make"
                  required
                  value={form.carMake}
                  onChangeText={(t) => set("carMake", t)}
                  placeholder="e.g. Toyota"
                  error={errors.carMake}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Model"
                  required
                  value={form.carModel}
                  onChangeText={(t) => set("carModel", t)}
                  placeholder="e.g. Land Cruiser"
                  error={errors.carModel}
                />
              </View>
            </View>

            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Year"
                  required
                  value={form.carYear}
                  onChangeText={(t) => set("carYear", t.replace(/\D/g, "").slice(0, 4))}
                  placeholder="e.g. 2022"
                  keyboardType="numeric"
                  maxLength={4}
                  error={errors.carYear}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Colour"
                  value={form.colour}
                  onChangeText={(t) => set("colour", t)}
                  placeholder="e.g. Silver"
                />
              </View>
            </View>

            <ChipSelector
              label="Vehicle Category"
              required
              options={CAR_CATEGORIES}
              selected={form.carCategory}
              onSelect={(k) => set("carCategory", k)}
              error={errors.carCategory}
            />

            <FormField
              label="Number of Units Available"
              required
              hint="How many vehicles of this type do you have?"
              value={form.unitCount}
              onChangeText={(t) => set("unitCount", t.replace(/\D/g, ""))}
              placeholder="e.g. 3"
              keyboardType="numeric"
              error={errors.unitCount}
            />

            <FormField
              label="Licence Plate"
              hint="Only shown to guests after booking confirmation"
              value={form.licencePlate}
              onChangeText={(t) => set("licencePlate", t.toUpperCase())}
              placeholder="e.g. KAA 123A"
              autoCapitalize="characters"
            />

            <FormField
              label="Odometer Reading (km)"
              hint="Current mileage at time of listing"
              value={form.odometerReading}
              onChangeText={(t) => set("odometerReading", t.replace(/\D/g, ""))}
              placeholder="e.g. 45000"
              keyboardType="numeric"
            />

            <View style={s.gap} />
            <SectionHeader title="Pricing" icon="tag" />

            <View style={s.priceRow}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Price Per Day"
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
              </View>
            </View>
          </View>
        )}

        {/* ── Step 1: Technical ───────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <SectionHeader title="Vehicle Specifications" icon="settings" />

            <FormField
              label="Seats"
              required
              value={form.seats}
              onChangeText={(t) => set("seats", t.replace(/\D/g, ""))}
              placeholder="e.g. 5"
              keyboardType="numeric"
              error={errors.seats}
            />

            <FormField
              label="Doors"
              value={form.doors}
              onChangeText={(t) => set("doors", t.replace(/\D/g, ""))}
              placeholder="e.g. 4"
              keyboardType="numeric"
            />

            <ChipSelector
              label="Transmission"
              required
              options={TRANSMISSION_OPTIONS}
              selected={form.transmission}
              onSelect={(k) => set("transmission", k)}
              error={errors.transmission}
            />

            <ChipSelector
              label="Fuel Type"
              required
              options={FUEL_TYPES}
              selected={form.fuelType}
              onSelect={(k) => set("fuelType", k)}
              error={errors.fuelType}
            />

            <ChipSelector
              label="Drive Type"
              options={DRIVE_TYPES}
              selected={form.driveType}
              onSelect={(k) => set("driveType", k)}
            />

            <FormField
              label="Engine Size"
              hint="e.g. 2.0L, 3.5L, 2000cc"
              value={form.engineSize}
              onChangeText={(t) => set("engineSize", t)}
              placeholder="e.g. 2.5L"
            />

            <SwitchRow
              label="Air Conditioning"
              value={form.airConditioning}
              onValueChange={(v) => set("airConditioning", v)}
            />
          </View>
        )}

        {/* ── Step 2: Pricing ─────────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <SectionHeader title="Rental Conditions" icon="clipboard" />

            <FormField
              label={`Security Deposit (${form.currency})`}
              hint="Amount held during rental, returned at completion"
              value={form.securityDeposit}
              onChangeText={(t) => set("securityDeposit", t)}
              placeholder="e.g. 500.00"
              keyboardType="decimal-pad"
              editable={!form.driverProvided}
            />

            {/* Waives the deposit — the API zeroes it when this is on, so it
                sits with the deposit field rather than in Vehicle Features. */}
            <SwitchRow
              label="I provide a driver"
              hint="No security deposit is collected from the guest when you supply the driver"
              value={form.driverProvided}
              onValueChange={(v) => set("driverProvided", v)}
            />

            <View style={s.gap} />
            <SectionHeader title="Rental Rules" icon="clipboard" />

            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Minimum Rental Days"
                  required
                  value={form.minStayNights}
                  onChangeText={(t) => set("minStayNights", t.replace(/\D/g, ""))}
                  placeholder="1"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Minimum Driver Age"
                  required
                  value={form.minDriverAge}
                  onChangeText={(t) => set("minDriverAge", t.replace(/\D/g, ""))}
                  placeholder="21"
                  keyboardType="numeric"
                  error={errors.minDriverAge}
                />
              </View>
            </View>

            <RadioGroup
              label="Mileage Policy"
              required
              options={MILEAGE_OPTIONS}
              selected={form.mileagePolicy}
              onSelect={(k) => set("mileagePolicy", k)}
            />

            {form.mileagePolicy === "limited" && (
              <>
                <FormField
                  label="Mileage Limit (km/day)"
                  required
                  value={form.mileageLimitKm}
                  onChangeText={(t) => set("mileageLimitKm", t.replace(/\D/g, ""))}
                  placeholder="e.g. 200"
                  keyboardType="numeric"
                  error={errors.mileageLimitKm}
                />
                <FormField
                  label="Extra km Rate"
                  hint="Charge per km over the daily limit"
                  required
                  value={form.extraKmRate}
                  onChangeText={(t) => set("extraKmRate", t.replace(/[^0-9.]/g, ""))}
                  placeholder="e.g. 0.50"
                  keyboardType="decimal-pad"
                  error={errors.extraKmRate}
                />
              </>
            )}

            <RadioGroup
              label="Fuel Policy"
              required
              options={FUEL_POLICY_OPTIONS}
              selected={form.fuelPolicy}
              onSelect={(k) => set("fuelPolicy", k)}
            />

            <ChipSelector
              label="Insurance Type"
              required
              options={INSURANCE_TYPE_OPTIONS}
              selected={form.insuranceType}
              onSelect={(k) => set("insuranceType", k)}
            />

            <RadioGroup
              label="Cancellation Policy"
              required
              options={CANCELLATION_OPTIONS}
              selected={form.cancellationPolicy}
              onSelect={(k) => set("cancellationPolicy", k)}
            />
          </View>
        )}

        {/* ── Step 3: Features ─────────────────────────────────────────────── */}
        {step === 3 && (
          <View>
            <SectionHeader title="Vehicle Features" icon="star" />

            <SwitchRow
              label="Roadside Assistance"
              hint="24/7 emergency breakdown support included"
              value={form.roadsideAssistance}
              onValueChange={(v) => set("roadsideAssistance", v)}
            />
            <SwitchRow
              label="Cross-Border Allowed"
              hint="Vehicle may be driven across country borders"
              value={form.crossBorderAllowed}
              onValueChange={(v) => set("crossBorderAllowed", v)}
            />
            <SwitchRow
              label="Airport Pickup Available"
              hint="Offer pickup/drop-off at the airport"
              value={form.airportPickup}
              onValueChange={(v) => set("airportPickup", v)}
            />
            <SwitchRow
              label="Return to Same Location"
              hint="Vehicle must be returned to pickup point"
              value={form.returnSameLocation}
              onValueChange={(v) => set("returnSameLocation", v)}
            />

            <View style={s.gap} />
            <SectionHeader title="Delivery" icon="navigation" />

            <SwitchRow
              label="Delivery Available"
              hint="Deliver the vehicle to the guest's location"
              value={form.deliveryAvailable}
              onValueChange={(v) => set("deliveryAvailable", v)}
            />

            {form.deliveryAvailable && (
              <View style={s.deliveryCard}>
                <FormField
                  label="Delivery Radius (km)"
                  required
                  value={form.deliveryRadiusKm}
                  onChangeText={(t) => set("deliveryRadiusKm", t.replace(/\D/g, ""))}
                  placeholder="e.g. 30"
                  keyboardType="numeric"
                />
                <FormField
                  label={`Delivery Fee (${form.currency})`}
                  required
                  value={form.deliveryFee}
                  onChangeText={(t) => set("deliveryFee", t)}
                  placeholder="e.g. 15.00"
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            {form.mileagePolicy === "limited" && (
              <>
                <View style={s.gap} />
                <SectionHeader title="Mileage Overage" icon="alert-circle" />
                <FormField
                  label="Extra km Rate"
                  hint="Charge per km over the daily mileage limit"
                  required
                  value={form.extraKmRate}
                  onChangeText={(t) => set("extraKmRate", t.replace(/[^0-9.]/g, ""))}
                  placeholder="e.g. 0.50"
                  keyboardType="decimal-pad"
                  error={errors.extraKmRate}
                />
              </>
            )}
          </View>
        )}

        {/* ── Step 4: Location ────────────────────────────────────────────── */}
        {step === 4 && (
          <View>
            <SectionHeader
              title="Pickup Location"
              subtitle="Search for the pickup point, then drag the pin to the exact spot."
              icon="map-pin"
            />

            <LocationPicker
              label="Find the pickup point"
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
              label="Pickup Address"
              required
              value={form.address}
              onChangeText={(t) => set("address", t)}
              placeholder="e.g. Jomo Kenyatta International Airport, Gate 3"
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

            <View style={s.gap} />
            <TimeRangePicker
              value={form.pickupHours}
              onChange={(v) => set("pickupHours", v)}
            />
          </View>
        )}

        {/* ── Step 5: Photos & Documents ──────────────────────────────────── */}
        {step === 5 && (
          <View>
            <PhotosSection
              photos={photos}
              uploading={uploadingPhoto}
              uploadProgress={uploadProgress ?? undefined}
              onAdd={() => pickAndUploadPhoto("library")}
              onCapture={() => pickAndUploadPhoto("camera")}
              onDelete={deletePhoto}
              onReorder={reorderPhoto}
              minPhotos={1}
              maxPhotos={30}
              error={errors.photos}
            />

            <View style={s.gap} />

            <DocumentsSection
              docTypes={CAR_DOCS}
              documents={documents}
              uploadingDoc={uploadingDoc}
              onUpload={pickAndUploadDocument}
              onDelete={deleteDocument}
              note="Upload valid insurance and roadworthiness documents for your vehicle."
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: K.colors.bgLight },
  loadingText: { fontSize: K.font.sm, color: K.colors.textMuted },
  scroll: { padding: 20, paddingBottom: 32 },
  gap: { height: 24 },
  twoCol: { flexDirection: "row", gap: 12 },
  priceRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  currencyBadgeWrap: { paddingBottom: 20, paddingTop: 4, alignItems: "flex-start", minWidth: 90 },
  currencyLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark, marginBottom: 8 },
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: K.radius.lg,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: K.colors.border,
    gap: 4,
  },

  // Time range picker
  trpLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark, marginBottom: 4 },
  trpHint: { fontSize: K.font.xs, color: K.colors.textMuted, marginBottom: 10 },
  trpRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  trpBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: K.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  trpBtnHint: {
    fontSize: 10,
    color: K.colors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  trpBtnValue: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  trpSepText: { fontSize: 18, color: K.colors.textMuted, fontWeight: "300" },
  trpOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  trpSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
    paddingBottom: 32,
  },
  trpSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  trpSheetTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  trpClose: { fontSize: K.font.base, color: K.colors.textMuted, paddingHorizontal: 4 },
  trpOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  trpOptionActive: { backgroundColor: "#f0fdf4" },
  trpOptionText: { fontSize: K.font.base, color: K.colors.textMid },
  trpOptionTextActive: { color: K.colors.accent, fontWeight: "700" },
  trpCheck: { fontSize: K.font.base, color: K.colors.accent, fontWeight: "700" },
});
