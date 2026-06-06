"use client";

/**
 * ApartmentForm — Apartment-only listing form.
 * Payload contains ONLY apartment fields. No hotel or car fields ever reach the API.
 * Steps: Property Info → Pricing & Policies → Property Details → Media
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, CheckCircle, AlertCircle } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/provider";
import { FormShell, type FormStep } from "./shared/FormShell";
import { GeocodedAddressFields } from "./shared/GeocodedAddressFields";
import { AMENITY_OPTIONS, groupAmenities, flattenGroupedAmenities } from "./shared/amenities";
import { MediaUploader, type ExistingPhoto } from "../../../components/MediaUploader";
import {
  DiscountSection,
  initDiscountState,
  appendDiscountPayload,
  validateDiscount,
  type DiscountState,
  type DiscountField,
} from "./shared/DiscountSection";

// ── Enums ────────────────────────────────────────────────────────────────────

const APARTMENT_TYPES = [
  { value: "entire_place",  label: "Entire Place" },
  { value: "private_room",  label: "Private Room" },
  { value: "shared_room",   label: "Shared Room" },
  { value: "studio",        label: "Studio" },
  { value: "loft",          label: "Loft" },
  { value: "villa",         label: "Villa" },
  { value: "townhouse",     label: "Townhouse" },
];

const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible – free cancellation up to 24 h" },
  { value: "moderate", label: "Moderate – free cancellation up to 5 days" },
  { value: "strict",   label: "Strict – no refund within 14 days" },
];

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "ZAR", label: "ZAR (R)" },
];

const LONG_STAY_TYPES = [
  { value: "percentage", label: "Percentage (%)" },
  { value: "fixed",      label: "Fixed Amount" },
];

// ── State type ───────────────────────────────────────────────────────────────

type ApartmentState = {
  name: string;
  apartmentType: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  town: string;
  country: string;
  pricePerNight: string;
  currency: string;
  minStayNights: string;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  cleaningFee: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  bedrooms: string;
  bathrooms: string;
  maxGuests: string;
  floorNumber: string;
  propertySizeM2: string;
  extraGuestFee: string;
  extraGuestAfter: string;
  weeklyDiscount: string;
  monthlyDiscount: string;
  instantBooking: boolean;
  selfCheckin: boolean;
  selfCheckinDetails: string;
  longStayEnabled: boolean;
  longStayMinNights: string;
  longStayDiscountType: string;
  longStayDiscountValue: string;
  selectedAmenities: string[];
  customAmenities: string[];
  customInput: string;
} & DiscountState;

function initState(l: Listing): ApartmentState {
  const a = l as any;
  return {
    name:                l.name              ?? "",
    apartmentType:       a.apartmentType     ?? "entire_place",
    description:         l.description       ?? "",
    address:             l.address           ?? "",
    lat:                 a.lat               ?? null,
    lng:                 a.lng               ?? null,
    town:                l.town              ?? "",
    country:             l.country           ?? "",
    pricePerNight:       l.pricePerNight ? String(l.pricePerNight) : "",
    currency:            l.currency          ?? "USD",
    minStayNights:       l.minStayNights ? String(l.minStayNights) : "1",
    checkinTime:         l.checkinTime       ?? "14:00",
    checkoutTime:        l.checkoutTime      ?? "11:00",
    cancellationPolicy:  l.cancellationPolicy ?? "flexible",
    cleaningFee:         a.cleaningFee       != null ? String(a.cleaningFee) : "",
    smokingAllowed:      l.smokingAllowed    ?? false,
    petsAllowed:         l.petsAllowed       ?? false,
    bedrooms:            l.bedrooms          != null ? String(l.bedrooms)  : "",
    bathrooms:           l.bathrooms         != null ? String(l.bathrooms) : "",
    maxGuests:           l.maxGuests         != null ? String(l.maxGuests) : "",
    floorNumber:         a.floorNumber       != null ? String(a.floorNumber)    : "",
    propertySizeM2:      a.propertySizeM2    != null ? String(a.propertySizeM2) : "",
    extraGuestFee:       a.extraGuestFee     != null ? String(a.extraGuestFee)  : "",
    extraGuestAfter:     a.extraGuestAfter   != null ? String(a.extraGuestAfter) : "",
    weeklyDiscount:      a.weeklyDiscount    != null ? String(a.weeklyDiscount)  : "",
    monthlyDiscount:     a.monthlyDiscount   != null ? String(a.monthlyDiscount) : "",
    instantBooking:      a.instantBooking    ?? false,
    selfCheckin:         a.selfCheckin       ?? false,
    selfCheckinDetails:  a.selfCheckinDetails ?? "",
    longStayEnabled:     l.longStayEnabled   ?? false,
    longStayMinNights:   l.longStayMinNights != null ? String(l.longStayMinNights)  : "30",
    longStayDiscountType: l.longStayDiscountType ?? "percentage",
    longStayDiscountValue: a.longStayDiscountValue != null ? String(a.longStayDiscountValue) : "",
    selectedAmenities:   flattenGroupedAmenities(a.amenities),
    customAmenities:     (a.customAmenities ?? []).map((x: any) => typeof x === "string" ? x : (x?.label ?? "")),
    customInput:         "",
    ...initDiscountState(a),
  };
}

// ── Payload builder — APARTMENT FIELDS ONLY ──────────────────────────────────

function buildPayload(s: ApartmentState): Record<string, unknown> {
  const p: Record<string, unknown> = {};

  if (s.name.trim())       p.name         = s.name.trim();
  if (s.apartmentType)     p.apartmentType = s.apartmentType;
  if (s.description.trim()) p.description = s.description.trim();
  if (s.address.trim())    p.address      = s.address.trim();
  if (s.lat !== null)      p.lat          = s.lat;
  if (s.lng !== null)      p.lng          = s.lng;
  if (s.town.trim())       p.town         = s.town.trim();
  if (s.country.trim())    p.country      = s.country.trim();

  const price = Number(s.pricePerNight);
  if (price > 0)           p.pricePerNight = price;
  if (s.currency)          p.currency     = s.currency;

  const nights = Number(s.minStayNights);
  if (nights >= 1)         p.minStayNights = nights;
  if (s.checkinTime)       p.checkinTime  = s.checkinTime;
  if (s.checkoutTime)      p.checkoutTime = s.checkoutTime;
  if (s.cancellationPolicy) p.cancellationPolicy = s.cancellationPolicy;

  const cleaning = Number(s.cleaningFee);
  if (cleaning >= 0 && s.cleaningFee !== "") p.cleaningFee = cleaning;

  p.smokingAllowed = s.smokingAllowed;
  p.petsAllowed    = s.petsAllowed;

  // apartment-specific specs
  if (s.bedrooms  !== "")  p.bedrooms  = Number(s.bedrooms);
  if (s.bathrooms !== "")  p.bathrooms = Number(s.bathrooms);
  const guests = Number(s.maxGuests);
  if (guests >= 1)         p.maxGuests = guests;

  if (s.floorNumber !== "")     p.floorNumber    = Number(s.floorNumber);
  if (s.propertySizeM2 !== "")  p.propertySizeM2 = Number(s.propertySizeM2);
  if (s.extraGuestFee !== "")   p.extraGuestFee  = Number(s.extraGuestFee);
  if (s.extraGuestAfter !== "") p.extraGuestAfter = Number(s.extraGuestAfter);
  if (s.weeklyDiscount !== "")  p.weeklyDiscount  = Number(s.weeklyDiscount);
  if (s.monthlyDiscount !== "") p.monthlyDiscount = Number(s.monthlyDiscount);

  p.instantBooking = s.instantBooking;
  p.selfCheckin    = s.selfCheckin;
  if (s.selfCheckin && s.selfCheckinDetails.trim()) {
    p.selfCheckinDetails = s.selfCheckinDetails.trim();
  }

  // long-stay: only include when enabled with valid positive value
  p.longStayEnabled = s.longStayEnabled;
  if (s.longStayEnabled) {
    const lsNights = Number(s.longStayMinNights);
    if (lsNights >= 1)            p.longStayMinNights    = lsNights;
    if (s.longStayDiscountType)   p.longStayDiscountType = s.longStayDiscountType;
    const lsVal = Number(s.longStayDiscountValue);
    if (lsVal > 0)                p.longStayDiscountValue = lsVal;
  }

  p.amenities       = groupAmenities(s.selectedAmenities);
  p.customAmenities = s.customAmenities;
  appendDiscountPayload(p, s);

  return p;
}

// ── Step validation ──────────────────────────────────────────────────────────

type Step = "property" | "pricing" | "details" | "media";

function validateStep(step: Step, s: ApartmentState): string[] {
  switch (step) {
    case "property":
      return [
        !s.name.trim()    && "Apartment name is required.",
        !s.address.trim() && "Address is required.",
        !s.town.trim()    && "Town / City is required — geocode the address.",
        !s.country.trim() && "Country code is required — geocode the address.",
      ].filter(Boolean) as string[];
    case "pricing":
      return [
        !(Number(s.pricePerNight) > 0) && "Price per night must be greater than 0.",
        !s.currency                    && "Currency is required.",
        !(Number(s.minStayNights) >= 1) && "Minimum stay must be at least 1 night.",
        !s.checkinTime                 && "Check-in time is required.",
        !s.checkoutTime                && "Check-out time is required.",
        !s.cancellationPolicy          && "Cancellation policy is required.",
        // Discount validation — only blocks when discount is enabled
        ...validateDiscount(s, s.pricePerNight),
      ].filter(Boolean) as string[];
    case "details":
      return [
        !(Number(s.maxGuests) >= 1) && "Maximum guests must be at least 1.",
        s.bedrooms  !== "" && Number(s.bedrooms)  < 0 && "Bedrooms cannot be negative.",
        s.bathrooms !== "" && Number(s.bathrooms) < 0 && "Bathrooms cannot be negative.",
        s.longStayEnabled && !(Number(s.longStayMinNights) >= 1)       && "Long-stay minimum nights must be ≥ 1.",
        s.longStayEnabled && !s.longStayDiscountType                    && "Long-stay discount type is required.",
        s.longStayEnabled && !(Number(s.longStayDiscountValue) > 0)    && "Long-stay discount value must be > 0.",
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

const STEPS: FormStep[] = [
  { id: "property", label: "Property Info",      sublabel: "Name, type & location" },
  { id: "pricing",  label: "Pricing & Policies", sublabel: "Rates, times & cancellation" },
  { id: "details",  label: "Property Details",   sublabel: "Specs, guests & amenities" },
  { id: "media",    label: "Media",              sublabel: "Photos (min 3 required)" },
];

const apiErr = (e: any) => {
  const err = e?.response?.data?.error;
  if (err?.details && typeof err.details === "object") {
    const details = Object.entries(err.details)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    return `${err.message || "Validation Error"}: ${details}`;
  }
  return err?.message ?? e?.message ?? "An error occurred.";
};

// ── Component ────────────────────────────────────────────────────────────────

interface Props { listingId: string; listing: Listing; }

export function ApartmentForm({ listingId, listing }: Props) {
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: current } = useQuery<any>({
    queryKey:    ["listing-edit", listingId],
    queryFn:     () => listingApi.get(`/listings/${listingId}`).then((r) => r.data.data ?? r.data),
    initialData: listing,
    staleTime:   30_000,
  });

  const [s, setS]         = useState<ApartmentState>(() => initState(listing));
  const [step, setStep]   = useState<Step>("property");
  const [ok, setOk]       = useState("");
  const [err, setErr]     = useState("");
  const [tried, setTried] = useState(false);

  const set = (k: keyof ApartmentState, v: unknown) => setS((p) => ({ ...p, [k]: v }));

  const isComplete = (id: string) => validateStep(id as Step, s).length === 0;
  const isLocked   = (id: string) => {
    const idx = STEPS.findIndex((t) => t.id === id);
    if (idx <= 0) return false;
    return STEPS.slice(0, idx).some((t) => !isComplete(t.id));
  };

  const flash = (msg: string, type: "ok" | "err") => {
    if (type === "ok") { setOk(msg); setErr(""); setTimeout(() => setOk(""), 3500); }
    else               { setErr(msg); setOk(""); }
  };

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["listing-edit", listingId] });
    qc.invalidateQueries({ queryKey: ["provider-listings"] });
  };

  const saveMut = useMutation({
    mutationFn: () => listingApi.patch(`/listings/${listingId}`, buildPayload(s)),
    onSuccess:  () => { refetch(); flash("Changes saved.", "ok"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  const activateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/activate`),
    onSuccess:  (r: any) => { refetch(); flash(r.data?.data?.message ?? "Listing is now live!", "ok"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  const deactivateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/deactivate`),
    onSuccess:  () => { refetch(); flash("Listing deactivated.", "ok"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateStep(step, s);
    if (errs.length) { setTried(true); flash(errs[0]!, "err"); return; }
    setTried(false); setErr("");
    saveMut.mutate(undefined, {
      onSuccess: () => {
        const idx  = STEPS.findIndex((t) => t.id === step);
        const next = STEPS[idx + 1];
        if (next) setStep(next.id as Step);
      },
    });
  };

  const addCustom = () => {
    const v = s.customInput.trim();
    if (v && !s.customAmenities.includes(v)) {
      set("customAmenities", [...s.customAmenities, v]);
      set("customInput", "");
    }
  };

  const photos: ExistingPhoto[] = (current?.photos ?? []) as ExistingPhoto[];
  const status = current?.status ?? listing.status;
  const title  = current?.name  ?? listing.name ?? "Untitled Apartment";

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/listings")}
          className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center text-slate-600 hover:bg-surface-muted transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Apartment Listing</p>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>
        <div className="ml-auto"><Badge label={status} status={status} /></div>
      </div>

      {ok  && <div className="flex items-center gap-2 rounded-2xl bg-success-50 border border-success/20 px-4 py-3 text-sm text-success-dark"><CheckCircle className="w-4 h-4 text-success shrink-0" />{ok}</div>}
      {err && <div className="flex items-center gap-2 rounded-2xl bg-danger-50  border border-danger/20  px-4 py-3 text-sm text-danger-dark" ><AlertCircle className="w-4 h-4 text-danger shrink-0"  />{err}</div>}

      <FormShell
        steps={STEPS}
        activeStep={step}
        status={status}
        onStepClick={(id) => { setTried(false); setStep(id as Step); }}
        isComplete={isComplete}
        isLocked={isLocked}
      >
        <form onSubmit={handleNext} className="space-y-5">
          <Card className="min-h-[420px]">

            {/* ── Property step ── */}
            {step === "property" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Property Information</h3>
                <Input
                  label="Listing Title"
                  value={s.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="E.g., Cozy Studio near City Centre"
                  required
                  error={tried && !s.name.trim() ? "Title is required." : undefined}
                />
                <Select
                  label="Property Type"
                  value={s.apartmentType}
                  onChange={(e) => set("apartmentType", e.target.value)}
                  options={APARTMENT_TYPES}
                />
                <div>
                  <Textarea
                    label="Description"
                    value={s.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Describe your property (max 1000 characters)"
                    rows={4}
                    maxLength={1000}
                  />
                  <p className="text-xs text-slate-400 text-right mt-1">{s.description.length} / 1000</p>
                </div>
                <GeocodedAddressFields
                  address={s.address}
                  town={s.town}
                  country={s.country}
                  onChange={(f, v) => set(f, f === "country" ? v.toUpperCase().slice(0, 2) : v)}
                  onGeocoded={(r) => setS((p) => ({ ...p, lat: r.lat, lng: r.lng, town: r.town, country: r.country }))}
                  errors={tried ? {
                    address: !s.address.trim() ? "Address is required." : undefined,
                    town:    !s.town.trim()    ? "Town is required."    : undefined,
                    country: !s.country.trim() ? "Country is required." : undefined,
                  } : undefined}
                />
              </div>
            )}

            {/* ── Pricing step ── */}
            {step === "pricing" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Pricing & Policies</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Price per Night"
                    type="number" step="0.01" min="0.01"
                    value={s.pricePerNight}
                    onChange={(e) => set("pricePerNight", e.target.value)}
                    required
                    error={tried && !(Number(s.pricePerNight) > 0) ? "Price must be > 0." : undefined}
                  />
                  <Select label="Currency" value={s.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCIES} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Minimum Stay (nights)"
                    type="number" min="1"
                    value={s.minStayNights}
                    onChange={(e) => set("minStayNights", e.target.value)}
                    required
                  />
                  <Select
                    label="Cancellation Policy"
                    value={s.cancellationPolicy}
                    onChange={(e) => set("cancellationPolicy", e.target.value)}
                    options={CANCELLATION_POLICIES}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Check-in Time"  type="time" value={s.checkinTime}  onChange={(e) => set("checkinTime",  e.target.value)} />
                  <Input label="Check-out Time" type="time" value={s.checkoutTime} onChange={(e) => set("checkoutTime", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Cleaning Fee (optional)"    type="number" min="0" value={s.cleaningFee}    onChange={(e) => set("cleaningFee", e.target.value)}    placeholder="0.00" />
                  <Input label="Extra Guest Fee (optional)" type="number" min="0" value={s.extraGuestFee}  onChange={(e) => set("extraGuestFee", e.target.value)}  placeholder="0.00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Extra Guest After (guests)" type="number" min="1" value={s.extraGuestAfter} onChange={(e) => set("extraGuestAfter", e.target.value)} placeholder="E.g., 2" />
                  <Input label="Weekly Discount (%)"        type="number" min="0" max="100" value={s.weeklyDiscount}  onChange={(e) => set("weeklyDiscount",  e.target.value)} placeholder="0" />
                </div>
                <Input label="Monthly Discount (%)" type="number" min="0" max="100" value={s.monthlyDiscount} onChange={(e) => set("monthlyDiscount", e.target.value)} placeholder="0" />
                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={s.smokingAllowed} onChange={(e) => set("smokingAllowed", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-slate-700">Smoking Allowed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={s.petsAllowed} onChange={(e) => set("petsAllowed", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-slate-700">Pets Allowed</span>
                  </label>
                </div>
              </div>
            )}

            {/* ── Details step ── */}
            {step === "details" && (
              <div className="space-y-5 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Property Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Bedrooms"  type="number" min="0" value={s.bedrooms}  onChange={(e) => set("bedrooms",  e.target.value)} placeholder="0" />
                  <Input label="Bathrooms" type="number" min="0" value={s.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} placeholder="0" />
                  <Input
                    label="Max Guests"
                    type="number" min="1"
                    value={s.maxGuests}
                    onChange={(e) => set("maxGuests", e.target.value)}
                    required
                    error={tried && !(Number(s.maxGuests) >= 1) ? "At least 1 guest required." : undefined}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Floor Number (optional)"       type="number" value={s.floorNumber}    onChange={(e) => set("floorNumber",    e.target.value)} placeholder="E.g., 3" />
                  <Input label="Property Size m² (optional)"  type="number" min="0" value={s.propertySizeM2} onChange={(e) => set("propertySizeM2", e.target.value)} placeholder="E.g., 75" />
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={s.instantBooking} onChange={(e) => set("instantBooking", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-slate-700">Instant Booking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={s.selfCheckin} onChange={(e) => set("selfCheckin", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-slate-700">Self Check-in</span>
                  </label>
                </div>
                {s.selfCheckin && (
                  <Input
                    label="Self Check-in Instructions"
                    value={s.selfCheckinDetails}
                    onChange={(e) => set("selfCheckinDetails", e.target.value)}
                    placeholder="E.g., Key lockbox code is 1234"
                  />
                )}

                {/* Long-stay */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Long-Stay Discount</p>
                      <p className="text-xs text-slate-400 mt-0.5">Offer a discount for extended bookings.</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={s.longStayEnabled} onChange={(e) => set("longStayEnabled", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                      <span className="text-sm font-semibold text-slate-700">Enabled</span>
                    </label>
                  </div>
                  {s.longStayEnabled && (
                    <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 animate-fade-in">
                      <Input
                        label="Min Nights"
                        type="number" min="1"
                        value={s.longStayMinNights}
                        onChange={(e) => set("longStayMinNights", e.target.value)}
                        error={tried && !(Number(s.longStayMinNights) >= 1) ? "Required." : undefined}
                      />
                      <Select
                        label="Discount Type"
                        value={s.longStayDiscountType}
                        onChange={(e) => set("longStayDiscountType", e.target.value)}
                        options={LONG_STAY_TYPES}
                      />
                      <Input
                        label="Value"
                        type="number" min="0.01"
                        value={s.longStayDiscountValue}
                        onChange={(e) => set("longStayDiscountValue", e.target.value)}
                        placeholder="E.g., 10"
                        error={tried && !(Number(s.longStayDiscountValue) > 0) ? "Must be > 0." : undefined}
                      />
                    </div>
                  )}
                </div>

                {/* Amenities */}
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">Amenities</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {AMENITY_OPTIONS.map((opt) => {
                      const active = s.selectedAmenities.includes(opt.value);
                      return (
                        <button type="button" key={opt.value}
                          onClick={() => set("selectedAmenities", active
                            ? s.selectedAmenities.filter((k) => k !== opt.value)
                            : [...s.selectedAmenities, opt.value])}
                          className={cn("flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                            active ? "border-primary bg-primary-50 text-primary-700 font-semibold" : "border-border bg-white text-slate-600 hover:border-slate-300")}
                        >
                          <div className={cn("w-4 h-4 rounded flex items-center justify-center border text-xs",
                            active ? "bg-primary border-primary text-white" : "border-slate-300")}>
                            {active ? "✓" : ""}
                          </div>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={s.customInput}
                      onChange={(e) => set("customInput", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                      placeholder="Custom amenity"
                    />
                    <Button type="button" onClick={addCustom}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {s.customAmenities.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200">
                        {tag}
                        <button type="button" className="text-slate-400 hover:text-slate-600"
                          onClick={() => set("customAmenities", s.customAmenities.filter((t) => t !== tag))}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Media step ── */}
            {step === "media" && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Photos</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Minimum 3 photos required for activation. Maximum 30.</p>
                </div>
                <MediaUploader
                  listingId={listingId}
                  existingPhotos={photos}
                  onDelete={(id) => listingApi.delete(`/listings/${listingId}/photos/${id}`).then(() => undefined)}
                  onRefresh={refetch}
                />
              </div>
            )}
          </Card>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/listings")}>Exit</Button>
              {step !== "property" && (
                <Button type="button" variant="secondary" onClick={() => {
                  const idx  = STEPS.findIndex((t) => t.id === step);
                  const prev = STEPS[idx - 1];
                  if (prev) { setTried(false); setStep(prev.id as Step); }
                }}>← Back</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" loading={saveMut.isPending} onClick={(e) => { e.preventDefault(); setTried(false); setErr(""); saveMut.mutate(); }} icon={<Save />}>
                Save Draft
              </Button>
              {step !== "media" ? (
                <Button type="submit" variant="primary" loading={saveMut.isPending}>Save & Continue →</Button>
              ) : (
                <>
                  {["draft", "deactivated"].includes(status) && (
                    <Button type="button" variant="success" loading={activateMut.isPending || saveMut.isPending} onClick={() => { setErr(""); saveMut.mutate(undefined, { onSuccess: () => activateMut.mutate() }); }} icon={<CheckCircle />}>
                      {status === "deactivated" ? "Reactivate Live" : "Activate Live"}
                    </Button>
                  )}
                  {status === "active" && (
                    <Button type="button" variant="danger" loading={deactivateMut.isPending} onClick={() => deactivateMut.mutate()}>
                      Deactivate
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </form>
      </FormShell>
    </div>
  );
}
