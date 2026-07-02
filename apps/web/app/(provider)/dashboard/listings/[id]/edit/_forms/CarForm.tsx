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
import { CurrencyCombobox } from "@/components/ui/CurrencyCombobox";
import { FormShell, type FormStep } from "./shared/FormShell";
import { GeocodedAddressFields } from "./shared/GeocodedAddressFields";
import { MediaUploader, type ExistingPhoto } from "../../../components/MediaUploader";
import { DocumentUploader, type ExistingDocument } from "../../../components/DocumentUploader";
import { getCurrencyForCountry } from "./shared/countryCurrencyMap";

// ── Enums (values must match backend Zod enum exactly) ───────────────────────

const CAR_CATEGORIES = [
  { value: "Economy", label: "Economy" },
  { value: "Compact", label: "Compact" },
  { value: "SUV", label: "SUV" },
  { value: "Minivan", label: "Minivan" },
  { value: "Pickup", label: "Pickup" },
  { value: "Luxury", label: "Luxury" },
  { value: "Electric", label: "Electric" },
  { value: "Convertible", label: "Convertible" },
];

const TRANSMISSION_OPTIONS = [
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
  { value: "semi_auto", label: "Semi-Automatic" },
];

const FUEL_TYPE_OPTIONS = [
  { value: "petrol", label: "Petrol / Gasoline" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
  { value: "lpg", label: "LPG" },
];

// Backend accepts: "2WD" | "4WD" | "AWD"
const DRIVE_TYPE_OPTIONS = [
  { value: "2WD", label: "Two-Wheel Drive (2WD)" },
  { value: "4WD", label: "Four-Wheel Drive (4WD)" },
  { value: "AWD", label: "All-Wheel Drive (AWD)" },
];

const MILEAGE_POLICY_OPTIONS = [
  { value: "unlimited", label: "Unlimited Mileage" },
  { value: "limited", label: "Limited Mileage" },
];

const FUEL_POLICY_OPTIONS = [
  { value: "full_to_full", label: "Full to Full" },
  // { value: "same_to_same", label: "Same to Same" },
  // { value: "free_tank", label: "Free Tank" },
  { value: "full_to_empty", label: "Full to Empty" },
  { value: "pre_purchase", label: "Pre-purchase" },
];

const INSURANCE_TYPE_OPTIONS = [
  // { value: "basic", label: "Basic" },
  // { value: "standard", label: "Standard" },
  // { value: "premium", label: "Premium" },
  { value: "basic_third_party", label: "Basic Third Party" },
  { value: "comprehensive", label: "Comprehensive" },
  { value: "premium_zero_excess", label: "Premium Zero Excess" },
];

const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible – free cancellation up to 24 h" },
  { value: "moderate", label: "Moderate – free cancellation up to 5 days" },
  { value: "strict", label: "Strict – no refund within 14 days" },
];

const CAR_CATEGORY_VALUES = new Set(CAR_CATEGORIES.map((x) => x.value));
const TRANSMISSION_VALUES = new Set(TRANSMISSION_OPTIONS.map((x) => x.value));
const FUEL_TYPE_VALUES = new Set(FUEL_TYPE_OPTIONS.map((x) => x.value));
const MILEAGE_POLICY_VALUES = new Set(MILEAGE_POLICY_OPTIONS.map((x) => x.value));
const FUEL_POLICY_VALUES = new Set(FUEL_POLICY_OPTIONS.map((x) => x.value));
const INSURANCE_TYPE_VALUES = new Set(INSURANCE_TYPE_OPTIONS.map((x) => x.value));
const CANCELLATION_POLICY_VALUES = new Set(CANCELLATION_POLICIES.map((x) => x.value));

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
  colour: string;
  engineSize: string;
  minimumRentalDays: string;
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
  pickupHoursFrom: string;
  pickupHoursTo: string;
  deliveryEnabled: boolean;
  deliveryRadiusKm: string;
  deliveryFee: string;
  roadsideAssistance: boolean;
  crossBorderAllowed: boolean;
  airportPickup: boolean;
  returnSameLocation: boolean;
  instantBooking: boolean;
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

function normalizeSelectValue(v: unknown, allowed: Set<string>, fallback: string): string {
  if (typeof v !== "string") return fallback;
  return allowed.has(v) ? v : fallback;
}

