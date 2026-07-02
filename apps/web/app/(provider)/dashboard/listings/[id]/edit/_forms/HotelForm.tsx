"use client";

/**
 * HotelForm — Hotel-only listing form.
 * Payload contains ONLY hotel fields. No car or apartment fields ever reach the API.
 * Steps: Property Info → Pricing & Policies → Room Setup → Media & Documents
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, CheckCircle, AlertCircle,
  ShieldAlert, Award,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/provider";
import { CurrencyCombobox } from "@/components/ui/CurrencyCombobox";
import { FormShell, type FormStep } from "./shared/FormShell";
import { GeocodedAddressFields } from "./shared/GeocodedAddressFields";
import { AMENITY_OPTIONS, CATEGORY_MAP, groupAmenities, flattenGroupedAmenities } from "./shared/amenities";
import { MediaUploader, type ExistingPhoto } from "../../../components/MediaUploader";
import { DocumentUploader, type ExistingDocument } from "../../../components/DocumentUploader";
import { getCurrencyForCountry } from "./shared/countryCurrencyMap";
import BookingModeSelector from "./shared/BookingModeSelector";

// ── Enums (values match backend exactly) ────────────────────────────────────

const ROOM_TYPES = [
  { value: "standard",           label: "Standard Room" },
  { value: "superior",           label: "Superior Room" },
  { value: "deluxe",             label: "Deluxe Room" },
  { value: "suite",              label: "Suite" },
  { value: "junior_suite",       label: "Junior Suite" },
  { value: "studio",             label: "Studio" },
  { value: "family_room",        label: "Family Room" },
  { value: "presidential_suite", label: "Presidential Suite" },
];

const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible – free cancellation up to 24 h" },
  { value: "moderate", label: "Moderate – free cancellation up to 5 days" },
  { value: "strict",   label: "Strict – no refund within 14 days" },
];

// ── State type ───────────────────────────────────────────────────────────────

type HotelState = {
  name: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  town: string;
  country: string;
  // claimedStarRating intentionally omitted — ratings are set by traveller reviews only.
  pricePerNight: string;
  currency: string;
  minStayNights: string;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  roomType: string;
  unitCount: string;
  selectedAmenities: string[];
  customAmenities: string[];
  customInput: string;
  bookingMode: string;
};

function initState(l: Listing): HotelState {
  return {
    name:               l.name ?? "",
    description:        l.description ?? "",
    address:            l.address ?? "",
    lat:                (l as any).lat ?? null,
    lng:                (l as any).lng ?? null,
    town:               l.town ?? "",
    country:            l.country ?? "",
    // claimedStarRating intentionally excluded — ratings come from traveller reviews.
    pricePerNight:      l.pricePerNight ? String(l.pricePerNight) : "",
    currency:           l.currency ?? "USD",
    minStayNights:      l.minStayNights ? String(l.minStayNights) : "1",
    checkinTime:        l.checkinTime ?? "14:00",
    checkoutTime:       l.checkoutTime ?? "11:00",
    cancellationPolicy: l.cancellationPolicy ?? "flexible",
    smokingAllowed:     l.smokingAllowed ?? false,
    petsAllowed:        l.petsAllowed ?? false,
    roomType:           l.roomType ?? "standard",
    unitCount:          l.unitCount ? String(l.unitCount) : "1",
    selectedAmenities:  flattenGroupedAmenities((l as any).amenities),
    customAmenities:    ((l as any).customAmenities ?? []).map((a: any) =>
                          typeof a === "string" ? a : (a?.label ?? "")),
    customInput:        "",
    bookingMode:         (l as any).instantBooking ? "instant" : (l as any).bookingMode ?? "instant",
  };
}

// ── Payload builder — HOTEL FIELDS ONLY ─────────────────────────────────────

function buildPayload(s: HotelState): Record<string, unknown> {
  // Normalize and sanitize values similar to ApartmentForm to avoid sending
  // unexpected empty strings or NaN which can trip backend validation.
  const p: Record<string, unknown> = {};

  const toNullableNumber = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const toNullableInt = (v: unknown): number | null => {
    const n = toNullableNumber(v);
    return n === null ? null : Math.trunc(n);
  };

  const trimOrNull = (v: string): string | null => {
    const t = v?.trim();
    return t ? t : null;
  };

  const countryOrNull = (v: string): string | null => {
    const country = v?.trim().toUpperCase();
    return country && country.length === 2 ? country : null;
  };

  p.name = s.name.trim();
  p.description = trimOrNull(s.description);
  p.address = trimOrNull(s.address);
  p.lng = toNullableNumber(s.lng);
  p.town = trimOrNull(s.town);
  p.country = countryOrNull(s.country);

  // Pricing
  const price = toNullableNumber(s.pricePerNight);
  if (price !== null && price > 0) p.pricePerNight = price;
  if (s.currency) p.currency = s.currency;

  const nights = toNullableInt(s.minStayNights);
  if (nights !== null && nights >= 1) p.minStayNights = nights;

  p.checkinTime = s.checkinTime || null;
  p.checkoutTime = s.checkoutTime || null;
  if (s.cancellationPolicy) p.cancellationPolicy = s.cancellationPolicy;

  p.smokingAllowed = s.smokingAllowed;
  p.petsAllowed = s.petsAllowed;

  p.roomType = s.roomType || null;

  const units = toNullableInt(s.unitCount);
  p.unitCount = units !== null && units >= 1 ? units : null;

  p.amenities = groupAmenities(s.selectedAmenities);
  p.customAmenities = s.customAmenities.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  // Map bookingMode ("instant" | "request") → instantBooking boolean for the backend
  p.instantBooking = s.bookingMode !== "request";
  return p;
}

// ── Step validation ──────────────────────────────────────────────────────────

type Step = "property" | "pricing" | "rooms" | "media";

function validateStep(step: Step, s: HotelState): string[] {
  switch (step) {
    case "property":
      return [
        !s.name.trim()    && "Hotel name is required.",
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
        // Discount validation — only blocks when discount is enabled
      ].filter(Boolean) as string[];
    case "rooms":
      return [
        !s.roomType               && "Room type is required.",
        !(Number(s.unitCount) >= 1) && "Unit count must be at least 1.",
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

// ── Steps definition ─────────────────────────────────────────────────────────

const STEPS: FormStep[] = [
  { id: "property", label: "Property Info",      sublabel: "Name, description & location" },
  { id: "pricing",  label: "Pricing & Policies", sublabel: "Rates, times & cancellation" },
  { id: "rooms",    label: "Room Setup",          sublabel: "Room type, inventory & amenities" },
  { id: "media",    label: "Media & Documents",   sublabel: "Photos & verification documents" },
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

export function HotelForm({ listingId, listing }: Props) {
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: current } = useQuery<any>({
    queryKey:    ["listing-edit", listingId],
    queryFn:     () => listingApi.get(`/listings/${listingId}`).then((r) => r.data.data ?? r.data),
    initialData: listing,
    staleTime:   30_000,
  });

  const [s, setS]       = useState<HotelState>(() => initState(listing));
  const [step, setStep] = useState<Step>("property");
  const [ok, setOk]     = useState("");
  const [err, setErr]   = useState("");
  const [tried, setTried] = useState(false);

  const set = (k: keyof HotelState, v: unknown) => setS((p) => ({ ...p, [k]: v }));

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

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: () => listingApi.patch(`/listings/${listingId}`, buildPayload(s)),
    onSuccess:  () => { refetch(); flash("Changes saved.", "ok"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  const submitMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/submit`),
    onSuccess:  () => { refetch(); flash("Submitted for admin review!", "ok"); router.push("/dashboard/listings"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  const reactivateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/reactivate`),
    onSuccess:  () => { refetch(); flash("Listing reactivated.", "ok"); router.push("/dashboard/listings"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  const deactivateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/deactivate`),
    onSuccess:  () => { refetch(); flash("Listing deactivated.", "ok"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  const handleSaveDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    // Fire save in background — navigate immediately regardless of API outcome
    saveMut.mutate();
    router.push("/dashboard/listings");
  };

  const addCustom = () => {
    const v = s.customInput.trim();
    if (v && !s.customAmenities.includes(v)) {
      set("customAmenities", [...s.customAmenities, v]);
      set("customInput", "");
    }
  };

  const photos: ExistingPhoto[]   = (current?.photos   ?? []) as ExistingPhoto[];
  const docs:   ExistingDocument[] = (current?.documents ?? []) as ExistingDocument[];
  const status = current?.status ?? listing.status;
  const title  = current?.name  ?? listing.name ?? "Untitled Hotel";

  // ── Render ────────────────────────────────────────────────────────────────

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
              <p className="text-[10px] font-bold text-[#4c6a48] uppercase tracking-widest">Hotel Listing</p>
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
                    onClick={handleSaveDraft}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#4c6a48]/40 text-sm font-semibold text-[#4c6a48] bg-white hover:bg-[#e6ebe4] disabled:opacity-50 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Draft
                  </button>
                  {step !== "media" ? (
                    <button
                      type="submit"
                      form="hotel-edit-form"
                      disabled={saveMut.isPending}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#4c6a48] hover:bg-[#3d533a] disabled:opacity-50 transition-all shadow-sm"
                    >
                      Save &amp; Continue →
                    </button>
                  ) : (
                    <>
                      {["draft", "rejected"].includes(status) && (
                        <button
                          type="button"
                          disabled={submitMut.isPending || saveMut.isPending}
                          onClick={() => { setErr(""); saveMut.mutate(undefined, { onSuccess: () => submitMut.mutate() }); }}
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#4c6a48] hover:bg-[#3d533a] disabled:opacity-50 transition-all shadow-sm"
                        >
                          <Award className="w-3.5 h-3.5" /> Submit for Review
                        </button>
                      )}
                      {status === "deactivated" && (
                        <button
                          type="button"
                          disabled={reactivateMut.isPending || saveMut.isPending}
                          onClick={() => { setErr(""); saveMut.mutate(undefined, { onSuccess: () => reactivateMut.mutate() }); }}
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#4c6a48] hover:bg-[#3d533a] disabled:opacity-50 transition-all shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Reactivate
                        </button>
                      )}
                      {["active", "approved"].includes(status) && (
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
            <form id="hotel-edit-form" onSubmit={handleNext} className="space-y-5">
              {/* Banners nested inside scrollable area */}
              {((current?.rejectionReasons?.length ?? 0) > 0 || ok || err) && (
                <div className="space-y-3">
                  {(current?.rejectionReasons?.length ?? 0) > 0 && (
                    <div className="bg-danger-50 border border-danger/20 rounded-2xl p-4 flex gap-3">
                      <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-danger-dark">Listing Rejected</p>
                        <p className="text-xs text-danger-dark/80 mt-0.5">
                          {current?.rejectionNote ?? "Please address the following and re-submit."}
                        </p>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {(current?.rejectionReasons ?? []).map((r: string, i: number) => (
                            <li key={i} className="text-xs text-danger-dark">{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

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
                  label="Hotel / Property Name"
                  value={s.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="E.g., Grand Horizon Hotel"
                  required
                  error={tried && !s.name.trim() ? "Name is required." : undefined}
                />
                <div>
                  <Textarea
                    label="Description"
                    value={s.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Describe your property in detail (max 1000 characters)"
                    rows={5}
                    maxLength={1000}
                  />
                  <p className="text-xs text-slate-400 text-right mt-1">{s.description.length} / 1000</p>
                </div>
                <GeocodedAddressFields
                  address={s.address}
                  town={s.town}
                  country={s.country}
                  onChange={(f, v) => {
                    const normalized = f === "country" ? v.toUpperCase().slice(0, 2) : v;
                    set(f, normalized);
                    // Auto-populate currency when country changes
                    if (f === "country") {
                      const detectedCurrency = getCurrencyForCountry(normalized);
                      if (detectedCurrency) set("currency", detectedCurrency);
                    }
                  }}
                  onGeocoded={(r) => {
                    const detectedCurrency = getCurrencyForCountry(r.country);
                    setS((p) => ({
                      ...p,
                      lat: r.lat,
                      lng: r.lng,
                      town: r.town,
                      country: r.country,
                      // Auto-populate currency from geocoded country (only if a mapping exists)
                      ...(detectedCurrency ? { currency: detectedCurrency } : {}),
                    }));
                  }}
                  errors={tried ? {
                    address: !s.address.trim() ? "Address is required." : undefined,
                    town:    !s.town.trim()    ? "Town is required."    : undefined,
                    country: !s.country.trim() ? "Country is required." : undefined,
                  } : undefined}
                />
                {/* Star rating is read-only and set by traveller reviews — not editable by providers. */}
              </div>
            )}

            {/* ── Pricing step ── */}
            {step === "pricing" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Pricing & Policies</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Price per Night"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={s.pricePerNight}
                    onChange={(e) => set("pricePerNight", e.target.value)}
                    required
                    error={tried && !(Number(s.pricePerNight) > 0) ? "Price must be greater than 0." : undefined}
                  />
                  <CurrencyCombobox
                    label="Currency"
                    value={s.currency}
                    onChange={(val) => set("currency", val)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Minimum Stay (nights)"
                    type="number"
                    min="1"
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
                  <Input
                    label="Check-in Time"
                    type="time"
                    value={s.checkinTime}
                    onChange={(e) => set("checkinTime", e.target.value)}
                    required
                    error={tried && !s.checkinTime ? "Check-in time is required." : undefined}
                  />
                  <Input
                    label="Check-out Time"
                    type="time"
                    value={s.checkoutTime}
                    onChange={(e) => set("checkoutTime", e.target.value)}
                    required
                    error={tried && !s.checkoutTime ? "Check-out time is required." : undefined}
                  />
                </div>
                <div className="flex items-center gap-6 pt-1">
                  <div className="w-full">
                    <BookingModeSelector listingId={listingId} value={s.bookingMode} onChange={(v) => set("bookingMode", v)} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={s.smokingAllowed}
                      onChange={(e) => set("smokingAllowed", e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700">Smoking Allowed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={s.petsAllowed}
                      onChange={(e) => set("petsAllowed", e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700">Pets Allowed</span>
                  </label>
                </div>
              </div>
            )}


            {/* ── Rooms step ── */}
            {step === "rooms" && (
              <div className="space-y-5 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Room Setup & Amenities</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Default Room Type"
                    value={s.roomType}
                    onChange={(e) => set("roomType", e.target.value)}
                    options={ROOM_TYPES}
                  />
                  <Input
                    label="Total Unit Count"
                    type="number"
                    min="1"
                    value={s.unitCount}
                    onChange={(e) => set("unitCount", e.target.value)}
                    required
                    error={tried && !(Number(s.unitCount) >= 1) ? "At least 1 unit required." : undefined}
                  />
                </div>

                {/* Amenities grouped by category */}
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

                {/* Custom amenities */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1.5">Custom Amenities</p>
                  <div className="flex gap-2">
                    <Input
                      value={s.customInput}
                      onChange={(e) => set("customInput", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                      placeholder="E.g., Mountain view, EV charger"
                    />
                    <Button type="button" onClick={addCustom}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {s.customAmenities.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200">
                        {tag}
                        <button type="button" className="text-slate-400 hover:text-slate-600 leading-none"
                          onClick={() => set("customAmenities", s.customAmenities.filter((t) => t !== tag))}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Media step ── */}
            {step === "media" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Photos</h3>
                  <p className="text-xs text-slate-400 mt-0.5">At least 1 photo required for submission. Maximum 30.</p>
                </div>
                <MediaUploader
                  listingId={listingId}
                  existingPhotos={photos}
                  onDelete={(id) => listingApi.delete(`/listings/${listingId}/photos/${id}`).then(() => undefined)}
                  onRefresh={refetch}
                  disabled={status === "pending_review"}
                />
                <div className="border-t border-border pt-5">
                  <Card padding="none" className="border-0 shadow-none">
                    <DocumentUploader
                      listingId={listingId}
                      category="hotel"
                      existingDocuments={docs}
                      onRefresh={refetch}
                      disabled={status === "pending_review"}
                    />
                  </Card>
                </div>
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
