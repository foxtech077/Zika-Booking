"use client";

/**
 * CarForm — Car-rental-only listing form.
 * Payload contains ONLY car fields. No hotel or apartment fields ever reach the API.
 * Steps: Vehicle Info → Specifications → Pricing & Policy → Media & Documents
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
import type { Listing } from "@/types/provider";
import { FormShell, type FormStep } from "./shared/FormShell";
import { GeocodedAddressFields } from "./shared/GeocodedAddressFields";
import { MediaUploader, type ExistingPhoto } from "../../../components/MediaUploader";
import { DocumentUploader, type ExistingDocument } from "../../../components/DocumentUploader";

// ── Enums (values must match backend Zod enum exactly) ───────────────────────

const CAR_CATEGORIES = [
  { value: "Economy",     label: "Economy" },
  { value: "Compact",     label: "Compact" },
  { value: "SUV",         label: "SUV" },
  { value: "Minivan",     label: "Minivan" },
  { value: "Pickup",      label: "Pickup" },
  { value: "Luxury",      label: "Luxury" },
  { value: "Electric",    label: "Electric" },
  { value: "Convertible", label: "Convertible" },
];

const TRANSMISSION_OPTIONS = [
  { value: "automatic", label: "Automatic" },
  { value: "manual",    label: "Manual" },
  { value: "semi_auto", label: "Semi-Automatic" },
];

const FUEL_TYPE_OPTIONS = [
  { value: "petrol",   label: "Petrol / Gasoline" },
  { value: "diesel",   label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid",   label: "Hybrid" },
  { value: "lpg",      label: "LPG" },
];

// Backend accepts: "2WD" | "4WD" | "AWD"
const DRIVE_TYPE_OPTIONS = [
  { value: "2WD", label: "Two-Wheel Drive (2WD)" },
  { value: "4WD", label: "Four-Wheel Drive (4WD)" },
  { value: "AWD", label: "All-Wheel Drive (AWD)" },
];

const MILEAGE_POLICY_OPTIONS = [
  { value: "unlimited", label: "Unlimited Mileage" },
  { value: "limited",   label: "Limited Mileage" },
];

const FUEL_POLICY_OPTIONS = [
  { value: "full_to_full",  label: "Full to Full" },
  { value: "same_to_same",  label: "Same to Same" },
  { value: "free_tank",     label: "Free Tank" },
  { value: "full_to_empty", label: "Full to Empty" },
  { value: "pre_purchase",  label: "Pre-purchase" },
];

const INSURANCE_TYPE_OPTIONS = [
  { value: "basic",               label: "Basic" },
  { value: "standard",            label: "Standard" },
  { value: "premium",             label: "Premium" },
  { value: "comprehensive",       label: "Comprehensive" },
  { value: "basic_third_party",   label: "Basic Third Party" },
  { value: "premium_zero_excess", label: "Premium Zero Excess" },
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

type CarState = {
  name: string;
  description: string;
  carMake: string;
  carModel: string;
  carYear: string;
  carCategory: string;
  licencePlate: string;
  odometerReading: string;
  unitCount: string;
  address: string;
  lat: number | null;
  lng: number | null;
  town: string;
  country: string;
  transmission: string;
  fuelType: string;
  driveType: string;
  seats: string;
  doors: string;
  airConditioning: boolean;
  pricePerDay: string;
  currency: string;
  cancellationPolicy: string;
  mileagePolicy: string;
  mileageLimitKm: string;
  extraKmRate: string;
  fuelPolicy: string;
  insuranceType: string;
  minimumDriverAge: string;
  securityDeposit: string;
  deliveryEnabled: boolean;
  deliveryRadiusKm: string;
  deliveryFee: string;
  roadsideAssistance: boolean;
  crossBorderAllowed: boolean;
  airportPickup: boolean;
  returnSameLocation: boolean;
};

function normalizeDriveType(v: unknown): string {
  if (typeof v !== "string") return "2WD";
  if (["2WD", "4WD", "AWD"].includes(v)) return v;
  if (v === "TWO_WD" || v === "FWD" || v === "RWD") return "2WD";
  if (v === "FOUR_WD") return "4WD";
  return "2WD";
}

function initState(l: Listing): CarState {
  const a = l as any;
  return {
    name:               l.name        ?? "",
    description:        l.description ?? "",
    carMake:            l.carMake     ?? "",
    carModel:           l.carModel    ?? "",
    carYear:            l.carYear     ? String(l.carYear) : String(new Date().getFullYear()),
    carCategory:        a.carCategory ?? "Economy",
    licencePlate:       a.licencePlate     ?? "",
    odometerReading:    a.odometerReading  != null ? String(a.odometerReading) : "",
    unitCount:          l.unitCount        ? String(l.unitCount) : "1",
    address:            l.address          ?? "",
    lat:                a.lat              ?? null,
    lng:                a.lng              ?? null,
    town:               l.town             ?? "",
    country:            l.country          ?? "",
    transmission:       l.transmission     ?? "automatic",
    fuelType:           l.fuelType         ?? "petrol",
    driveType:          normalizeDriveType(a.driveType),
    seats:              l.seats            ? String(l.seats) : "5",
    doors:              l.doors            ? String(l.doors) : "4",
    airConditioning:    a.airConditioning  ?? true,
    pricePerDay:        l.pricePerDay      ? String(l.pricePerDay) : "",
    currency:           l.currency         ?? "USD",
    cancellationPolicy: l.cancellationPolicy ?? "flexible",
    mileagePolicy:      l.mileagePolicy    ?? "unlimited",
    mileageLimitKm:     l.mileageLimitKm   != null ? String(l.mileageLimitKm) : "",
    extraKmRate:        a.extraKmRate      != null ? String(a.extraKmRate)     : "",
    fuelPolicy:         a.fuelPolicy       ?? "full_to_full",
    insuranceType:      a.insuranceType    ?? "standard",
    minimumDriverAge:   a.minimumDriverAge != null ? String(a.minimumDriverAge) : "21",
    securityDeposit:    a.securityDeposit  != null ? String(a.securityDeposit)  : "",
    deliveryEnabled:    a.deliveryEnabled  ?? false,
    deliveryRadiusKm:   a.deliveryRadiusKm != null ? String(a.deliveryRadiusKm) : "",
    deliveryFee:        a.deliveryFee      != null ? String(a.deliveryFee)      : "",
    roadsideAssistance: a.roadsideAssistance ?? false,
    crossBorderAllowed: a.crossBorderAllowed ?? false,
    airportPickup:      a.airportPickup     ?? false,
    returnSameLocation: a.returnSameLocation ?? true,
  };
}

// ── Payload builder — CAR FIELDS ONLY ───────────────────────────────────────

function buildPayload(s: CarState): Record<string, unknown> {
  const p: Record<string, unknown> = {};

  if (s.name.trim())        p.name         = s.name.trim();
  if (s.description.trim()) p.description  = s.description.trim();
  if (s.carMake.trim())     p.carMake      = s.carMake.trim();
  if (s.carModel.trim())    p.carModel     = s.carModel.trim();
  const year = Number(s.carYear);
  if (year >= 1990)         p.carYear      = year;
  if (s.carCategory)        p.carCategory  = s.carCategory;
  if (s.licencePlate.trim()) p.licencePlate = s.licencePlate.trim().toUpperCase();
  if (s.odometerReading !== "") p.odometerReading = Number(s.odometerReading);
  const units = Number(s.unitCount);
  if (units >= 1)           p.unitCount    = units;

  if (s.address.trim())     p.address      = s.address.trim();
  if (s.lat !== null)       p.lat          = s.lat;
  if (s.lng !== null)       p.lng          = s.lng;
  if (s.town.trim())        p.town         = s.town.trim();
  if (s.country.trim())     p.country      = s.country.trim();

  if (s.transmission)       p.transmission = s.transmission;
  if (s.fuelType)           p.fuelType     = s.fuelType;
  if (s.driveType)          p.driveType    = normalizeDriveType(s.driveType);
  const seats = Number(s.seats);
  if (seats >= 1)           p.seats        = seats;
  const doors = Number(s.doors);
  if (doors >= 2)           p.doors        = doors;
  p.airConditioning = s.airConditioning;

  const price = Number(s.pricePerDay);
  if (price > 0)            p.pricePerDay  = price;
  if (s.currency)           p.currency     = s.currency;
  if (s.cancellationPolicy) p.cancellationPolicy = s.cancellationPolicy;
  if (s.mileagePolicy)      p.mileagePolicy = s.mileagePolicy;

  if (s.mileagePolicy === "limited") {
    if (s.mileageLimitKm !== "") p.mileageLimitKm = Number(s.mileageLimitKm);
    if (s.extraKmRate    !== "") p.extraKmRate    = Number(s.extraKmRate);
  }

  if (s.fuelPolicy)      p.fuelPolicy     = s.fuelPolicy;
  if (s.insuranceType)   p.insuranceType  = s.insuranceType;
  const age = Number(s.minimumDriverAge);
  if (age >= 16)         p.minimumDriverAge = age;
  if (s.securityDeposit !== "") p.securityDeposit = Number(s.securityDeposit);

  p.deliveryEnabled = s.deliveryEnabled;
  if (s.deliveryEnabled) {
    if (s.deliveryRadiusKm !== "") p.deliveryRadiusKm = Number(s.deliveryRadiusKm);
    if (s.deliveryFee      !== "") p.deliveryFee      = Number(s.deliveryFee);
  }

  p.roadsideAssistance = s.roadsideAssistance;
  p.crossBorderAllowed = s.crossBorderAllowed;
  p.airportPickup      = s.airportPickup;
  p.returnSameLocation = s.returnSameLocation;

  return p;
}

// ── Step validation ──────────────────────────────────────────────────────────

type Step = "vehicle" | "specs" | "pricing" | "media";

const currentYear = new Date().getFullYear();

function validateStep(step: Step, s: CarState): string[] {
  switch (step) {
    case "vehicle":
      return [
        !s.name.trim()       && "Listing title is required.",
        !s.carMake.trim()    && "Vehicle make is required.",
        !s.carModel.trim()   && "Vehicle model is required.",
        !(Number(s.carYear) >= 1990 && Number(s.carYear) <= currentYear) && `Vehicle year must be 1990–${currentYear}.`,
        !s.carCategory       && "Vehicle category is required.",
        !s.licencePlate.trim() && "Licence plate is required.",
        s.odometerReading === "" && "Odometer reading is required.",
        !s.address.trim()    && "Pickup address is required.",
        !s.town.trim()       && "Town is required — geocode the address.",
        !s.country.trim()    && "Country is required — geocode the address.",
      ].filter(Boolean) as string[];
    case "specs":
      return [
        !s.transmission && "Transmission type is required.",
        !s.fuelType     && "Fuel type is required.",
        !s.driveType    && "Drive type is required.",
        !(Number(s.seats) >= 1) && "Seats must be at least 1.",
        !(Number(s.doors) >= 2) && "Doors must be at least 2.",
      ].filter(Boolean) as string[];
    case "pricing":
      return [
        !(Number(s.pricePerDay) > 0) && "Daily rate must be greater than 0.",
        !s.currency                  && "Currency is required.",
        !s.cancellationPolicy        && "Cancellation policy is required.",
        !s.mileagePolicy             && "Mileage policy is required.",
        s.mileagePolicy === "limited" && !s.mileageLimitKm && "Mileage limit is required for limited mileage.",
        !s.fuelPolicy                && "Fuel policy is required.",
        !s.insuranceType             && "Insurance type is required.",
        s.deliveryEnabled && !s.deliveryRadiusKm && "Delivery radius is required when delivery is enabled.",
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

const STEPS: FormStep[] = [
  { id: "vehicle", label: "Vehicle Info",       sublabel: "Make, model, location & ID" },
  { id: "specs",   label: "Specifications",     sublabel: "Engine, transmission & features" },
  { id: "pricing", label: "Pricing & Policy",   sublabel: "Daily rate, mileage & extras" },
  { id: "media",   label: "Media & Documents",  sublabel: "Photos & vehicle documents" },
];

const apiErr = (e: any) => e?.response?.data?.error?.message ?? e?.message ?? "An error occurred.";

// ── Component ────────────────────────────────────────────────────────────────

interface Props { listingId: string; listing: Listing; }

export function CarForm({ listingId, listing }: Props) {
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: current } = useQuery<any>({
    queryKey:    ["listing-edit", listingId],
    queryFn:     () => listingApi.get(`/listings/${listingId}`).then((r) => r.data.data ?? r.data),
    initialData: listing,
    staleTime:   30_000,
  });

  const [s, setS]         = useState<CarState>(() => initState(listing));
  const [step, setStep]   = useState<Step>("vehicle");
  const [ok, setOk]       = useState("");
  const [err, setErr]     = useState("");
  const [tried, setTried] = useState(false);

  const set = (k: keyof CarState, v: unknown) => setS((p) => ({ ...p, [k]: v }));

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
    onSuccess:  (r: any) => { refetch(); flash(r.data?.data?.message ?? "Car rental is now live!", "ok"); },
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

  const photos: ExistingPhoto[]    = (current?.photos    ?? []) as ExistingPhoto[];
  const docs:   ExistingDocument[] = (current?.documents ?? []) as ExistingDocument[];
  const status = current?.status ?? listing.status;
  const title  = current?.name  ?? listing.name ?? "Untitled Vehicle";

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
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Car Rental Listing</p>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        </div>
        <div className="ml-auto"><Badge label={status} status={status} /></div>
      </div>

      {ok  && <div className="flex items-center gap-2 rounded-2xl bg-success-50 border border-success/20 px-4 py-3 text-sm text-success-dark"><CheckCircle className="w-4 h-4 text-success shrink-0" />{ok}</div>}
      {err && <div className="flex items-center gap-2 rounded-2xl bg-danger-50  border border-danger/20  px-4 py-3 text-sm text-danger-dark" ><AlertCircle className="w-4 h-4 text-danger shrink-0"  />{err}</div>}

      <FormShell
        steps={STEPS}
        activeStep={step}
        onStepClick={(id) => { setTried(false); setStep(id as Step); }}
        isComplete={isComplete}
        isLocked={isLocked}
      >
        <form onSubmit={handleNext} className="space-y-5">
          <Card className="min-h-[420px]">

            {/* ── Vehicle step ── */}
            {step === "vehicle" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Vehicle Information</h3>
                <Input
                  label="Listing Title"
                  value={s.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="E.g., 2022 Toyota Corolla – Automatic"
                  required
                  error={tried && !s.name.trim() ? "Listing title is required." : undefined}
                />
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Make"
                    value={s.carMake}
                    onChange={(e) => set("carMake", e.target.value)}
                    placeholder="E.g., Toyota"
                    required
                    error={tried && !s.carMake.trim() ? "Required." : undefined}
                  />
                  <Input
                    label="Model"
                    value={s.carModel}
                    onChange={(e) => set("carModel", e.target.value)}
                    placeholder="E.g., Corolla"
                    required
                    error={tried && !s.carModel.trim() ? "Required." : undefined}
                  />
                  <Input
                    label="Year"
                    type="number"
                    min="1990"
                    max={currentYear}
                    value={s.carYear}
                    onChange={(e) => set("carYear", e.target.value)}
                    required
                    error={tried && !(Number(s.carYear) >= 1990) ? "Required." : undefined}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Select
                    label="Vehicle Category"
                    value={s.carCategory}
                    onChange={(e) => set("carCategory", e.target.value)}
                    options={CAR_CATEGORIES}
                  />
                  <Input
                    label="Licence Plate"
                    value={s.licencePlate}
                    onChange={(e) => set("licencePlate", e.target.value.toUpperCase())}
                    placeholder="E.g., ABC 123"
                    required
                    error={tried && !s.licencePlate.trim() ? "Required." : undefined}
                  />
                  <Input
                    label="Odometer (km)"
                    type="number"
                    min="0"
                    value={s.odometerReading}
                    onChange={(e) => set("odometerReading", e.target.value)}
                    required
                    error={tried && s.odometerReading === "" ? "Required." : undefined}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Fleet Count (units)"
                    type="number"
                    min="1"
                    value={s.unitCount}
                    onChange={(e) => set("unitCount", e.target.value)}
                  />
                </div>
                <Textarea
                  label="Description (optional)"
                  value={s.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe the vehicle, its condition, included extras, etc."
                  rows={3}
                  maxLength={1000}
                />
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Pickup Location</p>
                  <GeocodedAddressFields
                    address={s.address}
                    town={s.town}
                    country={s.country}
                    addressLabel="Pickup Address"
                    onChange={(f, v) => set(f, f === "country" ? v.toUpperCase().slice(0, 2) : v)}
                    onGeocoded={(r) => setS((p) => ({ ...p, lat: r.lat, lng: r.lng, town: r.town, country: r.country }))}
                    errors={tried ? {
                      address: !s.address.trim() ? "Pickup address is required." : undefined,
                      town:    !s.town.trim()    ? "Town is required."           : undefined,
                      country: !s.country.trim() ? "Country is required."        : undefined,
                    } : undefined}
                  />
                </div>
              </div>
            )}

            {/* ── Specs step ── */}
            {step === "specs" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Specifications</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Select
                    label="Transmission"
                    value={s.transmission}
                    onChange={(e) => set("transmission", e.target.value)}
                    options={TRANSMISSION_OPTIONS}
                  />
                  <Select
                    label="Fuel Type"
                    value={s.fuelType}
                    onChange={(e) => set("fuelType", e.target.value)}
                    options={FUEL_TYPE_OPTIONS}
                  />
                  <Select
                    label="Drive Type"
                    value={s.driveType}
                    onChange={(e) => set("driveType", e.target.value)}
                    options={DRIVE_TYPE_OPTIONS}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Seats"
                    type="number" min="1"
                    value={s.seats}
                    onChange={(e) => set("seats", e.target.value)}
                    required
                    error={tried && !(Number(s.seats) >= 1) ? "At least 1 seat required." : undefined}
                  />
                  <Input
                    label="Doors"
                    type="number" min="2"
                    value={s.doors}
                    onChange={(e) => set("doors", e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={s.airConditioning}
                    onChange={(e) => set("airConditioning", e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700">Air Conditioning</span>
                </label>
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Optional Features</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {([
                      ["roadsideAssistance", "Roadside Assistance"],
                      ["crossBorderAllowed", "Cross-Border Allowed"],
                      ["airportPickup",      "Airport Pickup"],
                      ["returnSameLocation", "Return to Same Location"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={s[key] as boolean}
                          onChange={(e) => set(key, e.target.checked)}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Pricing step ── */}
            {step === "pricing" && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-slate-900">Pricing & Policy</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Daily Rate"
                    type="number" step="0.01" min="0.01"
                    value={s.pricePerDay}
                    onChange={(e) => set("pricePerDay", e.target.value)}
                    required
                    error={tried && !(Number(s.pricePerDay) > 0) ? "Daily rate must be > 0." : undefined}
                  />
                  <Select label="Currency" value={s.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCIES} />
                </div>
                <Select
                  label="Cancellation Policy"
                  value={s.cancellationPolicy}
                  onChange={(e) => set("cancellationPolicy", e.target.value)}
                  options={CANCELLATION_POLICIES}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Mileage Policy"
                    value={s.mileagePolicy}
                    onChange={(e) => set("mileagePolicy", e.target.value)}
                    options={MILEAGE_POLICY_OPTIONS}
                  />
                  {s.mileagePolicy === "limited" && (
                    <Input
                      label="Daily Km Limit"
                      type="number" min="1"
                      value={s.mileageLimitKm}
                      onChange={(e) => set("mileageLimitKm", e.target.value)}
                      required
                      error={tried && !s.mileageLimitKm ? "Required." : undefined}
                    />
                  )}
                </div>
                {s.mileagePolicy === "limited" && (
                  <Input
                    label="Extra Km Rate"
                    type="number" min="0"
                    value={s.extraKmRate}
                    onChange={(e) => set("extraKmRate", e.target.value)}
                    placeholder="Rate per extra km"
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Fuel Policy"     value={s.fuelPolicy}     onChange={(e) => set("fuelPolicy",     e.target.value)} options={FUEL_POLICY_OPTIONS} />
                  <Select label="Insurance Type"  value={s.insuranceType}  onChange={(e) => set("insuranceType",  e.target.value)} options={INSURANCE_TYPE_OPTIONS} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Min Driver Age"     type="number" min="16" max="100" value={s.minimumDriverAge} onChange={(e) => set("minimumDriverAge", e.target.value)} />
                  <Input label="Security Deposit"   type="number" min="0"            value={s.securityDeposit}  onChange={(e) => set("securityDeposit",  e.target.value)} placeholder="0.00" />
                </div>

                {/* Delivery */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Delivery Service</p>
                      <p className="text-xs text-slate-400 mt-0.5">Offer vehicle delivery to guests.</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={s.deliveryEnabled} onChange={(e) => set("deliveryEnabled", e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
                      <span className="text-sm font-semibold text-slate-700">Enabled</span>
                    </label>
                  </div>
                  {s.deliveryEnabled && (
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 animate-fade-in">
                      <Input
                        label="Delivery Radius (km)"
                        type="number" min="1"
                        value={s.deliveryRadiusKm}
                        onChange={(e) => set("deliveryRadiusKm", e.target.value)}
                        required
                        error={tried && !s.deliveryRadiusKm ? "Required." : undefined}
                      />
                      <Input
                        label="Delivery Fee"
                        type="number" min="0"
                        value={s.deliveryFee}
                        onChange={(e) => set("deliveryFee", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Media step ── */}
            {step === "media" && (
              <div className="space-y-6 animate-fade-in">
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
                <div className="border-t border-border pt-5">
                  <DocumentUploader
                    listingId={listingId}
                    category="car"
                    existingDocuments={docs}
                    onRefresh={refetch}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/listings")}>Exit</Button>
              {step !== "vehicle" && (
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