function normalizeTransmission(v: unknown): string {
  if (typeof v !== "string") return "automatic";
  const normalized = v.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "semi_automatic") return "semi_auto";
  return normalizeSelectValue(normalized, TRANSMISSION_VALUES, "automatic");
}

function normalizeFuelType(v: unknown): string {
  if (typeof v !== "string") return "petrol";
  const normalized = v.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "gasoline" || normalized === "gas" || normalized === "supercharged_v8") return "petrol";
  if (normalized === "premium_hybrid" || normalized === "diesel_hybrid") return "hybrid";
  if (normalized === "100%_electric") return "electric";
  return normalizeSelectValue(normalized, FUEL_TYPE_VALUES, "petrol");
}

function normalizeDriveType(v: unknown): string {
  if (typeof v !== "string") return "2WD";
  const normalized = v.toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "4WD" || normalized === "FOUR_WD") return "4WD";
  if (normalized === "AWD") return "AWD";
  return "2WD";
}

function initState(l: Listing): CarState {
  const a = l as any;
  return {
    name: l.name ?? "",
    description: l.description ?? "",
    carMake: l.carMake ?? "",
    carModel: l.carModel ?? "",
    carYear: l.carYear ? String(l.carYear) : String(new Date().getFullYear()),
    carCategory: normalizeSelectValue(a.carCategory, CAR_CATEGORY_VALUES, "Economy"),
    licencePlate: a.licencePlate ?? "",
    odometerReading: a.odometerReading != null ? String(a.odometerReading) : "",
    unitCount: l.unitCount ? String(l.unitCount) : "1",
    colour: a.colour ?? "",
    engineSize: a.engineSize ?? "",
    minimumRentalDays: a.minimumRentalDays != null ? String(a.minimumRentalDays) : "1",
    address: l.address ?? "",
    lat: toNullableNumber(a.lat),
    lng: toNullableNumber(a.lng),
    town: l.town ?? "",
    country: l.country ?? "",
    transmission: normalizeTransmission(l.transmission),
    fuelType: normalizeFuelType(l.fuelType),
    driveType: normalizeDriveType(a.driveType),
    seats: l.seats ? String(l.seats) : "5",
    doors: l.doors ? String(l.doors) : "4",
    airConditioning: a.airConditioning ?? true,
    pricePerDay: l.pricePerDay ? String(l.pricePerDay) : "",
    currency: l.currency ?? "USD",
    pickupHoursFrom: a.pickupHoursFrom ?? "",
    pickupHoursTo: a.pickupHoursTo ?? "",
    cancellationPolicy: normalizeSelectValue(l.cancellationPolicy, CANCELLATION_POLICY_VALUES, "flexible"),
    mileagePolicy: normalizeSelectValue(l.mileagePolicy, MILEAGE_POLICY_VALUES, "unlimited"),
    mileageLimitKm: l.mileageLimitKm != null ? String(l.mileageLimitKm) : "",
    extraKmRate: a.extraKmRate != null ? String(a.extraKmRate) : "",
    fuelPolicy: normalizeSelectValue(a.fuelPolicy, FUEL_POLICY_VALUES, "full_to_full"),
    insuranceType: normalizeSelectValue(a.insuranceType, INSURANCE_TYPE_VALUES, "standard"),
    minimumDriverAge: a.minimumDriverAge != null ? String(a.minimumDriverAge) : "21",
    securityDeposit: a.securityDeposit != null ? String(a.securityDeposit) : "",
    deliveryEnabled: a.deliveryEnabled ?? false,
    deliveryRadiusKm: a.deliveryRadiusKm != null ? String(a.deliveryRadiusKm) : "",
    deliveryFee: a.deliveryFee != null ? String(a.deliveryFee) : "",
    roadsideAssistance: a.roadsideAssistance ?? false,
    crossBorderAllowed: a.crossBorderAllowed ?? false,
    airportPickup: a.airportPickup ?? false,
    returnSameLocation: a.returnSameLocation ?? true,
    instantBooking: a.instantBooking ?? false,
  };
}

// ── Payload builder — CAR FIELDS ONLY ───────────────────────────────────────

