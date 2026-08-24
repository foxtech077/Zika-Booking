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
import { FormShell, type FormStep } from "./shared/FormShell";
import { CurrencyCombobox } from "@/components/ui/CurrencyCombobox";
import { normalizeCountryCode } from "@/components/ui/CountryCombobox";
import { GeocodedAddressFields } from "./shared/GeocodedAddressFields";
import { AMENITY_OPTIONS, CATEGORY_MAP, groupAmenities, flattenGroupedAmenities } from "./shared/amenities";
import { MediaUploader, type ExistingPhoto } from "../../../components/MediaUploader";
import { Listing } from "@/types/provider";
import { getCurrencyForCountry } from "./shared/countryCurrencyMap";
import { useAuthStore } from "@/stores/auth";
import { PayoutCurrencyWarning } from "./shared/PayoutCurrencyWarning";

// ── Enums ────────────────────────────────────────────────────────────────────

const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible – free cancellation up to 24 h" },
  { value: "moderate", label: "Moderate – free cancellation up to 5 days" },
  { value: "strict",   label: "Strict – no refund within 14 days" },
];

const CANCELLATION_POLICY_VALUES = new Set(CANCELLATION_POLICIES.map((x) => x.value));

// ── State type ───────────────────────────────────────────────────────────────

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
  customInput: string;
};

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNullableInt(v: unknown): number | null {
  const n = toNullableNumber(v);
  return n === null ? null : Math.trunc(n);
}

function trimOrNull(v: string): string | null {
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function countryOrNull(v: string): string | null {
  const country = v.trim().toUpperCase();
  return country.length === 2 ? country : null;
}

function initState(l: Listing): ApartmentState {
  const a = l as any;
  return {
    name:                l.name              ?? "",
    description:         l.description       ?? "",
    address:             l.address           ?? "",
    lat:                 toNullableNumber(a.lat),
    lng:                 toNullableNumber(a.lng),
    town:                l.town              ?? "",
    neighborhood:        (l as any).neighborhood      ?? "",
    country:             l.country           ?? "",
    pricePerNight:       l.pricePerNight ? String(l.pricePerNight) : "",
    currency:            l.currency          ?? "USD",
    minStayNights:       l.minStayNights ? String(l.minStayNights) : "1",
    checkinTime:         l.checkinTime       ?? "14:00",
    checkoutTime:        l.checkoutTime      ?? "11:00",
    cancellationPolicy:  l.cancellationPolicy ?? "flexible",
    smokingAllowed:      l.smokingAllowed    ?? false,
    petsAllowed:         l.petsAllowed       ?? false,
    allowPreBooking:     l.allowPreBooking   ?? false,
    bedrooms:            l.bedrooms          != null ? String(l.bedrooms)  : "",
    bathrooms:           l.bathrooms         != null ? String(l.bathrooms) : "",
    maxGuests:           l.maxGuests         != null ? String(l.maxGuests) : "",
    longStayEnabled:     l.longStayEnabled   ?? false,
    longStayMinNights:   l.longStayMinNights != null ? String(l.longStayMinNights)  : "30",
    longStayDiscountValue: a.longStayDiscountValue != null ? String(a.longStayDiscountValue) : "",
    selectedAmenities:   flattenGroupedAmenities(a.amenities),
    customAmenities:     (a.customAmenities ?? []).map((x: any) => typeof x === "string" ? x : (x?.label ?? "")),
    customInput:         "",
  };
}

// ── Payload builder — APARTMENT FIELDS ONLY ──────────────────────────────────

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
  p.petsAllowed    = s.petsAllowed;
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

  p.amenities       = groupAmenities(s.selectedAmenities);
  p.customAmenities = s.customAmenities.map((x) => x.trim()).filter(Boolean);

  return p;
}

// ── Step validation ──────────────────────────────────────────────────────────

type Step = "property" | "pricing" | "details" | "amenities" | "media";

