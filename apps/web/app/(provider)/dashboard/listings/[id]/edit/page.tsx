"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, ArrowLeft, Save, Globe, DollarSign,
  CheckCircle, AlertCircle, ShieldAlert, Award, CheckSquare, X, Images
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { cn, getCurrencyForCountry } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import type { Listing, ListingCategory } from "@/types/provider";
import { MediaUploader } from "../../components/MediaUploader";
import { DocumentUploader } from "../../components/DocumentUploader";

const AMENITY_OPTIONS = [
  { value: "wifi",      label: "High-Speed Wi-Fi" },
  { value: "pool",      label: "Swimming Pool" },
  { value: "gym",       label: "Fitness Center" },
  { value: "parking",   label: "Free Parking" },
  { value: "ac",        label: "Air Conditioning" },
  { value: "kitchen",   label: "Fully Equipped Kitchen" },
  { value: "workspace", label: "Dedicated Workspace" },
  { value: "breakfast", label: "Complimentary Breakfast" },
];

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
  { value: "flexible", label: "Flexible (Free cancellation up to 24h)" },
  { value: "moderate", label: "Moderate (Free cancellation up to 5 days)" },
  { value: "strict",   label: "Strict (No refund within 14 days)" },
];

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const listingId = params.id as string;

  const [activeTab, setActiveTab] = useState<"basic" | "pricing" | "amenities" | "specs" | "media">("basic");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [customAmenityInput, setCustomAmenityInput] = useState("");

  const { data: listing, isLoading, error } = useQuery<Listing>({
    queryKey: ["edit-listing", listingId],
    queryFn: () => listingApi.get(`/listings/${listingId}`).then((r) => r.data.data ?? r.data),
  });

  const STEPS = [
    { id: "basic" as const,     label: "Basic Details",   sublabel: "Name, description & address",      icon: <Building2 className="w-4 h-4" /> },
    { id: "pricing" as const,   label: "Pricing & Stay",  sublabel: "Rates, check times & rules",        icon: <DollarSign className="w-4 h-4" /> },
    { id: "amenities" as const, label: "Amenities",       sublabel: "Standard & custom inclusions",      icon: <CheckSquare className="w-4 h-4" /> },
    {
      id: "specs" as const,
      label: listing?.category === "car" ? "Vehicle Specs" : "Inventory Details",
      sublabel: listing?.category === "car" ? "Transmission & mileage policy" : "Rooms, guests & sizing",
      icon: <Globe className="w-4 h-4" />
    },
    { id: "media" as const,     label: "Media & Verification", sublabel: "Photos & official documents", icon: <Images className="w-4 h-4" /> },
  ];

  const validateStep = (stepId: string): string[] => {
    const errors: string[] = [];
    if (stepId === "basic") {
      if (!fields.name?.trim()) errors.push("Listing / Property Name is required.");
      if (!fields.address?.trim()) errors.push("Address is required.");
      if (!fields.town?.trim()) errors.push("Town / City is required.");
      if (!fields.country?.trim()) errors.push("Country Code is required.");
    } else if (stepId === "pricing") {
      if (!fields.pricePerNight || Number(fields.pricePerNight) <= 0) errors.push("Valid Price per Night / Daily Rental Price is required.");
      if (!fields.currency) errors.push("Currency is required.");
      if (!fields.minStayNights || Number(fields.minStayNights) <= 0) errors.push("Minimum stay duration must be a positive number.");
    } else if (stepId === "specs") {
      if (listing?.category === "hotel") {
        if (!fields.unitCount || Number(fields.unitCount) <= 0) errors.push("Total Inventory Unit Count must be greater than 0.");
      } else if (listing?.category === "apartment") {
        if (!fields.maxGuests || Number(fields.maxGuests) <= 0) errors.push("Maximum Guests must be greater than 0.");
      } else if (listing?.category === "car") {
        if (!fields.carMake?.trim()) errors.push("Vehicle Make is required.");
        if (!fields.carModel?.trim()) errors.push("Vehicle Model is required.");
        if (!fields.carYear || Number(fields.carYear) < 1900 || Number(fields.carYear) > 2100) errors.push("Valid Vehicle Year (1900-2100) is required.");
        if (!fields.seats || Number(fields.seats) <= 0) errors.push("Seats Capacity must be greater than 0.");
      }
    }
    return errors;
  };

  const isStepUnlocked = (stepId: "basic" | "pricing" | "amenities" | "specs" | "media"): boolean => {
    const index = STEPS.findIndex((s) => s.id === stepId);
    if (index <= 0) return true;
    for (let i = 0; i < index; i++) {
      const step = STEPS[i];
      if (step && validateStep(step.id).length > 0) return false;
    }
    return true;
  };

  const [fields, setFields] = useState<Partial<Listing>>({});
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenities, setCustomAmenities] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  if (listing && !isInitialized) {
    const resolvedCurrency = user?.country ? getCurrencyForCountry(user.country).code : (listing.currency ?? "USD");
    setFields({
      name: listing.name ?? "",
      description: listing.description ?? "",
      pricePerNight: listing.pricePerNight ? String(listing.pricePerNight) : "",
      currency: resolvedCurrency,
      minStayNights: listing.minStayNights ?? 1,
      checkinTime: listing.checkinTime ?? "14:00",
      checkoutTime: listing.checkoutTime ?? "11:00",
      cancellationPolicy: listing.cancellationPolicy ?? "flexible",
      smokingAllowed: listing.smokingAllowed ?? false,
      petsAllowed: listing.petsAllowed ?? false,
      address: listing.address ?? "",
      town: listing.town ?? "",
      country: listing.country ?? "",
      claimedStarRating: listing.claimedStarRating ?? null,
      unitCount: listing.unitCount ?? 1,
      roomType: listing.roomType ?? "standard",
      bedrooms: listing.bedrooms ?? 0,
      bathrooms: listing.bathrooms ?? 0,
      maxGuests: listing.maxGuests ?? 1,
      longStayEnabled: listing.longStayEnabled ?? false,
      longStayMinNights: listing.longStayMinNights ?? 30,
      longStayDiscountType: listing.longStayDiscountType ?? "percentage",
      longStayDiscountValue: listing.longStayDiscountValue ? Number(listing.longStayDiscountValue) : 0,
      carMake: listing.carMake ?? "",
      carModel: listing.carModel ?? "",
      carYear: listing.carYear ?? 2024,
      transmission: listing.transmission ?? "automatic",
      fuelType: listing.fuelType ?? "petrol",
      seats: listing.seats ?? 5,
      doors: listing.doors ?? 4,
      mileagePolicy: listing.mileagePolicy ?? "unlimited",
      mileageLimitKm: listing.mileageLimitKm ?? 300,
    });
    if ((listing as any).amenities) {
      setSelectedAmenities((listing as any).amenities.map((a: any) => a.amenityKey));
    }
    if ((listing as any).customAmenities) {
      setCustomAmenities((listing as any).customAmenities.map((a: any) => a.label));
    }
    setIsInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: (payload: any) => listingApi.patch(`/listings/${listingId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edit-listing", listingId] });
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      setSuccessMsg("Changes saved successfully!");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error?.message ?? "Failed to save changes.");
    }
  });

  const submitMutation = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edit-listing", listingId] });
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      setSuccessMsg("Listing submitted for review!");
      setErrorMsg("");
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error?.message ?? "Pre-submission validation failed.");
    }
  });

  const activateMutation = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/activate`),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["edit-listing", listingId] });
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      setSuccessMsg(res.data?.data?.message ?? "Listing activated successfully!");
      setErrorMsg("");
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error?.message ?? "Activation failed.");
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: () => listingApi.post(`/listings/${listingId}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edit-listing", listingId] });
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      setSuccessMsg("Listing deactivated successfully.");
      setErrorMsg("");
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error?.message ?? "Deactivation failed.");
    }
  });

  const refreshListing = () => {
    void qc.invalidateQueries({ queryKey: ["edit-listing", listingId] });
  };

  const handleFieldChange = (key: string, value: any) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => ({
    ...fields,
    pricePerNight: fields.pricePerNight ? Number(fields.pricePerNight) : undefined,
    unitCount: fields.unitCount ? Number(fields.unitCount) : undefined,
    claimedStarRating: fields.claimedStarRating ? Number(fields.claimedStarRating) : null,
    bedrooms: fields.bedrooms ? Number(fields.bedrooms) : undefined,
    bathrooms: fields.bathrooms ? Number(fields.bathrooms) : undefined,
    maxGuests: fields.maxGuests ? Number(fields.maxGuests) : undefined,
    longStayDiscountValue: fields.longStayDiscountValue ? Number(fields.longStayDiscountValue) : undefined,
    carYear: fields.carYear ? Number(fields.carYear) : undefined,
    seats: fields.seats ? Number(fields.seats) : undefined,
    doors: fields.doors ? Number(fields.doors) : undefined,
    mileageLimitKm: fields.mileageLimitKm ? Number(fields.mileageLimitKm) : undefined,
    amenities: selectedAmenities,
    customAmenities,
  });

  const handleSaveAndNext = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const errors = validateStep(activeTab);
    if (errors.length > 0) {
      setAttemptedSubmit(true);
      setErrorMsg(errors[0] || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setAttemptedSubmit(false);
    setErrorMsg("");
    updateMutation.mutate(buildPayload(), {
      onSuccess: () => {
        const currentIndex = STEPS.findIndex((s) => s.id === activeTab);
        if (currentIndex < STEPS.length - 1) {
          const nextStep = STEPS[currentIndex + 1];
          if (nextStep) {
            setActiveTab(nextStep.id);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }
      }
    });
  };

  const handleSaveDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    setAttemptedSubmit(false);
    setErrorMsg("");
    updateMutation.mutate(buildPayload());
  };

  const toggleAmenity = (key: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const addCustomAmenity = () => {
    if (!customAmenityInput.trim() || customAmenities.includes(customAmenityInput.trim())) return;
    setCustomAmenities((prev) => [...prev, customAmenityInput.trim()]);
    setCustomAmenityInput("");
  };

  const removeCustomAmenity = (tag: string) => {
    setCustomAmenities((prev) => prev.filter((t) => t !== tag));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-10 space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-10 w-64 bg-slate-200 rounded" />
        <div className="h-44 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Failed to load listing</h2>
        <p className="text-slate-500 mt-2">Make sure you own this listing and it hasn&apos;t been deleted.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/listings")}>
          Back to Listings
        </Button>
      </div>
    );
  }

  const photosList = (listing as any).photos ?? [];
  const docsList = (listing as any).documents ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/listings")}
          className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center text-slate-600 hover:bg-surface-muted transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <span className="text-xs font-semibold text-slate-400 capitalize">
            Manage Listings / {listing.category}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            {listing.name ?? "Untitled Listing"}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge label={listing.status} status={listing.status} />
        </div>
      </div>

      {listing.rejectionReasons?.length > 0 && (
        <div className="bg-danger-50 border border-danger/20 rounded-2xl p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-danger-dark">Listing Rejected</h4>
            <p className="text-xs text-danger-dark/80 mt-1">
              {listing.rejectionNote ?? "Please address the following feedback and re-submit:"}
            </p>
            <ul className="list-disc pl-4 space-y-1 mt-2 text-xs text-danger-dark/90">
              {listing.rejectionReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-success-50 border border-success/20 text-success-dark text-sm rounded-2xl p-4 flex items-center gap-2.5 animate-slide-up">
          <CheckCircle className="w-4 h-4 text-success" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-danger-50 border border-danger/20 text-danger-dark text-sm rounded-2xl p-4 flex items-center gap-2.5 animate-slide-up">
          <AlertCircle className="w-4 h-4 text-danger" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-1 space-y-4">
          <Card padding="md" className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300">Registration Progress</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black">{Math.round((STEPS.filter((s) => validateStep(s.id).length === 0).length / STEPS.length) * 100)}%</span>
                <span className="text-xs text-indigo-200 font-medium">{STEPS.filter((s) => validateStep(s.id).length === 0).length} of {STEPS.length} Completed</span>
              </div>
              <div className="w-full bg-slate-800/80 rounded-full h-2 mt-2.5 overflow-hidden border border-slate-700/50">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.round((STEPS.filter((s) => validateStep(s.id).length === 0).length / STEPS.length) * 100)}%` }}
                />
              </div>
            </div>
          </Card>

          <Card padding="none" className="py-2 border border-border shadow-sm">
            {STEPS.map((step, idx) => {
              const isUnlocked = isStepUnlocked(step.id);
              const isCompleted = validateStep(step.id).length === 0;
              const isActive = activeTab === step.id;

              return (
                <button
                  type="button"
                  key={step.id}
                  disabled={!isUnlocked}
                  onClick={() => { if (isUnlocked) { setActiveTab(step.id); setAttemptedSubmit(false); } }}
                  className={cn(
                    "w-full text-left flex items-start gap-3.5 px-4 py-3.5 border-l-2 transition-all duration-200 group relative",
                    isActive ? "border-primary bg-primary-50 text-primary-900 font-semibold" : "border-transparent text-slate-500",
                    isUnlocked && !isActive ? "hover:bg-slate-50 hover:text-slate-900 cursor-pointer" : "",
                    !isUnlocked ? "opacity-50 cursor-not-allowed bg-slate-50/50" : ""
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all duration-200",
                    isActive
                      ? "border-primary bg-primary text-white shadow-glow-primary scale-105"
                      : isCompleted
                        ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                        : isUnlocked
                          ? "border-slate-300 bg-white text-slate-500 group-hover:border-slate-400"
                          : "border-slate-200 bg-slate-100 text-slate-400"
                  )}>
                    {isCompleted && !isActive ? (
                      <span className="text-[10px] font-bold">✓</span>
                    ) : (
                      <span className="text-xs font-bold">{idx + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={cn(
                      "text-xs font-bold transition-colors duration-150",
                      isActive ? "text-primary-800" : isCompleted ? "text-emerald-800" : "text-slate-700"
                    )}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-normal mt-0.5 group-hover:text-slate-500">
                      {step.sublabel}
                    </p>
                  </div>
                  {!isUnlocked && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300">
                      <span className="text-xs">🔒</span>
                    </div>
                  )}
                </button>
              );
            })}
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <form onSubmit={handleSaveAndNext}>
            <Card className="min-h-[420px]">
              {activeTab === "basic" && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-lg font-bold text-slate-900">Basic Information</h3>
                  <p className="text-xs text-slate-400 mt-1">General public details about your property or rental service.</p>

                  <Input
                    label="Listing / Property Name"
                    value={fields.name ?? ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="E.g., Grand Palace Hotel, Cozy Studio near Beach"
                    required
                    error={attemptedSubmit && !fields.name?.trim() ? "Property name is required" : undefined}
                  />
                  <Textarea
                    label="Description"
                    value={fields.description ?? ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="Provide a detailed, attractive description..."
                    rows={6}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Address"
                      value={fields.address ?? ""}
                      onChange={(e) => handleFieldChange("address", e.target.value)}
                      placeholder="Street number, suite"
                      required
                      error={attemptedSubmit && !fields.address?.trim() ? "Address is required" : undefined}
                    />
                    <Input
                      label="Town / City"
                      value={fields.town ?? ""}
                      onChange={(e) => handleFieldChange("town", e.target.value)}
                      placeholder="E.g., Berlin"
                      required
                      error={attemptedSubmit && !fields.town?.trim() ? "Town / City is required" : undefined}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Country Code (2 Letters)"
                      value={fields.country ?? ""}
                      onChange={(e) => handleFieldChange("country", e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="E.g., DE, US, FR"
                      required
                      error={attemptedSubmit && !fields.country?.trim() ? "Country Code is required" : undefined}
                    />
                    {listing.category === "hotel" && (
                      <Input
                        label="Claimed Star Rating (1-5)"
                        type="number"
                        min="1"
                        max="5"
                        value={fields.claimedStarRating ?? ""}
                        onChange={(e) => handleFieldChange("claimedStarRating", e.target.value ? Number(e.target.value) : null)}
                        placeholder="Stars rating"
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === "pricing" && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-lg font-bold text-slate-900">Pricing & Booking Policies</h3>
                  <p className="text-xs text-slate-400 mt-1">Control your nightly rates, constraints, and refund policy.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label={listing.category === "car" ? "Daily Rental Price" : "Price Per Night"}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={fields.pricePerNight ?? ""}
                      onChange={(e) => handleFieldChange("pricePerNight", e.target.value)}
                      required
                      error={attemptedSubmit && (!fields.pricePerNight || Number(fields.pricePerNight) <= 0) ? "Valid price is required" : undefined}
                    />
                    <Select
                      label="Currency"
                      value={fields.currency ?? "USD"}
                      onChange={(e) => handleFieldChange("currency", e.target.value)}
                      disabled={true}
                      options={[
                        { value: "USD", label: "USD ($)" },
                        { value: "EUR", label: "EUR (€)" },
                        { value: "GBP", label: "GBP (£)" },
                        { value: "INR", label: "INR (₹)" },
                        { value: "AED", label: "AED (د.إ)" },
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Minimum Stay / Rental duration (Nights / Days)"
                      type="number"
                      min="1"
                      value={fields.minStayNights ?? 1}
                      onChange={(e) => handleFieldChange("minStayNights", Math.max(1, Number(e.target.value)))}
                      required
                    />
                    <Select
                      label="Cancellation Policy"
                      value={fields.cancellationPolicy ?? "flexible"}
                      onChange={(e) => handleFieldChange("cancellationPolicy", e.target.value)}
                      options={CANCELLATION_POLICIES}
                    />
                  </div>
                  {listing.category !== "car" && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Check-in Time"
                        type="time"
                        value={fields.checkinTime ?? "14:00"}
                        onChange={(e) => handleFieldChange("checkinTime", e.target.value)}
                      />
                      <Input
                        label="Check-out Time"
                        type="time"
                        value={fields.checkoutTime ?? "11:00"}
                        onChange={(e) => handleFieldChange("checkoutTime", e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fields.smokingAllowed ?? false}
                        onChange={(e) => handleFieldChange("smokingAllowed", e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-slate-700">Smoking Allowed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fields.petsAllowed ?? false}
                        onChange={(e) => handleFieldChange("petsAllowed", e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-slate-700">Pets Allowed</span>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === "amenities" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Amenities & Features</h3>
                    <p className="text-xs text-slate-400 mt-1">Check standard inclusions or add custom tags.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    {AMENITY_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => toggleAmenity(opt.value)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                          selectedAmenities.includes(opt.value)
                            ? "border-primary bg-primary-50 text-primary-700 font-semibold"
                            : "border-border bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded flex items-center justify-center border",
                          selectedAmenities.includes(opt.value) ? "bg-primary border-primary text-white" : "border-slate-300"
                        )}>
                          {selectedAmenities.includes(opt.value) && "✓"}
                        </div>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border pt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Custom Amenities</label>
                    <div className="flex gap-2">
                      <Input
                        value={customAmenityInput}
                        onChange={(e) => setCustomAmenityInput(e.target.value)}
                        placeholder="E.g., Mountain view, EV charger, Private chef"
                      />
                      <Button type="button" onClick={addCustomAmenity}>Add Tag</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {customAmenities.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200"
                        >
                          {tag}
                          <button type="button" onClick={() => removeCustomAmenity(tag)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "specs" && (
                <div className="space-y-4 animate-fade-in">
                  {listing.category === "hotel" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900">Hotel Room Configurations</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Select
                          label="Default Room Type"
                          value={fields.roomType ?? "standard"}
                          onChange={(e) => handleFieldChange("roomType", e.target.value)}
                          options={ROOM_TYPES}
                        />
                        <Input
                          label="Total Inventory Unit Count"
                          type="number"
                          min="1"
                          value={fields.unitCount ?? 1}
                          onChange={(e) => handleFieldChange("unitCount", e.target.value)}
                          required
                          error={attemptedSubmit && (!fields.unitCount || Number(fields.unitCount) <= 0) ? "Inventory unit count is required" : undefined}
                        />
                      </div>
                    </div>
                  )}

                  {listing.category === "apartment" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900">Apartment Stays</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <Input label="Bedrooms" type="number" min="0" value={fields.bedrooms ?? 0} onChange={(e) => handleFieldChange("bedrooms", e.target.value)} />
                        <Input label="Bathrooms" type="number" min="0" value={fields.bathrooms ?? 0} onChange={(e) => handleFieldChange("bathrooms", e.target.value)} />
                        <Input
                          label="Maximum Guests"
                          type="number"
                          min="1"
                          value={fields.maxGuests ?? 1}
                          onChange={(e) => handleFieldChange("maxGuests", e.target.value)}
                          required
                          error={attemptedSubmit && (!fields.maxGuests || Number(fields.maxGuests) <= 0) ? "Max guests is required" : undefined}
                        />
                      </div>
                      <div className="border-t border-border pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-800">Long-Stay Discounts</h4>
                            <p className="text-xs text-slate-400 mt-0.5">Offer automatic discount schemes for extended bookings.</p>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={fields.longStayEnabled ?? false}
                              onChange={(e) => handleFieldChange("longStayEnabled", e.target.checked)}
                              className="rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-semibold text-slate-700">Enabled</span>
                          </label>
                        </div>
                        {fields.longStayEnabled && (
                          <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 animate-fade-in">
                            <Input label="Min Stays Required (Nights)" type="number" min="7" value={fields.longStayMinNights ?? 30} onChange={(e) => handleFieldChange("longStayMinNights", e.target.value)} />
                            <Select label="Discount Type" value={fields.longStayDiscountType ?? "percentage"} onChange={(e) => handleFieldChange("longStayDiscountType", e.target.value)} options={[{ value: "percentage", label: "Percentage (%)" }, { value: "fixed", label: "Fixed Amount" }]} />
                            <Input label="Discount Value" type="number" min="0" value={fields.longStayDiscountValue ?? 0} onChange={(e) => handleFieldChange("longStayDiscountValue", e.target.value)} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {listing.category === "car" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900">Vehicle Specifications</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <Input label="Vehicle Make" value={fields.carMake ?? ""} onChange={(e) => handleFieldChange("carMake", e.target.value)} placeholder="E.g., Tesla" required error={attemptedSubmit && !fields.carMake?.trim() ? "Vehicle make is required" : undefined} />
                        <Input label="Vehicle Model" value={fields.carModel ?? ""} onChange={(e) => handleFieldChange("carModel", e.target.value)} placeholder="E.g., Model Y" required error={attemptedSubmit && !fields.carModel?.trim() ? "Vehicle model is required" : undefined} />
                        <Input label="Year" type="number" min="1900" max="2100" value={fields.carYear ?? 2024} onChange={(e) => handleFieldChange("carYear", e.target.value)} required error={attemptedSubmit && (!fields.carYear || Number(fields.carYear) < 1900 || Number(fields.carYear) > 2100) ? "Valid year required" : undefined} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Select label="Transmission" value={fields.transmission ?? "automatic"} onChange={(e) => handleFieldChange("transmission", e.target.value)} options={[{ value: "automatic", label: "Automatic" }, { value: "manual", label: "Manual" }]} />
                        <Select label="Fuel / Drive Type" value={fields.fuelType ?? "electric"} onChange={(e) => handleFieldChange("fuelType", e.target.value)} options={[{ value: "petrol", label: "Gasoline / Petrol" }, { value: "diesel", label: "Diesel" }, { value: "electric", label: "Electric" }, { value: "hybrid", label: "Hybrid" }]} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Seats Capacity" type="number" min="1" value={fields.seats ?? 5} onChange={(e) => handleFieldChange("seats", e.target.value)} required error={attemptedSubmit && (!fields.seats || Number(fields.seats) <= 0) ? "Seats capacity is required" : undefined} />
                        <Input label="Doors" type="number" min="2" value={fields.doors ?? 4} onChange={(e) => handleFieldChange("doors", e.target.value)} />
                      </div>
                      <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                        <Select label="Mileage Policy" value={fields.mileagePolicy ?? "unlimited"} onChange={(e) => handleFieldChange("mileagePolicy", e.target.value)} options={[{ value: "unlimited", label: "Unlimited Mileage" }, { value: "limited", label: "Limited Mileage" }]} />
                        {fields.mileagePolicy === "limited" && (
                          <Input label="Daily Km Limit" type="number" min="10" value={fields.mileageLimitKm ?? 300} onChange={(e) => handleFieldChange("mileageLimitKm", e.target.value)} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "media" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Photos Gallery</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {listing.category === "hotel" ? "Minimum 1 photo required." : "Minimum 3 photos required."} Maximum 30.
                    </p>
                  </div>
                  <MediaUploader
                    listingId={listingId}
                    existingPhotos={photosList}
                    onDelete={(photoId) => listingApi.delete(`/listings/${listingId}/photos/${photoId}`).then(() => undefined)}
                    onRefresh={refreshListing}
                    disabled={listing.status === "pending_review"}
                  />
                  {listing.category === "hotel" && (
                    <div className="border-t border-border pt-5">
                      <DocumentUploader
                        listingId={listingId}
                        existingDocuments={docsList}
                        onRefresh={refreshListing}
                        disabled={listing.status === "pending_review"}
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-6 border-t border-border">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => router.push("/dashboard/listings")}>
                  Exit to Listings
                </Button>
                {activeTab !== "basic" && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const currentIndex = STEPS.findIndex((s) => s.id === activeTab);
                      if (currentIndex > 0) {
                        const prevStep = STEPS[currentIndex - 1];
                        if (prevStep) { setActiveTab(prevStep.id); setAttemptedSubmit(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
                      }
                    }}
                  >
                    Previous Step
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" loading={updateMutation.isPending} onClick={handleSaveDraft} icon={<Save />}>
                  Save Draft
                </Button>
                {activeTab !== "media" ? (
                  <Button type="submit" variant="primary" loading={updateMutation.isPending}>
                    Save & Continue
                  </Button>
                ) : (
                  <>
                    {["apartment", "car"].includes(listing.category) && ["draft", "deactivated"].includes(listing.status) && (
                      <Button type="button" variant="success" onClick={() => activateMutation.mutate()} loading={activateMutation.isPending} icon={<CheckCircle />}>
                        Activate Live
                      </Button>
                    )}
                    {listing.category === "hotel" && ["draft", "rejected"].includes(listing.status) && (
                      <Button type="button" variant="success" onClick={() => submitMutation.mutate()} loading={submitMutation.isPending} icon={<Award />}>
                        Submit for Admin Review
                      </Button>
                    )}
                    {["active", "approved"].includes(listing.status) && (
                      <Button type="button" variant="danger" onClick={() => deactivateMutation.mutate()} loading={deactivateMutation.isPending}>
                        Deactivate Listing
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