function buildPayload(s: CarState): Record<string, unknown> {
  const p: Record<string, unknown> = {};

  p.name = s.name.trim();
  p.description = trimOrNull(s.description);
  p.carMake = trimOrNull(s.carMake);
  p.carModel = trimOrNull(s.carModel);
  const year = toNullableInt(s.carYear);
  p.carYear = year !== null && year >= 1990 && year <= currentYear ? year : null;
  p.carCategory = normalizeSelectValue(s.carCategory, CAR_CATEGORY_VALUES, "Economy");
  p.licencePlate = trimOrNull(s.licencePlate.toUpperCase());
  const odometer = toNullableInt(s.odometerReading);
  p.odometerReading = odometer !== null && odometer >= 0 ? odometer : null;
  const units = toNullableInt(s.unitCount);
  if (units !== null && units >= 1) p.unitCount = units;

  p.address = trimOrNull(s.address);
  p.lat = toNullableNumber(s.lat);
  p.lng = toNullableNumber(s.lng);
  p.town = trimOrNull(s.town);
  p.country = countryOrNull(s.country);

  p.colour = trimOrNull(s.colour);
  p.engineSize = trimOrNull(s.engineSize);
  const minRentalDays = toNullableInt(s.minimumRentalDays);
  p.minimumRentalDays = minRentalDays !== null && minRentalDays >= 1 ? minRentalDays : null;

  p.transmission = normalizeTransmission(s.transmission);
  p.fuelType = normalizeFuelType(s.fuelType);

  // Normalize and always send backend enum (2WD/4WD/AWD).
  // This ensures UI values are correctly mapped and explicitly sent to the API.
  const _driveType = normalizeDriveType(s.driveType);
  if (_driveType) p.driveType = _driveType;

  const seats = toNullableInt(s.seats);
  p.seats = seats !== null && seats >= 1 ? seats : null;
  const doors = toNullableInt(s.doors);
  p.doors = doors !== null && doors >= 2 ? doors : null;
  p.airConditioning = s.airConditioning;

  const price = toNullableNumber(s.pricePerDay);
  if (price !== null && price > 0) p.pricePerDay = price;
  if (s.currency) p.currency = s.currency;
  if (CANCELLATION_POLICY_VALUES.has(s.cancellationPolicy)) p.cancellationPolicy = s.cancellationPolicy;
  p.mileagePolicy = normalizeSelectValue(s.mileagePolicy, MILEAGE_POLICY_VALUES, "unlimited");

  if (s.mileagePolicy === "limited") {
    const limit = toNullableInt(s.mileageLimitKm);
    p.mileageLimitKm = limit !== null && limit >= 1 ? limit : null;
    const rate = toNullableNumber(s.extraKmRate);
    p.extraKmRate = rate !== null && rate >= 0 ? rate : null;
  } else {
    p.mileageLimitKm = null;
    p.extraKmRate = null;
  }

  p.fuelPolicy = normalizeSelectValue(s.fuelPolicy, FUEL_POLICY_VALUES, "full_to_full");
  p.insuranceType = normalizeSelectValue(s.insuranceType, INSURANCE_TYPE_VALUES, "standard");
  const age = toNullableInt(s.minimumDriverAge);
  p.minimumDriverAge = age !== null && age >= 16 && age <= 100 ? age : null;
  const deposit = toNullableNumber(s.securityDeposit);
  p.securityDeposit = deposit !== null && deposit >= 0 ? deposit : null;

  p.deliveryEnabled = s.deliveryEnabled;
  if (s.deliveryEnabled) {
    const radius = toNullableInt(s.deliveryRadiusKm);
    p.deliveryRadiusKm = radius !== null && radius >= 0 ? radius : null;
    const fee = toNullableNumber(s.deliveryFee);
    p.deliveryFee = fee !== null && fee >= 0 ? fee : null;
  } else {
    p.deliveryRadiusKm = null;
    p.deliveryFee = null;
  }

  p.roadsideAssistance = s.roadsideAssistance;
  p.crossBorderAllowed = s.crossBorderAllowed;
  p.airportPickup = s.airportPickup;
  p.returnSameLocation = s.returnSameLocation;
  p.pickupHoursFrom = s.pickupHoursFrom || null;
  p.pickupHoursTo = s.pickupHoursTo || null;
  p.instantBooking = s.instantBooking;

  return p;
}

// ── Step validation ──────────────────────────────────────────────────────────

type Step = "basics" | "vehicle" | "specs" | "pricing" | "media";

const currentYear = new Date().getFullYear();

