import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi, uploadToS3 } from "@/lib/listing-api";

// ── Step definitions ──────────────────────────────────────────────────────────
const HOTEL_STEPS = ["Basic Info", "Location", "Pricing & Policies", "Amenities", "Photos", "Documents"];
const APT_STEPS = ["Basic Info", "Location", "Pricing & Policies", "Amenities", "Photos"];
const CAR_STEPS = ["Vehicle Details", "Pickup Location", "Pricing & Policies", "Features", "Photos"];

function getSteps(category?: string) {
  if (category === "apartment") return APT_STEPS;
  if (category === "car") return CAR_STEPS;
  return HOTEL_STEPS;
}

// ── Static data (trimmed for brevity – import from a shared constants file in real project) ──
const ROOM_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "superior", label: "Superior" },
  { value: "deluxe", label: "Deluxe" },
  { value: "suite", label: "Suite" },
];

const CAR_FEATURES = ["Air Conditioning", "GPS", "Automatic Transmission"];
const HOTEL_AMENITIES = ["WiFi", "Pool", "Gym", "Breakfast"];
const APT_AMENITIES = ["Pets Allowed", "Balcony", "Laundry"];

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  // common fields
  name: string; description: string;
  address: string; lat: string; lng: string; town: string; country: string;
  pricePerNight: string; currency: string; minStayNights: string;
  checkinTime: string; checkoutTime: string;
  cancellationPolicy: string; smokingAllowed: boolean; petsAllowed: boolean;
  amenities: string[]; customAmenities: string[];
  // hotel-specific
  roomType: string; unitCount: string; claimedStarRating: string;
  // apartment-specific
  bedrooms: string; bathrooms: string; maxGuests: string;
  longStayEnabled: boolean; longStayMinNights: string;
  longStayDiscountType: string; longStayDiscountValue: string;
  // car-specific
  carMake: string; carModel: string; carYear: string;
  transmission: string; fuelType: string; seats: string; doors: string;
  mileagePolicy: string; mileageLimitKm: string;
}

interface Photo { id: string; cdnUrl: string; position: number }
interface Document { id: string; documentType: string }

const EMPTY_FORM: FormData = {
  name: "", description: "",
  address: "", lat: "", lng: "", town: "", country: "",
  pricePerNight: "", currency: "USD", minStayNights: "1",
  checkinTime: "", checkoutTime: "", cancellationPolicy: "",
  smokingAllowed: false, petsAllowed: false, amenities: [], customAmenities: [],
  roomType: "", unitCount: "", claimedStarRating: "",
  bedrooms: "", bathrooms: "", maxGuests: "",
  longStayEnabled: false, longStayMinNights: "", longStayDiscountType: "", longStayDiscountValue: "",
  carMake: "", carModel: "", carYear: "", transmission: "", fuelType: "", seats: "", doors: "4", mileagePolicy: "", mileageLimitKm: "",
};

type Mode = "create" | "edit";

