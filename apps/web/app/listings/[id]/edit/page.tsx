"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listingApi, uploadToS3 } from "@/lib/listing-api";

// ── Step definitions ──────────────────────────────────────────────────────────

const HOTEL_STEPS = ["Basic Info", "Location", "Pricing & Policies", "Amenities", "Photos", "Documents"];
const APT_STEPS   = ["Basic Info", "Location", "Pricing & Policies", "Amenities", "Photos"];
const CAR_STEPS   = ["Vehicle Details", "Pickup Location", "Pricing & Policies", "Features", "Photos"];

function getSteps(category?: string) {
  if (category === "apartment") return APT_STEPS;
  if (category === "car") return CAR_STEPS;
  return HOTEL_STEPS;
}

// ── Static data ───────────────────────────────────────────────────────────────

const ROOM_TYPES = [
  { value: "standard", label: "Standard" }, { value: "superior", label: "Superior" },
  { value: "deluxe", label: "Deluxe" }, { value: "suite", label: "Suite" },
  { value: "junior_suite", label: "Junior Suite" }, { value: "studio", label: "Studio" },
  { value: "family_room", label: "Family Room" }, { value: "presidential_suite", label: "Presidential Suite" },
];

const HOTEL_AMENITIES = [
  { key: "wifi", label: "WiFi" }, { key: "smart_tv", label: "Smart TV" }, { key: "work_desk", label: "Work Desk" },
  { key: "breakfast", label: "Breakfast included" }, { key: "restaurant", label: "Restaurant on-site" }, { key: "minibar", label: "Minibar" },
  { key: "pool", label: "Swimming Pool" }, { key: "gym", label: "Fitness Centre" }, { key: "spa", label: "Spa" },
  { key: "air_conditioning", label: "Air Conditioning" }, { key: "parking", label: "Parking" }, { key: "elevator", label: "Elevator" },
  { key: "accessible", label: "Accessible" }, { key: "reception_24h", label: "24h Reception" }, { key: "housekeeping", label: "Daily Housekeeping" },
  { key: "airport_shuttle", label: "Airport Shuttle" }, { key: "security_24h", label: "24h Security" },
];

const APT_AMENITIES = [
  { key: "wifi", label: "WiFi" }, { key: "kitchen", label: "Full Kitchen" }, { key: "washer", label: "Washing Machine" },
  { key: "dryer", label: "Dryer" }, { key: "smart_tv", label: "Smart TV" }, { key: "work_desk", label: "Work Desk" },
  { key: "air_conditioning", label: "Air Conditioning" }, { key: "heating", label: "Heating" },
  { key: "pool", label: "Swimming Pool" }, { key: "gym", label: "Fitness Centre" }, { key: "parking", label: "Parking" },
  { key: "elevator", label: "Elevator" }, { key: "accessible", label: "Accessible" }, { key: "balcony", label: "Balcony / Terrace" },
  { key: "security_24h", label: "24h Security" }, { key: "baby_cot", label: "Baby Cot Available" }, { key: "bbq", label: "BBQ Area" },
];

const CAR_FEATURES = [
  { key: "gps", label: "GPS Navigation" }, { key: "bluetooth", label: "Bluetooth" }, { key: "usb_charging", label: "USB Charging" },
  { key: "air_conditioning", label: "Air Conditioning" }, { key: "backup_camera", label: "Backup Camera" },
  { key: "sunroof", label: "Sunroof" }, { key: "child_seat", label: "Child Seat Available" }, { key: "roof_rack", label: "Roof Rack" },
  { key: "leather_seats", label: "Leather Seats" }, { key: "heated_seats", label: "Heated Seats" },
  { key: "carplay", label: "Apple CarPlay / Android Auto" }, { key: "full_insurance", label: "Full Insurance Included" },
];