function validateStep(step: Step, s: ApartmentState): string[] {
  switch (step) {
    case "property":
      return [
        !s.name.trim()    && "Apartment name is required.",
        !s.address.trim() && "Address is required.",
      ].filter(Boolean) as string[];
    case "pricing":
      return [
        !(Number(s.pricePerNight) > 0) && "Price per night must be greater than 0.",
        !s.currency                    && "Currency is required.",
        !(Number(s.minStayNights) >= 1) && "Minimum stay must be at least 1 night.",
        !s.checkinTime                 && "Check-in time is required.",
        !s.checkoutTime                && "Check-out time is required.",
        !s.cancellationPolicy          && "Cancellation policy is required.",
      ].filter(Boolean) as string[];
    case "details":
      return [
        !(Number(s.maxGuests) >= 1) && "Maximum guests must be at least 1.",
        s.bedrooms  !== "" && Number(s.bedrooms)  < 0 && "Bedrooms cannot be negative.",
        s.bathrooms !== "" && Number(s.bathrooms) < 0 && "Bathrooms cannot be negative.",
        s.longStayEnabled && s.longStayMinNights !== "" && !(Number(s.longStayMinNights) >= 1) && "Long-stay minimum nights must be \u2265 1.",
        s.longStayEnabled && s.longStayDiscountValue !== "" && !(Number(s.longStayDiscountValue) > 0) && "Long-stay discount value must be > 0.",
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

const STEPS: FormStep[] = [
  { id: "property", label: "Property Info",      sublabel: "Name, type & location" },
  { id: "pricing",  label: "Pricing & Policies", sublabel: "Rates, times & cancellation" },
  { id: "details",  label: "Property Details",   sublabel: "Specs, guests & amenities" },
  { id: "amenities", label: "Amenities", sublabel: "Services & amenities" },
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
  const providerCountry = useAuthStore((st) => st.user?.country);

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
    onSuccess:  (r: any) => { refetch(); flash(r.data?.data?.message ?? "Listing is now live!", "ok"); router.push("/dashboard/listings"); },
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
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col flex-1 min-h-0">
        {/* ── Standalone Header Card ── */}
        <div className="bg-white border border-border rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between shrink-0 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/listings")}
              className="w-9 h-9 rounded-xl border border-[#4c6a48]/30 bg-white flex items-center justify-center text-[#4c6a48] hover:bg-[#e6ebe4] transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#4c6a48] uppercase tracking-widest">Apartment Listing</p>
              <h1 className="text-lg font-bold text-slate-900 truncate leading-tight">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge label={status} status={status} />
          </div>
        </div>

        {/* ── Main Form Shell ── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <FormShell
            steps={STEPS}
            activeStep={step}
            status={status}
            onStepClick={(id) => { setTried(false); setStep(id as Step); }}
            isComplete={isComplete}
            isLocked={isLocked}
            footer={
              <div className="w-full flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/listings")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#4c6a48]/30 text-sm font-semibold text-[#4c6a48] bg-white hover:bg-[#e6ebe4] transition-all"
                  >
                    Exit
                  </button>
                  {step !== "property" && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx  = STEPS.findIndex((t) => t.id === step);
                        const prev = STEPS[idx - 1];
                        if (prev) { setTried(false); setStep(prev.id as Step); }
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-all"
                    >
                      ← Back
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saveMut.isPending}
                    onClick={(e) => { e.preventDefault(); setTried(false); setErr(""); saveMut.mutate(); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#4c6a48]/40 text-sm font-semibold text-[#4c6a48] bg-white hover:bg-[#e6ebe4] disabled:opacity-50 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Draft
                  </button>
                  {step !== "media" ? (
                    <button
                      type="submit"
                      form="apartment-edit-form"
                      disabled={saveMut.isPending}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#4c6a48] hover:bg-[#3d533a] disabled:opacity-50 transition-all shadow-sm"
                    >
                      Save &amp; Continue →
                    </button>
                  ) : (
                    <>
                      {["draft", "deactivated"].includes(status) && (
                        <button
                          type="button"
                          disabled={activateMut.isPending || saveMut.isPending}
                          onClick={() => { setErr(""); saveMut.mutate(undefined, { onSuccess: () => activateMut.mutate() }); }}
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#4c6a48] hover:bg-[#3d533a] disabled:opacity-50 transition-all shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {status === "deactivated" ? "Reactivate Live" : "Activate Live"}
                        </button>
                      )}
                      {status === "active" && (
                        <button
                          type="button"
                          disabled={deactivateMut.isPending}
                          onClick={() => deactivateMut.mutate()}
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
                        >
                          Deactivate
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            }
          >
            <form id="apartment-edit-form" onSubmit={handleNext} className="space-y-5">
              {/* Banners nested inside scrollable area */}
              {(ok || err) && (
                <div className="space-y-3">
                  {ok && (
                    <div className="flex items-center gap-2 rounded-2xl bg-success-50 border border-success/20 px-4 py-3 text-sm text-success-dark">
                      <CheckCircle className="w-4 h-4 text-success shrink-0" />
                      {ok}
                    </div>
                  )}
                  {err && (
                    <div className="flex items-center gap-2 rounded-2xl bg-danger-50 border border-danger/20 px-4 py-3 text-sm text-danger-dark">
                      <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                      {err}
                    </div>
                  )}
                </div>
              )}
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
                  neighborhood={s.neighborhood}
                  country={s.country}
                  lat={s.lat}
                  lng={s.lng}
                  onChange={(f, v) => {
                      const normalized = f === "country" ? normalizeCountryCode(v) : v;
                    set(f, normalized);
                    // Auto-populate currency when country changes
                    if (f === "country") {
                      const detectedCurrency = getCurrencyForCountry(normalized);
                      if (detectedCurrency) set("currency", detectedCurrency);
                    }
                  }}
                  onGeocoded={(r) => {
                      const country = normalizeCountryCode(r.country);
                      const detectedCurrency = getCurrencyForCountry(country);
                    setS((p) => ({
                      ...p,
                      lat: r.lat,
                      lng: r.lng,
                      town: r.town,
                      neighborhood: r.neighborhood,
                        country,
                      // Auto-populate currency from geocoded country (only if a mapping exists)
                      ...(detectedCurrency ? { currency: detectedCurrency } : {}),
                    }));
                  }}
                  errors={tried ? {
                    address: !s.address.trim() ? "Address is required." : undefined,
                  } : undefined}
                />
              </div>
            )}

            {/* ── Pricing step ── */}
            {step === "pricing" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Pricing & Policies</h3>
                <PayoutCurrencyWarning
                  providerCountry={providerCountry}
                  listingCountry={s.country}
                  currency={s.currency}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Price per Night"
                    type="number" step="0.01" min="0.01"
                    value={s.pricePerNight}
                    onChange={(e) => set("pricePerNight", e.target.value)}
                    required
                    error={tried && !(Number(s.pricePerNight) > 0) ? "Price must be > 0." : undefined}
                  />
                  <CurrencyCombobox label="Currency" value={s.currency} onChange={(val) => set("currency", val)} />
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
                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={s.smokingAllowed} onChange={(e) => set("smokingAllowed", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-slate-700">Smoking Allowed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={s.petsAllowed} onChange={(e) => set("petsAllowed", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-slate-700">Pets Allowed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={s.allowPreBooking} onChange={(e) => set("allowPreBooking", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-slate-700">Allow pre-booking messages</span>
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
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 animate-fade-in">
                      <Input
                        label="Min Nights"
                        type="number" min="1"
                        value={s.longStayMinNights}
                        onChange={(e) => set("longStayMinNights", e.target.value)}
                        error={tried && !(Number(s.longStayMinNights) >= 1) ? "Required." : undefined}
                      />
                      <Input
                        label="Discount (%)"
                        type="number" min="0" max="100" step="any"
                        value={s.longStayDiscountValue}
                        onChange={(e) => set("longStayDiscountValue", e.target.value)}
                        placeholder="E.g., 10"
                        error={tried && s.longStayDiscountValue !== "" && !(Number(s.longStayDiscountValue) > 0) ? "Must be > 0." : undefined}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Amenities step ── */}
{step === "amenities" && (
  <div className="space-y-5 animate-fade-in">
    <h3 className="text-lg font-bold text-slate-900">Amenities</h3>
    <div>
      {(() => {
        const grouped = AMENITY_OPTIONS.reduce((acc, opt) => {
          const cat = CATEGORY_MAP[opt.value] ?? "Services";
          (acc[cat] ??= []).push(opt);
          return acc;
        }, {} as Record<string, typeof AMENITY_OPTIONS[number][]>);
        return Object.entries(grouped).map(([cat, opts]) => (
          <div key={cat} className="mb-4">
            <h4 className="text-sm font-medium text-slate-700 mb-1">{cat}</h4>
            <div className="grid grid-cols-2 gap-2.5">
              {opts.map((opt) => {
                const active = s.selectedAmenities.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() =>
                      set(
                        "selectedAmenities",
                        active
                          ? s.selectedAmenities.filter((k) => k !== opt.value)
                          : [...s.selectedAmenities, opt.value]
                      )
                    }
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                      active
                        ? "border-primary bg-primary-50 text-primary-700 font-semibold"
                        : "border-border bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center border text-xs",
                        active ? "bg-primary border-primary text-white" : "border-slate-300"
                      )}
                    >
                      {active ? "✓" : ""}
                    </div>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ));
      })()}
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
            </form>
          </FormShell>
        </div>
      </div>
    </div>
  );
}
