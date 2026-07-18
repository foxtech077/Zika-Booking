"use client";

/**
 * HotelForm — Hotel-only listing form.
 * Payload contains ONLY hotel fields. No car or apartment fields ever reach the API.
 * Steps: Property Info → Pricing & Policies → Room Setup → Media & Documents
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, CheckCircle, AlertCircle,
  ShieldAlert, Award, Plus, Trash2, Edit
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/provider";
import type { HotelRoomType } from "@/types";
import { CurrencyCombobox } from "@/components/ui/CurrencyCombobox";
import { FormShell, type FormStep } from "./shared/FormShell";
import { useAuthStore } from "@/stores/auth";
import { PayoutCurrencyWarning } from "./shared/PayoutCurrencyWarning";
import { GeocodedAddressFields } from "./shared/GeocodedAddressFields";
import { AMENITY_OPTIONS, CATEGORY_MAP, groupAmenities, flattenGroupedAmenities } from "./shared/amenities";
import { MediaUploader, type ExistingPhoto } from "../../../components/MediaUploader";
import { DocumentUploader, type ExistingDocument } from "../../../components/DocumentUploader";
import { getCurrencyForCountry } from "./shared/countryCurrencyMap";

// ── Enums (values match backend exactly) ────────────────────────────────────

const ROOM_TYPES = [
  { value: "standard", label: "Standard Room" },
  { value: "superior", label: "Superior Room" },
  { value: "deluxe", label: "Deluxe Room" },
  { value: "suite", label: "Suite" },
  { value: "junior_suite", label: "Junior Suite" },
  { value: "studio", label: "Studio" },
  { value: "family_room", label: "Family Room" },
  { value: "presidential_suite", label: "Presidential Suite" },
];

const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible – free cancellation up to 24 h" },
  { value: "moderate", label: "Moderate – free cancellation up to 5 days" },
  { value: "strict", label: "Strict – no refund within 14 days" },
];

// ── State type ───────────────────────────────────────────────────────────────

type HotelState = {
  name: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  town: string;
  neighborhood: string;
  country: string;
  // claimedStarRating intentionally omitted — ratings are set by traveller reviews only.
  currency: string;
  minStayNights: string;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  selectedAmenities: string[];
  customAmenities: string[];
  customInput: string;
  roomTypes: HotelRoomType[];
};

function initState(l: Listing): HotelState {
  return {
    name: l.name ?? "",
    description: l.description ?? "",
    address: l.address ?? "",
    lat: (l as any).lat ?? null,
    lng: (l as any).lng ?? null,
    town: l.town ?? "",
    neighborhood: (l as any).neighborhood ?? "",
    country: l.country ?? "",
    // claimedStarRating intentionally excluded — ratings come from traveller reviews.
    currency: l.currency ?? "USD",
    minStayNights: l.minStayNights ? String(l.minStayNights) : "1",
    checkinTime: l.checkinTime ?? "14:00",
    checkoutTime: l.checkoutTime ?? "11:00",
    cancellationPolicy: l.cancellationPolicy ?? "flexible",
    smokingAllowed: l.smokingAllowed ?? false,
    petsAllowed: l.petsAllowed ?? false,
    selectedAmenities: flattenGroupedAmenities((l as any).amenities),
    customAmenities: ((l as any).customAmenities ?? []).map((a: any) =>
      typeof a === "string" ? a : (a?.label ?? "")),
    customInput: "",
    roomTypes: l.hotelRoomTypes ?? [],
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
  p.lat = toNullableNumber(s.lat);
  p.lng = toNullableNumber(s.lng);
  p.town = trimOrNull(s.town);
  p.neighborhood = trimOrNull(s.neighborhood);
  p.country = countryOrNull(s.country);

  // Pricing
  if (s.currency) p.currency = s.currency;

  const nights = toNullableInt(s.minStayNights);
  if (nights !== null && nights >= 1) p.minStayNights = nights;

  p.checkinTime = s.checkinTime || null;
  p.checkoutTime = s.checkoutTime || null;
  if (s.cancellationPolicy) p.cancellationPolicy = s.cancellationPolicy;

  p.smokingAllowed = s.smokingAllowed;
  p.petsAllowed = s.petsAllowed;

  p.amenities = groupAmenities(s.selectedAmenities);
  p.customAmenities = s.customAmenities.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return p;
}

// ── Step validation ──────────────────────────────────────────────────────────

type Step = "property" | "pricing" | "rooms" | "media";

function validateStep(step: Step, s: HotelState): string[] {
  switch (step) {
    case "property":
      return [
        !s.name.trim() && "Hotel name is required.",
        !s.address.trim() && "Address is required.",
      ].filter(Boolean) as string[];
    case "pricing":
      return [
        !s.currency && "Currency is required.",
        !(Number(s.minStayNights) >= 1) && "Minimum stay must be at least 1 night.",
        !s.checkinTime && "Check-in time is required.",
        !s.checkoutTime && "Check-out time is required.",
        !s.cancellationPolicy && "Cancellation policy is required.",
      ].filter(Boolean) as string[];
    case "rooms":
      return [
        s.roomTypes.length === 0 && "At least one active room type is required before proceeding.",
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

// ── Steps definition ─────────────────────────────────────────────────────────

const STEPS: FormStep[] = [
  { id: "property", label: "Property Info", sublabel: "Name, description & location" },
  { id: "pricing", label: "Pricing & Policies", sublabel: "Rates, times & cancellation" },
  { id: "rooms", label: "Room Setup", sublabel: "Room type, inventory & amenities" },
  { id: "media", label: "Media & Documents", sublabel: "Photos & verification documents" },
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
  const qc = useQueryClient();
  const providerCountry = useAuthStore((st) => st.user?.country);

  const { data: current } = useQuery<any>({
    queryKey: ["listing-edit", listingId],
    queryFn: () => listingApi.get(`/listings/${listingId}`).then((r) => r.data.data ?? r.data),
    initialData: listing,
    staleTime: 30_000,
  });

  // ── Dedicated room-types query ──────────────────────────────────────────────
  const {
    data: roomTypesData,
    isLoading: roomTypesLoading,
  } = useQuery<any[]>({
    queryKey: ["room-types", listingId],
    queryFn: () =>
      listingApi
        .get(`/listings/${listingId}/room-types`)
        .then((r) => r.data.data ?? r.data),
    staleTime: 30_000,
  });

  const [s, setS] = useState<HotelState>(() => initState(listing));
  const [step, setStep] = useState<Step>("property");
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [tried, setTried] = useState(false);

  const set = (k: keyof HotelState, v: unknown) => setS((p) => ({ ...p, [k]: v }));

  // Keep local roomTypes in sync with the dedicated room-types query
  useEffect(() => {
    if (roomTypesData) {
      set("roomTypes", roomTypesData);
    }
  }, [roomTypesData]);

  // Room type sub-form state
  const [showRtForm, setShowRtForm] = useState(false);
  const [editingRt, setEditingRt] = useState<HotelRoomType | null>(null);
  const [rtName, setRtName] = useState("");
  const [rtType, setRtType] = useState("standard");
  const [rtDescription, setRtDescription] = useState("");
  const [rtPrice, setRtPrice] = useState("");
  const [rtUnits, setRtUnits] = useState("1");
  const [rtMaxGuests, setRtMaxGuests] = useState("2");
  const [rtError, setRtError] = useState("");
  const [rtSaving, setRtSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const resetRtForm = () => {
    setRtName("");
    setRtType("standard");
    setRtDescription("");
    setRtPrice("");
    setRtUnits("1");
    setRtMaxGuests("2");
    setRtError("");
    setEditingRt(null);
    setShowRtForm(false);
  };

  const handleEditRt = (rt: HotelRoomType) => {
    setEditingRt(rt);
    setRtName(rt.name);
    setRtType(rt.roomType);
    setRtDescription(rt.description ?? "");
    setRtPrice(String(rt.pricePerNight));
    setRtUnits(String(rt.unitCount));
    setRtMaxGuests(String(rt.maxGuests ?? 2));
    setRtError("");
    setShowRtForm(true);
  };

  const handleSaveRt = async (e: React.FormEvent) => {
    e.preventDefault();
    setRtError("");

    if (!rtName.trim()) { setRtError("Room type name is required."); return; }
    if (!(Number(rtPrice) > 0)) { setRtError("Price must be greater than 0."); return; }
    if (!(Number(rtUnits) >= 1)) { setRtError("Unit count must be at least 1."); return; }

    const payload = {
      name: rtName.trim(),
      roomType: rtType,
      description: rtDescription.trim() || undefined,
      pricePerNight: Number(rtPrice),
      unitCount: Math.trunc(Number(rtUnits)),
      maxGuests: rtMaxGuests ? Math.trunc(Number(rtMaxGuests)) : undefined,
    };

    setRtSaving(true);
    try {
      if (editingRt) {
        // Update
        const res = await listingApi.patch(`/listings/${listingId}/room-types/${editingRt.id}`, payload);
        if (res.data.success) {
          refetch();
          resetRtForm();
          flash("Room type updated.", "ok");
        } else {
          setRtError(res.data?.error?.message ?? "Failed to save room type.");
        }
      } else {
        // Create
        const res = await listingApi.post(`/listings/${listingId}/room-types`, payload);
        if (res.data.success) {
          refetch();
          resetRtForm();
          flash("Room type added.", "ok");
        } else {
          setRtError(res.data?.error?.message ?? "Failed to save room type.");
        }
      }
    } catch (e: any) {
      setRtError(e?.response?.data?.error?.message ?? e?.message ?? "Failed to save room type.");
    } finally {
      setRtSaving(false);
    }
  };

  const handleDeleteRt = (rtId: string) => {
    setConfirmDelete(rtId);
  };

  const confirmDeleteRt = async () => {
    if (!confirmDelete) return;
    const rtId = confirmDelete;
    setConfirmDelete(null);
    try {
      const res = await listingApi.delete(`/listings/${listingId}/room-types/${rtId}`);
      if (res.data.success) {
        refetch();
        flash("Room type deactivated.", "ok");
      } else {
        flash(res.data?.error?.message ?? "Failed to delete room type.", "err");
      }
    } catch (e: any) {
      flash(e?.response?.data?.error?.message ?? e?.message ?? "Failed to delete room type.", "err");
    }
  };

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
    qc.invalidateQueries({ queryKey: ["room-types", listingId] });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: () => listingApi.patch(`/listings/${listingId}`, buildPayload(s)),
    onSuccess: () => { refetch(); flash("Changes saved.", "ok"); },
    onError: (e: any) => flash(apiErr(e), "err"),
  });

  const submitMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/submit`),
    onSuccess: () => { refetch(); flash("Submitted for admin review!", "ok"); router.push("/dashboard/listings"); },
    onError: (e: any) => flash(apiErr(e), "err"),
  });

  const reactivateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/reactivate`),
    onSuccess: () => { refetch(); flash("Listing reactivated.", "ok"); router.push("/dashboard/listings"); },
    onError: (e: any) => flash(apiErr(e), "err"),
  });

  const deactivateMut = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/deactivate`),
    onSuccess: () => { refetch(); flash("Listing deactivated.", "ok"); },
    onError: (e: any) => flash(apiErr(e), "err"),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  const photos: ExistingPhoto[] = (current?.photos ?? []) as ExistingPhoto[];
  const docs: ExistingDocument[] = (current?.documents ?? []) as ExistingDocument[];
  const status = current?.status ?? listing.status;
  const title = current?.name ?? listing.name ?? "Untitled Hotel";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
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
                      neighborhood={s.neighborhood}
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
                          neighborhood: r.neighborhood,
                          country: r.country,
                          // Auto-populate currency from geocoded country (only if a mapping exists)
                          ...(detectedCurrency ? { currency: detectedCurrency } : {}),
                        }));
                      }}
                      errors={tried ? {
                        address: !s.address.trim() ? "Address is required." : undefined,
                        town: !s.town.trim() ? "Town is required." : undefined,
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
                    <PayoutCurrencyWarning
                      providerCountry={providerCountry}
                      listingCountry={s.country}
                      currency={s.currency}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <CurrencyCombobox
                        label="Listing Currency"
                        value={s.currency}
                        onChange={(val) => set("currency", val)}
                      />
                      <Input
                        label="Minimum Stay (nights)"
                        type="number"
                        min="1"
                        value={s.minStayNights}
                        onChange={(e) => set("minStayNights", e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
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
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Room Types Setup</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Define room categories, nightly rates, and active inventory.</p>
                      </div>
                      {!showRtForm && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => { resetRtForm(); setShowRtForm(true); }}
                          className="flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Add Room Type
                        </Button>
                      )}
                    </div>

                    {/* Room Type Add/Edit Form */}
                    {showRtForm && (
                      <Card className="border border-brand/20 bg-brand/5 p-4 rounded-2xl space-y-4 animate-slide-in-up">
                        <h4 className="font-bold text-slate-900 text-sm">
                          {editingRt ? "Edit Room Type" : "Add New Room Type"}
                        </h4>
                        {rtError && (
                          <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">
                            {rtError}
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input
                            label="Display Name (e.g. Deluxe Ocean View)"
                            value={rtName}
                            onChange={(e) => setRtName(e.target.value)}
                            required
                            placeholder="e.g. Standard King Room"
                          />
                          <Select
                            label="Room Classification"
                            value={rtType}
                            onChange={(e) => setRtType(e.target.value)}
                            options={ROOM_TYPES}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Input
                            label="Price per Night"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={rtPrice}
                            onChange={(e) => setRtPrice(e.target.value)}
                            required
                          />
                          <Input
                            label="Units Available (Inventory)"
                            type="number"
                            min="1"
                            value={rtUnits}
                            onChange={(e) => setRtUnits(e.target.value)}
                            required
                          />
                          <Input
                            label="Max Guests"
                            type="number"
                            min="1"
                            value={rtMaxGuests}
                            onChange={(e) => setRtMaxGuests(e.target.value)}
                          />
                        </div>
                        <Textarea
                          label="Room Description (Optional)"
                          value={rtDescription}
                          onChange={(e) => setRtDescription(e.target.value)}
                          placeholder="Describe amenities specific to this room type (e.g. mini-bar, balcony, bath tub)..."
                          rows={2}
                        />
                        <div className="flex justify-end gap-2.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={resetRtForm}
                            disabled={rtSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handleSaveRt}
                            disabled={rtSaving}
                          >
                            {rtSaving ? "Saving..." : "Save Room Type"}
                          </Button>
                        </div>
                      </Card>
                    )}

                    {/* List of existing Room Types */}
                    <div className="space-y-3">
                      {roomTypesLoading ? (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                            <svg className="animate-spin w-4 h-4 text-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Loading room types…
                          </div>
                        </div>
                      ) : s.roomTypes.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                          <p className="text-sm text-slate-500 font-medium">No room types added yet.</p>
                          <p className="text-xs text-slate-400 mt-1">Add at least one room type before submitting this hotel.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm bg-white">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-800 border-b border-slate-100">
                                <th className="p-3 font-semibold">Name</th>
                                <th className="p-3 font-semibold">Classification</th>
                                <th className="p-3 font-semibold">Price/Night</th>
                                <th className="p-3 font-semibold">Inventory</th>
                                <th className="p-3 font-semibold">Guests</th>
                                <th className="p-3 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                              {s.roomTypes.map((rt) => (
                                <tr key={rt.id} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-medium text-slate-900">{rt.name}</td>
                                  <td className="p-3 capitalize">{rt.roomType.replace("_", " ")}</td>
                                  <td className="p-3 font-semibold text-slate-800">{s.currency} {Number(rt.pricePerNight).toLocaleString()}</td>
                                  <td className="p-3">{rt.unitCount} {rt.unitCount > 1 ? "rooms" : "room"}</td>
                                  <td className="p-3">{rt.maxGuests ?? 2} guest{(rt.maxGuests ?? 2) > 1 ? "s" : ""}</td>
                                  <td className="p-3 text-right">
                                    <div className="inline-flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleEditRt(rt)}
                                        className="p-1.5 text-slate-400 hover:text-brand hover:bg-slate-100 rounded-lg transition"
                                        title="Edit"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRt(rt.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                      <h4 className="text-sm font-bold text-slate-900 mb-3">Hotel-Wide Amenities</h4>
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

      {/* ── Custom Delete Confirmation Modal ──────────────────────────── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            {/* Heading */}
            <h2
              id="delete-modal-title"
              className="text-center text-base font-bold text-slate-900 mb-1"
            >
              Delete Room Type?
            </h2>
            <p className="text-center text-sm text-slate-500 leading-relaxed">
              Are you sure you want to delete this room type? This action can't be undone.
            </p>
            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRt}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 active:scale-95 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
