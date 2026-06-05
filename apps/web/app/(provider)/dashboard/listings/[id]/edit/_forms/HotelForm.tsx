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
import { FormShell, type FormStep } from "./shared/FormShell";
import { GeocodedAddressFields } from "./shared/GeocodedAddressFields";
import { AMENITY_OPTIONS, groupAmenities, flattenGroupedAmenities } from "./shared/amenities";
import { MediaUploader, type ExistingPhoto } from "../../../components/MediaUploader";
import { DocumentUploader, type ExistingDocument } from "../../../components/DocumentUploader";

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

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "ZAR", label: "ZAR (R)" },
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
  claimedStarRating: string;
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
    claimedStarRating:  l.claimedStarRating ? String(l.claimedStarRating) : "",
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
  };
}

// ── Payload builder — HOTEL FIELDS ONLY ─────────────────────────────────────

function buildPayload(s: HotelState): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (s.name.trim())        p.name        = s.name.trim();
  if (s.description.trim()) p.description = s.description.trim();
  if (s.address.trim())     p.address     = s.address.trim();
  if (s.lat !== null)       p.lat         = s.lat;
  if (s.lng !== null)       p.lng         = s.lng;
  if (s.town.trim())        p.town        = s.town.trim();
  if (s.country.trim())     p.country     = s.country.trim();
  const rating = Number(s.claimedStarRating);
  if (rating >= 1 && rating <= 5) p.claimedStarRating = rating;
  const price = Number(s.pricePerNight);
  if (price > 0)            p.pricePerNight = price;
  if (s.currency)           p.currency    = s.currency;
  const nights = Number(s.minStayNights);
  if (nights >= 1)          p.minStayNights = nights;
  if (s.checkinTime)        p.checkinTime  = s.checkinTime;
  if (s.checkoutTime)       p.checkoutTime = s.checkoutTime;
  if (s.cancellationPolicy) p.cancellationPolicy = s.cancellationPolicy;
  p.smokingAllowed = s.smokingAllowed;
  p.petsAllowed    = s.petsAllowed;
  if (s.roomType) p.roomType = s.roomType;
  const units = Number(s.unitCount);
  if (units >= 1) p.unitCount = units;
  p.amenities       = groupAmenities(s.selectedAmenities);
  p.customAmenities = s.customAmenities;
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
    onSuccess:  () => { refetch(); flash("Submitted for admin review!", "ok"); },
    onError:    (e: any) => flash(apiErr(e), "err"),
  });

  const reactivateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/reactivate`),
    onSuccess:  () => { refetch(); flash("Listing reactivated.", "ok"); },
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
    setTried(false); setErr("");
    saveMut.mutate();
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
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Hotel Listing</p>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>
        <div className="ml-auto"><Badge label={status} status={status} /></div>
      </div>

      {/* Rejection banner */}
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

      {/* Toasts */}
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
                  onChange={(f, v) => set(f, f === "country" ? v.toUpperCase().slice(0, 2) : v)}
                  onGeocoded={(r) => setS((p) => ({ ...p, lat: r.lat, lng: r.lng, town: r.town, country: r.country }))}
                  errors={tried ? {
                    address: !s.address.trim() ? "Address is required." : undefined,
                    town:    !s.town.trim()    ? "Town is required."    : undefined,
                    country: !s.country.trim() ? "Country is required." : undefined,
                  } : undefined}
                />
                <Input
                  label="Claimed Star Rating (1–5, optional)"
                  type="number"
                  min="1"
                  max="5"
                  value={s.claimedStarRating}
                  onChange={(e) => set("claimedStarRating", e.target.value)}
                  placeholder="1–5"
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
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={s.pricePerNight}
                    onChange={(e) => set("pricePerNight", e.target.value)}
                    required
                    error={tried && !(Number(s.pricePerNight) > 0) ? "Price must be greater than 0." : undefined}
                  />
                  <Select
                    label="Currency"
                    value={s.currency}
                    onChange={(e) => set("currency", e.target.value)}
                    options={CURRENCIES}
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

                {/* Amenities grid */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Amenities</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {AMENITY_OPTIONS.map((opt) => {
                      const active = s.selectedAmenities.includes(opt.value);
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => set(
                            "selectedAmenities",
                            active
                              ? s.selectedAmenities.filter((k) => k !== opt.value)
                              : [...s.selectedAmenities, opt.value],
                          )}
                          className={cn(
                            "flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                            active
                              ? "border-primary bg-primary-50 text-primary-700 font-semibold"
                              : "border-border bg-white text-slate-600 hover:border-slate-300",
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded flex items-center justify-center border text-xs",
                            active ? "bg-primary border-primary text-white" : "border-slate-300",
                          )}>
                            {active ? "✓" : ""}
                          </div>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
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
                  <DocumentUploader
                    listingId={listingId}
                    category="hotel"
                    existingDocuments={docs}
                    onRefresh={refetch}
                    disabled={status === "pending_review"}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/listings")}>
                Exit
              </Button>
              {step !== "property" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const idx  = STEPS.findIndex((t) => t.id === step);
                    const prev = STEPS[idx - 1];
                    if (prev) { setTried(false); setStep(prev.id as Step); }
                  }}
                >
                  ← Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                loading={saveMut.isPending}
                onClick={handleSaveDraft}
                icon={<Save />}
              >
                Save Draft
              </Button>

              {step !== "media" ? (
                <Button type="submit" variant="primary" loading={saveMut.isPending}>
                  Save & Continue →
                </Button>
              ) : (
                <>
                  {["draft", "rejected"].includes(status) && (
                    <Button
                      type="button"
                      variant="success"
                      loading={submitMut.isPending || saveMut.isPending}
                      onClick={() => { setErr(""); saveMut.mutate(undefined, { onSuccess: () => submitMut.mutate() }); }}
                      icon={<Award />}
                    >
                      Submit for Review
                    </Button>
                  )}
                  {status === "deactivated" && (
                    <Button
                      type="button"
                      variant="success"
                      loading={reactivateMut.isPending || saveMut.isPending}
                      onClick={() => { setErr(""); saveMut.mutate(undefined, { onSuccess: () => reactivateMut.mutate() }); }}
                      icon={<CheckCircle />}
                    >
                      Reactivate
                    </Button>
                  )}
                  {["active", "approved"].includes(status) && (
                    <Button
                      type="button"
                      variant="danger"
                      loading={deactivateMut.isPending}
                      onClick={() => deactivateMut.mutate()}
                    >
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