function validateStep(step: Step, s: CarState): string[] {
  switch (step) {
    case "vehicle":
      return [
        !s.name.trim() && "Listing title is required.",
        !s.carMake.trim() && "Vehicle make is required.",
        !s.carModel.trim() && "Vehicle model is required.",
        !(Number(s.carYear) >= 1990 && Number(s.carYear) <= currentYear) && `Vehicle year must be 1990–${currentYear}.`,
        !s.carCategory && "Vehicle category is required.",
        !s.licencePlate.trim() && "Licence plate is required.",
        s.odometerReading === "" && "Odometer reading is required.",
        !s.address.trim() && "Pickup address is required.",
      ].filter(Boolean) as string[];
    case "specs":
      return [
        !s.transmission && "Transmission type is required.",
        !s.fuelType && "Fuel type is required.",
        !s.driveType && "Drive type is required.",
        !(Number(s.seats) >= 1) && "Seats must be at least 1.",
        !(Number(s.doors) >= 2) && "Doors must be at least 2.",
      ].filter(Boolean) as string[];
    case "pricing":
      return [
        !(Number(s.pricePerDay) > 0) && "Daily rate must be greater than 0.",
        !s.currency && "Currency is required.",
        s.minimumRentalDays !== "" && Number(s.minimumRentalDays) < 1 && "Minimum rental days must be at least 1.",
        !s.cancellationPolicy && "Cancellation policy is required.",
        !s.mileagePolicy && "Mileage policy is required.",
        s.mileagePolicy === "limited" && !s.mileageLimitKm && "Mileage limit is required for limited mileage.",
        !s.fuelPolicy && "Fuel policy is required.",
        !s.insuranceType && "Insurance type is required.",
        s.deliveryEnabled && !s.deliveryRadiusKm && "Delivery radius is required when delivery is enabled.",
        s.pickupHoursFrom && s.pickupHoursTo && s.pickupHoursFrom >= s.pickupHoursTo && "Pickup hours must be valid and end after start.",
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

const STEPS: FormStep[] = [
  { id: "vehicle", label: "Identity & classification", sublabel: "Basic Info" },
  { id: "specs", label: "Technical specs", sublabel: "Features" },
  { id: "pricing", label: "Rental terms & insurance", sublabel: "Pricing" },
  { id: "media", label: "Media & Documents", sublabel: "Uploads" },
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

export function CarForm({ listingId, listing }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: current } = useQuery<any>({
    queryKey: ["listing-edit", listingId],
    queryFn: () => listingApi.get(`/listings/${listingId}`).then((r) => r.data.data ?? r.data),
    initialData: listing,
    staleTime: 30_000,
  });

  const [s, setS] = useState<CarState>(() => initState(listing));
  const [step, setStep] = useState<Step>("vehicle");
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [tried, setTried] = useState(false);

  const set = (k: keyof CarState, v: unknown) => setS((p) => ({ ...p, [k]: v }));

  const isComplete = (id: string) => validateStep(id as Step, s).length === 0;
  const isLocked = (id: string) => {
    const idx = STEPS.findIndex((t) => t.id === id);
    if (idx <= 0) return false;
    return STEPS.slice(0, idx).some((t) => !isComplete(t.id));
  };

  const flash = (msg: string, type: "ok" | "err") => {
    if (type === "ok") { setOk(msg); setErr(""); setTimeout(() => setOk(""), 3500); }
    else { setErr(msg); setOk(""); }
  };

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["listing-edit", listingId] });
    qc.invalidateQueries({ queryKey: ["provider-listings"] });
  };

  const saveMut = useMutation({
    mutationFn: () => listingApi.patch(`/listings/${listingId}`, buildPayload(s)),
    onSuccess: () => { refetch(); flash("Changes saved.", "ok"); },
    onError: (e: any) => flash(apiErr(e), "err"),
  });

  const activateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/activate`),
    onSuccess: (r: any) => { refetch(); flash(r.data?.data?.message ?? "Car rental is now live!", "ok"); router.push("/dashboard/listings"); },
    onError: (e: any) => flash(apiErr(e), "err"),
  });

  const deactivateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/deactivate`),
    onSuccess: () => { refetch(); flash("Listing deactivated.", "ok"); },
    onError: (e: any) => flash(apiErr(e), "err"),
  });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateStep(step, s);
    if (errs.length) { setTried(true); flash(errs[0]!, "err"); return; }
    setTried(false); setErr("");
    saveMut.mutate(undefined, {
      onSuccess: () => {
        const idx = STEPS.findIndex((t) => t.id === step);
        const next = STEPS[idx + 1];
        if (next) setStep(next.id as Step);
      },
    });
  };

  const photos: ExistingPhoto[] = (current?.photos ?? []) as ExistingPhoto[];
  const docs: ExistingDocument[] = (current?.documents ?? []) as ExistingDocument[];
  const status = current?.status ?? listing.status;
  const title = current?.name ?? listing.name ?? "Untitled Vehicle";

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col flex-1 min-h-0">
        {/* ── Standalone Header Card ── */}
        <div className="bg-white border border-border rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between shrink-0 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/listings")}
              className="w-9 h-9 rounded-xl border border-[#556B2F]/30 bg-white flex items-center justify-center text-[#556B2F] hover:bg-[#e6ebe4] transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#556B2F] uppercase tracking-widest">Car Rental Listing</p>
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#556B2F]/30 text-sm font-semibold text-[#556B2F] bg-white hover:bg-[#e6ebe4] transition-all"
                  >
                    Exit
                  </button>
                  {step !== "vehicle" && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = STEPS.findIndex((t) => t.id === step);
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
                    onClick={(e) => { e.preventDefault(); saveMut.mutate(); router.push("/dashboard/listings"); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#556B2F]/40 text-sm font-semibold text-[#556B2F] bg-white hover:bg-[#e6ebe4] disabled:opacity-50 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Draft
                  </button>
                  {step !== "media" ? (
                    <button
                      type="submit"
                      form="car-edit-form"
                      disabled={saveMut.isPending}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#556B2F] hover:bg-[#3d533a] disabled:opacity-50 transition-all shadow-sm"
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
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#556B2F] hover:bg-[#3d533a] disabled:opacity-50 transition-all shadow-sm"
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
            <form id="car-edit-form" onSubmit={handleNext} className="space-y-5">
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
                  <Input
                    label="Colour"
                    value={s.colour}
                    onChange={(e) => set("colour", e.target.value)}
                    placeholder="E.g., White, Black, Silver"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Engine Size (cc)"
                    type="number"
                    min="0"
                    value={s.engineSize}
                    onChange={(e) => set("engineSize", e.target.value)}
                    placeholder="E.g., 1500"
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
                      address: !s.address.trim() ? "Pickup address is required." : undefined,
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
                    error={tried && !s.driveType ? "Drive type is required" : undefined}
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
                      ["airportPickup", "Airport Pickup"],
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
                  <CurrencyCombobox label="Currency" value={s.currency} onChange={(val) => set("currency", val)} />
                </div>
                <Select
                  label="Cancellation Policy"
                  value={s.cancellationPolicy}
                  onChange={(e) => set("cancellationPolicy", e.target.value)}
                  options={CANCELLATION_POLICIES}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Minimum Rental Days"
                    type="number"
                    min="1"
                    value={s.minimumRentalDays}
                    onChange={(e) => set("minimumRentalDays", e.target.value)}
                    placeholder="1"
                  />
                  <Select
                    label="Mileage Policy"
                    value={s.mileagePolicy}
                    onChange={(e) => set("mileagePolicy", e.target.value)}
                    options={MILEAGE_POLICY_OPTIONS}
                  />
                </div>
                {s.mileagePolicy === "limited" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Daily Km Limit"
                      type="number" min="1"
                      value={s.mileageLimitKm}
                      onChange={(e) => set("mileageLimitKm", e.target.value)}
                      required
                      error={tried && !s.mileageLimitKm ? "Required." : undefined}
                    />
                  </div>
                )}
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
                  <Select label="Fuel Policy" value={s.fuelPolicy} onChange={(e) => set("fuelPolicy", e.target.value)} options={FUEL_POLICY_OPTIONS} />
                  <Select label="Insurance Type" value={s.insuranceType} onChange={(e) => set("insuranceType", e.target.value)} options={INSURANCE_TYPE_OPTIONS} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Pickup Hours From"
                    type="time"
                    value={s.pickupHoursFrom}
                    onChange={(e) => set("pickupHoursFrom", e.target.value)}
                  />
                  <Input
                    label="Pickup Hours To"
                    type="time"
                    value={s.pickupHoursTo}
                    onChange={(e) => set("pickupHoursTo", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Min Driver Age" type="number" min="16" max="100" value={s.minimumDriverAge} onChange={(e) => set("minimumDriverAge", e.target.value)} />
                  <Input label="Security Deposit" type="number" min="0" value={s.securityDeposit} onChange={(e) => set("securityDeposit", e.target.value)} placeholder="0.00" />
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
            </form>
          </FormShell>
        </div>
      </div>
    </div>
  );
}