export default function ListingForm({ mode, category: propCategory }: { mode: Mode; category?: string }) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const listingId = params.id;
  const isEdit = mode === "edit" && !!listingId;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const queryClient = useQueryClient();

  // ── Load existing listing for edit mode ──
  const { data: listing, isLoading } = useQuery({
    queryKey: isEdit ? ["listing", listingId] : [],
    enabled: isEdit,
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${listingId}`);
      return res.data.data;
    },
  });

  useEffect(() => {
    if (!listing) return;
    setForm({
      name: listing.name ?? "",
      description: listing.description ?? "",
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
      // hotel
      roomType: listing.roomType ?? "",
      unitCount: listing.unitCount?.toString() ?? "",
      claimedStarRating: listing.claimedStarRating?.toString() ?? "",
      // apartment
      bedrooms: listing.bedrooms?.toString() ?? "",
      bathrooms: listing.bathrooms?.toString() ?? "",
      maxGuests: listing.maxGuests?.toString() ?? "",
      longStayEnabled: listing.longStayEnabled ?? false,
      longStayMinNights: listing.longStayMinNights?.toString() ?? "",
      longStayDiscountType: listing.longStayDiscountType ?? "",
      longStayDiscountValue: listing.longStayDiscountValue?.toString() ?? "",
      // car
      carMake: listing.carMake ?? "",
      carModel: listing.carModel ?? "",
      carYear: listing.carYear?.toString() ?? "",
      transmission: listing.transmission ?? "",
      fuelType: listing.fuelType ?? "",
      seats: listing.seats?.toString() ?? "",
      doors: listing.doors?.toString() ?? "4",
      mileagePolicy: listing.mileagePolicy ?? "",
      mileageLimitKm: listing.mileageLimitKm?.toString() ?? "",
    });
    setPhotos(listing.photos ?? []);
    setDocuments(listing.documents ?? []);
  }, [listing]);

  const effectiveCategory = isEdit ? listing?.category : propCategory;
  const steps = getSteps(effectiveCategory);
  const isLastStep = step === steps.length - 1;

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name || null,
        description: form.description || null,
        address: form.address || null,
        lat: parseFloat(form.lat) || null,
        lng: parseFloat(form.lng) || null,
        town: form.town || null,
        country: form.country || null,
        pricePerNight: parseFloat(form.pricePerNight) || null,
        currency: form.currency || null,
        minStayNights: parseInt(form.minStayNights, 10) || 1,
        checkinTime: form.checkinTime || null,
        checkoutTime: form.checkoutTime || null,
        cancellationPolicy: form.cancellationPolicy || null,
        smokingAllowed: form.smokingAllowed,
        petsAllowed: form.petsAllowed,
        amenities: form.amenities,
        customAmenities: form.customAmenities,
      };
      // category‑specific fields
      const effectiveCategory = isEdit ? listing?.category : propCategory;
      if (effectiveCategory === "hotel") {
        payload.roomType = form.roomType || null;
        payload.unitCount = parseInt(form.unitCount, 10) || null;
        payload.claimedStarRating = parseInt(form.claimedStarRating, 10) || null;
      }
      if (effectiveCategory === "apartment") {
        payload.bedrooms = form.bedrooms ? parseInt(form.bedrooms, 10) : null;
        payload.bathrooms = form.bathrooms ? parseInt(form.bathrooms, 10) : null;
        payload.maxGuests = parseInt(form.maxGuests, 10) || null;
        payload.longStayEnabled = form.longStayEnabled;
        payload.longStayMinNights = form.longStayEnabled ? parseInt(form.longStayMinNights, 10) || null : null;
        payload.longStayDiscountType = form.longStayEnabled ? form.longStayDiscountType || null : null;
        payload.longStayDiscountValue = form.longStayEnabled ? parseFloat(form.longStayDiscountValue) || null : null;
      }
      if (effectiveCategory === "car") {
        payload.carMake = form.carMake || null;
        payload.carModel = form.carModel || null;
        payload.carYear = parseInt(form.carYear, 10) || null;
        payload.transmission = form.transmission || null;
        payload.fuelType = form.fuelType || null;
        payload.seats = parseInt(form.seats, 10) || null;
        payload.doors = parseInt(form.doors, 10) || null;
        payload.mileagePolicy = form.mileagePolicy || null;
        payload.mileageLimitKm = form.mileagePolicy === "limited" ? parseInt(form.mileageLimitKm, 10) || null : null;
      }
      if (isEdit) {
        await listingApi.patch(`/listings/${listingId}`, payload);
      } else {
        const res = await listingApi.post<{ data: { id: string } }>("/listings", { ...payload, category: effectiveCategory });
        // after creation, navigate to the edit flow for further steps
        router.push(`/listings/${res.data.data.id}/edit`);
      }
    },
  });

  // ── Helpers (geocode, photo upload, doc upload, etc.) – same as original page ──
  async function handleGeocode() {
    if (!form.address.trim()) return;
    setGeocoding(true);
    try {
      const res = await listingApi.get<{ data: any }>(`/geocode?placeId=${encodeURIComponent(form.address)}`);
      const geo = res.data.data;
      setForm((f) => ({
        ...f,
        lat: String(geo.lat ?? ""),
        lng: String(geo.lng ?? ""),
        town: geo.town || f.town,
        country: geo.country || f.country,
      }));
    } catch {
      setError("Could not find this location. Please adjust the address or enter coordinates manually.");
    } finally {
      setGeocoding(false);
    }
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (photos.length >= 30) break;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          setError(`"${file.name}" is not a supported format.`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          setError(`"${file.name}" exceeds 5 MB.`);
          continue;
        }
        const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
          `/listings/${isEdit ? listingId : "new"}/photos/presign`,
          { contentType: file.type, filename: file.name }
        );
        const { uploadUrl, s3Key } = presignRes.data.data;
        await uploadToS3(uploadUrl, file);
        const confirmRes = await listingApi.post<{ data: Photo }>(
          `/listings/${isEdit ? listingId : "new"}/photos/confirm`,
          { s3Key }
        );
        setPhotos((p) => [...p, confirmRes.data.data]);
      }
    } catch {
      setError("Some photos could not be uploaded. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto(photoId: string) {
    try {
      await listingApi.delete(`/listings/${listingId}/photos/${photoId}`);
      setPhotos((p) => p.filter((ph) => ph.id !== photoId));
    } catch {
      setError("Could not remove photo.");
    }
  }

  async function handleDocumentFile(docType: string, file: File) {
    setUploadingDoc(docType);
    setError(null);
    try {
      const contentType = file.type || "application/pdf";
      const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
        `/listings/${listingId}/documents/presign`,
        { contentType, documentType: docType }
      );
      const { uploadUrl, s3Key } = presignRes.data.data;
      await uploadToS3(uploadUrl, file);
      const confirmRes = await listingApi.post<{ data: Document }>(
        `/listings/${listingId}/documents/confirm`,
        { s3Key, documentType: docType, contentType }
      );
      setDocuments((d) => [...d.filter((doc) => doc.documentType !== docType), confirmRes.data.data]);
    } catch {
      setError("Document upload failed. Please try again.");
    } finally {
      setUploadingDoc(null);
    }
  }

  // ── UI helpers ──
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setUpper = (k: keyof FormData, maxLen: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value.toUpperCase().slice(0, maxLen) }));
  const setCheck = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));
  const toggle = (k: keyof FormData, val: string) =>
    setForm((f) => ({ ...f, [k]: (f[k] as string) === val ? "" : val }));
  const toggleAmenity = (key: string) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(key) ? f.amenities.filter((k) => k !== key) : [...f.amenities, key],
    }));

  function addCustom() {
    const val = customInput.trim();
    if (val && !form.customAmenities.includes(val)) {
      setForm((f) => ({ ...f, customAmenities: [...f.customAmenities, val] }));
      setCustomInput("");
    }
  }

  // ── Navigation ──
  async function saveAndNext() {
    setSaving(true);
    setError(null);
    try {
      await saveMutation.mutateAsync();
      if (!isEdit) return; // creation already redirected
      if (!isLastStep) setStep((s) => s + 1);
      else router.push(`/listings/${listingId}/submit`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to save. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render (simplified – full step UI can be extracted to sub‑components) ──
  if (isEdit && isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const amenityOptions = effectiveCategory === "car" ? CAR_FEATURES : effectiveCategory === "apartment" ? APT_AMENITIES : HOTEL_AMENITIES;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Step bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${i === step ? "bg-primary text-white" : i < step ? "text-green-600 font-medium" : "text-gray-500 hover:text-gray-700"}`}
            >
              {i < step && <span>✓</span>}{s}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Render step content – for brevity only step 0 is shown; other steps follow the same pattern as the original edit page */}
        {step === 0 && effectiveCategory === "hotel" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
            <Field label="Property name *"><input className={inp} value={form.name} onChange={set("name")} maxLength={200} placeholder="e.g. Grand Nairobi Hotel" /></Field>
            <Field label="Room type *">
              <div className="flex flex-wrap gap-2">
                {ROOM_TYPES.map((rt) => (
                  <button key={rt.value} type="button" onClick={() => toggle("roomType", rt.value)} className={chip(form.roomType === rt.value)}>{rt.label}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Number of units *"><input className={inp} type="number" min="1" value={form.unitCount} onChange={set("unitCount")} placeholder="e.g. 45" /></Field>
              <Field label="Self‑assessed star rating"><input className={inp} type="number" min="1" max="5" value={form.claimedStarRating} onChange={set("claimedStarRating")} placeholder="1–5" /></Field>
            </div>
            <Field label={`Description (${form.description.length}/1000)`}>
              <textarea className={`${inp} h-28 resize-none`} value={form.description} onChange={set("description")} maxLength={1000} placeholder="Describe your property…" />
            </Field>
          </div>
        )}
        {/* Additional steps would be rendered in a similar fashion – omitted for brevity */}

        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

        <div className="flex gap-3 mt-8">
          {step > 0 && (<button type="button" onClick={() => setStep((s) => s - 1)} className="flex-1 border border-gray-300 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>)}
          <button type="button" onClick={saveAndNext} disabled={saving} className="flex-2 flex-grow bg-primary text-white rounded-xl py-3 text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition">
            {saving ? "Saving…" : isLastStep ? "Review & Submit →" : "Save & Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition";
const chip = (active: boolean) => `px-3 py-1.5 rounded-lg text-sm border transition ${active ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-700 hover:border-primary"}`;