const DOC_TYPES = [
  { key: "business_licence", label: "Business Licence" },
  { key: "operating_permit", label: "Hotel Operating Permit" },
  { key: "tourism_certificate", label: "Tourism Authority Certificate" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  // common
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
  carMake: "", carModel: "", carYear: "", transmission: "", fuelType: "",
  seats: "", doors: "4", mileagePolicy: "", mileageLimitKm: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
  });

  useEffect(() => {
    if (!listing) return;
    setForm({
      name: listing.name ?? "", description: listing.description ?? "",
      address: listing.address ?? "", lat: listing.lat?.toString() ?? "",
      lng: listing.lng?.toString() ?? "", town: listing.town ?? "", country: listing.country ?? "",
      pricePerNight: listing.pricePerNight?.toString() ?? "", currency: listing.currency ?? "USD",
      minStayNights: listing.minStayNights?.toString() ?? "1",
      checkinTime: listing.checkinTime ?? "", checkoutTime: listing.checkoutTime ?? "",
      cancellationPolicy: listing.cancellationPolicy ?? "",
      smokingAllowed: listing.smokingAllowed ?? false, petsAllowed: listing.petsAllowed ?? false,
      amenities: listing.amenities?.map((a: any) => a.amenityKey) ?? [],
      customAmenities: listing.customAmenities?.map((a: any) => a.label) ?? [],
      // hotel
      roomType: listing.roomType ?? "", unitCount: listing.unitCount?.toString() ?? "",
      claimedStarRating: listing.claimedStarRating?.toString() ?? "",
      // apartment
      bedrooms: listing.bedrooms?.toString() ?? "", bathrooms: listing.bathrooms?.toString() ?? "",
      maxGuests: listing.maxGuests?.toString() ?? "",
      longStayEnabled: listing.longStayEnabled ?? false,
      longStayMinNights: listing.longStayMinNights?.toString() ?? "",
      longStayDiscountType: listing.longStayDiscountType ?? "",
      longStayDiscountValue: listing.longStayDiscountValue?.toString() ?? "",
      // car
      carMake: listing.carMake ?? "", carModel: listing.carModel ?? "",
      carYear: listing.carYear?.toString() ?? "", transmission: listing.transmission ?? "",
      fuelType: listing.fuelType ?? "", seats: listing.seats?.toString() ?? "",
      doors: listing.doors?.toString() ?? "4", mileagePolicy: listing.mileagePolicy ?? "",
      mileageLimitKm: listing.mileageLimitKm?.toString() ?? "",
    });
    setPhotos(listing.photos ?? []);
    setDocuments(listing.documents ?? []);
  }, [listing]);

  const category = listing?.category as string | undefined;
  const steps = getSteps(category);
  const isLastStep = step === steps.length - 1;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name || null, description: form.description || null,
        address: form.address || null,
        lat: parseFloat(form.lat) || null, lng: parseFloat(form.lng) || null,
        town: form.town || null, country: form.country || null,
        pricePerNight: parseFloat(form.pricePerNight) || null,
        currency: form.currency || null,
        minStayNights: parseInt(form.minStayNights, 10) || 1,
        checkinTime: form.checkinTime || null, checkoutTime: form.checkoutTime || null,
        cancellationPolicy: form.cancellationPolicy || null,
        smokingAllowed: form.smokingAllowed, petsAllowed: form.petsAllowed,
        amenities: form.amenities, customAmenities: form.customAmenities,
      };

      if (category === "hotel") {
        payload.roomType = form.roomType || null;
        payload.unitCount = parseInt(form.unitCount, 10) || null;
        payload.claimedStarRating = parseInt(form.claimedStarRating, 10) || null;
      }

      if (category === "apartment") {
        payload.bedrooms = form.bedrooms !== "" ? parseInt(form.bedrooms, 10) : null;
        payload.bathrooms = form.bathrooms !== "" ? parseInt(form.bathrooms, 10) : null;
        payload.maxGuests = parseInt(form.maxGuests, 10) || null;
        payload.longStayEnabled = form.longStayEnabled;
        payload.longStayMinNights = form.longStayEnabled ? parseInt(form.longStayMinNights, 10) || null : null;
        payload.longStayDiscountType = form.longStayEnabled ? form.longStayDiscountType || null : null;
        payload.longStayDiscountValue = form.longStayEnabled ? parseFloat(form.longStayDiscountValue) || null : null;
      }

      if (category === "car") {
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

      await listingApi.patch(`/listings/${id}`, payload);
    },
  });

  async function saveAndNext() {
    setSaving(true); setError(null);
    try {
      await saveMutation.mutateAsync();
      if (!isLastStep) setStep((s) => s + 1);
      else router.push(`/listings/${id}/submit`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to save. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGeocode() {
    if (!form.address.trim()) return;
    setGeocoding(true);
    try {
      const res = await listingApi.get<{ data: any }>(`/geocode?placeId=${encodeURIComponent(form.address)}`);
      const geo = res.data.data;
      setForm((f) => ({ ...f, lat: String(geo.lat ?? ""), lng: String(geo.lng ?? ""), town: geo.town || f.town, country: geo.country || f.country }));
    } catch {
      setError("Could not find this location. Please adjust the address or enter coordinates manually.");
    } finally {
      setGeocoding(false);
    }
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files) return;
    setUploadingPhoto(true); setError(null);
    try {
      for (const file of Array.from(files)) {
        if (photos.length >= 30) break;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(`"${file.name}" is not a supported format.`); continue; }
        if (file.size > 5 * 1024 * 1024) { setError(`"${file.name}" exceeds 5 MB.`); continue; }
        const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(`/listings/${id}/photos/presign`, { contentType: file.type, filename: file.name });
        const { uploadUrl, s3Key } = presignRes.data.data;
        await uploadToS3(uploadUrl, file);
        const confirmRes = await listingApi.post<{ data: Photo }>(`/listings/${id}/photos/confirm`, { s3Key });
        setPhotos((p) => [...p, confirmRes.data.data]);
      }
    } catch { setError("Some photos could not be uploaded. Please try again."); }
    finally { setUploadingPhoto(false); }
  }

  async function deletePhoto(photoId: string) {
    try {
      await listingApi.delete(`/listings/${id}/photos/${photoId}`);
      setPhotos((p) => p.filter((ph) => ph.id !== photoId));
    } catch { setError("Could not remove photo."); }
  }

  async function handleDocumentFile(docType: string, file: File) {
    setUploadingDoc(docType); setError(null);
    try {
      const contentType = file.type || "application/pdf";
      const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(`/listings/${id}/documents/presign`, { contentType, documentType: docType });
      const { uploadUrl, s3Key } = presignRes.data.data;
      await uploadToS3(uploadUrl, file);
      const confirmRes = await listingApi.post<{ data: Document }>(`/listings/${id}/documents/confirm`, { s3Key, documentType: docType, contentType });
      setDocuments((d) => [...d.filter((doc) => doc.documentType !== docType), confirmRes.data.data]);
    } catch { setError("Document upload failed. Please try again."); }
    finally { setUploadingDoc(null); }
  }

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setUpper = (k: keyof FormData, maxLen: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value.toUpperCase().slice(0, maxLen) }));
  const setCheck = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));
  const toggle = (k: keyof FormData, val: string) =>
    setForm((f) => ({ ...f, [k]: f[k] === val ? "" : val }));
  const toggleAmenity = (key: string) =>
    setForm((f) => ({ ...f, amenities: f.amenities.includes(key) ? f.amenities.filter((k) => k !== key) : [...f.amenities, key] }));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const amenityOptions = category === "car" ? CAR_FEATURES : category === "apartment" ? APT_AMENITIES : HOTEL_AMENITIES;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Step bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${i === step ? "bg-primary text-white" : i < step ? "text-green-600 font-medium" : "text-gray-500 hover:text-gray-700"}`}>
              {i < step && <span>✓</span>}
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {listing?.status === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="font-semibold text-red-800 mb-1">Rejected — address feedback before resubmitting</p>
            <p className="text-sm text-red-700">{listing.rejectionReasons?.join(", ")}</p>
            {listing.rejectionNote && <p className="text-sm text-red-700 mt-1">{listing.rejectionNote}</p>}
          </div>
        )}

        {/* ── STEP 0: Basic Info ─────────────────────────────────────────── */}
        {step === 0 && category === "hotel" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
            <Field label="Property name *"><input className={inp} value={form.name} onChange={set("name")} maxLength={200} placeholder="e.g. Grand Nairobi Hotel" /></Field>
            <Field label="Room type *">
              <div className="flex flex-wrap gap-2">
                {ROOM_TYPES.map((rt) => (
                  <button key={rt.value} type="button" onClick={() => toggle("roomType", rt.value)}
                    className={chip(form.roomType === rt.value)}>{rt.label}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Number of units *"><input className={inp} type="number" min="1" value={form.unitCount} onChange={set("unitCount")} placeholder="e.g. 45" /></Field>
              <Field label="Self-assessed star rating"><input className={inp} type="number" min="1" max="5" value={form.claimedStarRating} onChange={set("claimedStarRating")} placeholder="1–5" /></Field>
            </div>
            <Field label={`Description (${form.description.length}/1000)`}>
              <textarea className={`${inp} h-28 resize-none`} value={form.description} onChange={set("description")} maxLength={1000} placeholder="Describe your property…" />
            </Field>
          </div>
        )}

        {step === 0 && category === "apartment" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
            <Field label="Listing title *"><input className={inp} value={form.name} onChange={set("name")} maxLength={200} placeholder="e.g. Cozy Studio in Westlands" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Bedrooms (0 = studio)"><input className={inp} type="number" min="0" value={form.bedrooms} onChange={set("bedrooms")} placeholder="0" /></Field>
              <Field label="Bathrooms"><input className={inp} type="number" min="0" value={form.bathrooms} onChange={set("bathrooms")} placeholder="1" /></Field>
              <Field label="Max guests *"><input className={inp} type="number" min="1" value={form.maxGuests} onChange={set("maxGuests")} placeholder="4" /></Field>
            </div>
            <Field label={`Description (${form.description.length}/1000)`}>
              <textarea className={`${inp} h-28 resize-none`} value={form.description} onChange={set("description")} maxLength={1000} placeholder="Describe the apartment, neighbourhood, nearby attractions…" />
            </Field>
          </div>
        )}

        {step === 0 && category === "car" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Vehicle Details</h2>
            <Field label="Listing title *"><input className={inp} value={form.name} onChange={set("name")} maxLength={200} placeholder="e.g. Toyota Camry 2022 — Automatic" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Make *"><input className={inp} value={form.carMake} onChange={set("carMake")} placeholder="e.g. Toyota" /></Field>
              <Field label="Model *"><input className={inp} value={form.carModel} onChange={set("carModel")} placeholder="e.g. Camry" /></Field>
              <Field label="Year *"><input className={inp} type="number" min="1990" max="2026" value={form.carYear} onChange={set("carYear")} placeholder="2022" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Transmission *">
                <div className="flex gap-2">
                  {["manual", "automatic"].map((t) => (
                    <button key={t} type="button" onClick={() => toggle("transmission", t)}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition ${form.transmission === t ? "bg-primary text-white border-primary" : "border-gray-300 hover:border-primary"}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Fuel type">
                <div className="flex flex-wrap gap-2">
                  {["petrol", "diesel", "electric", "hybrid"].map((f) => (
                    <button key={f} type="button" onClick={() => toggle("fuelType", f)}
                      className={chip(form.fuelType === f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Seats *"><input className={inp} type="number" min="1" max="20" value={form.seats} onChange={set("seats")} placeholder="5" /></Field>
              <Field label="Doors"><input className={inp} type="number" min="2" max="6" value={form.doors} onChange={set("doors")} placeholder="4" /></Field>
            </div>
            <Field label={`Description (${form.description.length}/1000)`}>
              <textarea className={`${inp} h-24 resize-none`} value={form.description} onChange={set("description")} maxLength={1000} placeholder="Describe the vehicle, condition, any extras included…" />
            </Field>
          </div>
        )}

        {/* ── STEP 1: Location ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">{category === "car" ? "Pickup Location" : "Location"}</h2>
            <Field label={category === "car" ? "Pickup address *" : "Address *"}>
              <div className="flex gap-2">
                <input className={`${inp} flex-1`} value={form.address} onChange={set("address")} placeholder="Start typing your address…" />
                <button type="button" onClick={handleGeocode} disabled={geocoding}
                  className="px-4 py-2.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark disabled:opacity-60 whitespace-nowrap">
                  {geocoding ? "Finding…" : "Find Location"}
                </button>
              </div>
              {form.lat && form.lng && <p className="text-xs text-green-600 mt-1">Coordinates: {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Town / City"><input className={inp} value={form.town} onChange={set("town")} placeholder="e.g. Nairobi" /></Field>
              <Field label="Country code"><input className={inp} value={form.country} onChange={setUpper("country", 2)} placeholder="e.g. KE" maxLength={2} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Latitude"><input className={inp} value={form.lat} onChange={set("lat")} placeholder="e.g. -1.286389" /></Field>
              <Field label="Longitude"><input className={inp} value={form.lng} onChange={set("lng")} placeholder="e.g. 36.817223" /></Field>
            </div>
          </div>
        )}

        {/* ── STEP 2: Pricing & Policies ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Pricing & Policies</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Price per ${category === "car" ? "day" : "night"} *`}>
                <input className={inp} type="number" step="0.01" min="0.01" value={form.pricePerNight} onChange={set("pricePerNight")} placeholder="120.00" />
              </Field>
              <Field label="Currency *"><input className={inp} value={form.currency} onChange={setUpper("currency", 3)} maxLength={3} placeholder="USD" /></Field>
            </div>

            {category !== "car" && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Min. stay (nights)"><input className={inp} type="number" min="1" value={form.minStayNights} onChange={set("minStayNights")} /></Field>
                <Field label="Check-in"><input className={inp} type="time" value={form.checkinTime} onChange={set("checkinTime")} /></Field>
                <Field label="Check-out"><input className={inp} type="time" value={form.checkoutTime} onChange={set("checkoutTime")} /></Field>
              </div>
            )}

            {category === "car" && (
              <div className="space-y-3">
                <Field label="Mileage policy *">
                  <div className="flex gap-3">
                    {[{ v: "unlimited", l: "Unlimited mileage" }, { v: "limited", l: "Limited mileage" }].map(({ v, l }) => (
                      <button key={v} type="button" onClick={() => toggle("mileagePolicy", v)}
                        className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition ${form.mileagePolicy === v ? "bg-primary text-white border-primary" : "border-gray-300 hover:border-primary"}`}>{l}</button>
                    ))}
                  </div>
                </Field>
                {form.mileagePolicy === "limited" && (
                  <Field label="Mileage limit (km/day)">
                    <input className={inp} type="number" min="1" value={form.mileageLimitKm} onChange={set("mileageLimitKm")} placeholder="e.g. 200" />
                  </Field>
                )}
              </div>
            )}

            <Field label="Cancellation policy *">
              <div className="flex gap-3">
                {["flexible", "moderate", "strict"].map((p) => (
                  <button key={p} type="button" onClick={() => toggle("cancellationPolicy", p)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition ${form.cancellationPolicy === p ? "bg-primary text-white border-primary" : "border-gray-300 hover:border-primary"}`}>{p}</button>
                ))}
              </div>
            </Field>

            {category !== "car" && (
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.smokingAllowed} onChange={setCheck("smokingAllowed")} className="w-4 h-4 accent-primary" />
                  <span className="text-sm text-gray-700">Smoking allowed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.petsAllowed} onChange={setCheck("petsAllowed")} className="w-4 h-4 accent-primary" />
                  <span className="text-sm text-gray-700">Pets allowed</span>
                </label>
              </div>
            )}

            {/* Long-stay discount — apartments only */}
            {category === "apartment" && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.longStayEnabled} onChange={setCheck("longStayEnabled")} className="w-4 h-4 accent-primary" />
                  <span className="font-medium text-gray-900 text-sm">Offer long-stay discount</span>
                </label>
                {form.longStayEnabled && (
                  <div className="grid grid-cols-3 gap-4 pt-1">
                    <Field label="Min. nights for discount">
                      <input className={inp} type="number" min="1" value={form.longStayMinNights} onChange={set("longStayMinNights")} placeholder="7" />
                    </Field>
                    <Field label="Discount type">
                      <div className="flex gap-2">
                        {["percentage", "fixed"].map((t) => (
                          <button key={t} type="button" onClick={() => toggle("longStayDiscountType", t)}
                            className={`flex-1 py-2.5 rounded-lg border text-sm capitalize transition ${form.longStayDiscountType === t ? "bg-primary text-white border-primary" : "border-gray-300 hover:border-primary"}`}>{t}</button>
                        ))}
                      </div>
                    </Field>
                    <Field label={form.longStayDiscountType === "percentage" ? "Discount %" : "Discount amount"}>
                      <input className={inp} type="number" min="0.01" step="0.01" value={form.longStayDiscountValue} onChange={set("longStayDiscountValue")} placeholder={form.longStayDiscountType === "percentage" ? "10" : "50"} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Amenities / Features ──────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">{category === "car" ? "Features & Extras" : "Services & Amenities"}</h2>
            <p className="text-sm text-gray-500">{form.amenities.length} selected</p>
            <div className="flex flex-wrap gap-2">
              {amenityOptions.map((a) => (
                <button key={a.key} type="button" onClick={() => toggleAmenity(a.key)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${form.amenities.includes(a.key) ? "bg-primary/10 border-primary text-primary" : "border-gray-300 text-gray-600 hover:border-primary"}`}>
                  {a.label}
                </button>
              ))}
            </div>
            <Field label="Custom item">
              <div className="flex gap-2">
                <input className={`${inp} flex-1`} value={customInput} onChange={(e) => setCustomInput(e.target.value.slice(0, 60))} placeholder={category === "car" ? "e.g. Dashcam" : "e.g. Rooftop bar"} maxLength={60}
                  onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} />
                <button type="button" className="px-4 py-2.5 border border-primary text-primary text-sm rounded-lg hover:bg-primary/5" onClick={addCustom}>Add</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.customAmenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-700">
                    {a}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, customAmenities: f.customAmenities.filter((x) => x !== a) }))} className="text-gray-400 hover:text-gray-600 ml-1">×</button>
                  </span>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* ── STEP 4: Photos ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Photos</h2>
            <p className="text-sm text-gray-500">
              {category === "hotel" ? "At least 1 photo required." : "At least 3 photos required."} Up to 30 total. First photo is your cover. JPEG, PNG, WEBP. Max 5 MB each.
            </p>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handlePhotoFiles(e.target.files)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto || photos.length >= 30}
              className="w-full border-2 border-dashed border-primary rounded-xl py-8 text-primary font-medium hover:bg-primary/5 disabled:opacity-50 transition">
              {uploadingPhoto ? "Uploading…" : `+ Add photos (${photos.length}/30)`}
            </button>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {photos.map((p, i) => (
                  <div key={p.id} className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video flex items-center justify-center border border-gray-200">
                    {i === 0 && <span className="absolute top-1 left-1 bg-primary text-white text-xs px-2 py-0.5 rounded-full font-medium z-10">Cover</span>}
                    <span className="text-xs text-gray-400 px-2 text-center truncate">{p.cdnUrl.split("/").pop()}</span>
                    <button type="button" onClick={() => deletePhoto(p.id)}
                      className="absolute top-1 right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-red-500 text-xs border border-gray-200 z-10">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: Documents (hotels only) ───────────────────────────── */}
        {step === 5 && category === "hotel" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Accreditation Documents</h2>
            <p className="text-sm text-gray-500">All 3 documents are required before you can submit. PDF, JPEG, PNG, or WEBP. Max 10 MB each.</p>
            {DOC_TYPES.map((doc) => {
              const uploaded = documents.find((d) => d.documentType === doc.key);
              const isUp = uploadingDoc === doc.key;
              return (
                <div key={doc.key} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{doc.label}</p>
                    <p className={`text-xs mt-0.5 ${uploaded ? "text-green-600" : "text-gray-400"}`}>{uploaded ? "✓ Uploaded" : "Not uploaded"}</p>
                  </div>
                  <label className={`px-4 py-2 text-sm border rounded-lg cursor-pointer transition ${isUp ? "opacity-50" : "border-primary text-primary hover:bg-primary/5"}`}>
                    {isUp ? "Uploading…" : uploaded ? "Replace" : "Upload"}
                    <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocumentFile(doc.key, f); }} />
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

        {/* Nav buttons */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="flex-1 border border-gray-300 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
          )}
          <button type="button" onClick={saveAndNext} disabled={saving}
            className="flex-2 flex-grow bg-primary text-white rounded-xl py-3 text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition">
            {saving ? "Saving…" : isLastStep
              ? category === "hotel" ? "Review & Submit →" : "Review & Activate →"
              : "Save & Continue →"}
          </button>
        </div>
      </div>
    </div>
  );

  function addCustom() {
    const val = customInput.trim();
    if (val && !form.customAmenities.includes(val)) {
      setForm((f) => ({ ...f, customAmenities: [...f.customAmenities, val] }));
      setCustomInput("");
    }
  }
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
