"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import { useState } from "react";

type Category = "hotel" | "apartment" | "car";

function buildChecklist(listing: any, category: Category) {
  if (category === "hotel") {
    const docTypes = (listing.documents ?? []).map((d: any) => d.documentType);
    return [
      { label: "Property name", ok: !!listing.name },
      { label: "Room type", ok: !!listing.roomType },
      { label: "Number of units", ok: !!listing.unitCount && listing.unitCount >= 1 },
      { label: "Price per night & currency", ok: !!listing.pricePerNight && !!listing.currency },
      { label: "Address (geocoded location)", ok: !!listing.address && !!listing.lat && !!listing.lng },
      { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
      { label: "At least 1 photo", ok: (listing.photos ?? []).length >= 1 },
      { label: "Business licence", ok: docTypes.includes("business_licence") },
      { label: "Hotel operating permit", ok: docTypes.includes("operating_permit") },
      { label: "Tourism authority certificate", ok: docTypes.includes("tourism_certificate") },
    ];
  }

  if (category === "apartment") {
    return [
      { label: "Listing title", ok: !!listing.name },
      { label: "Maximum guests", ok: !!listing.maxGuests && listing.maxGuests >= 1 },
      { label: "Price per night & currency", ok: !!listing.pricePerNight && !!listing.currency },
      { label: "Address (geocoded location)", ok: !!listing.address && !!listing.lat && !!listing.lng },
      { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
      { label: "At least 3 photos", ok: (listing.photos ?? []).length >= 3 },
    ];
  }

  // car
  return [
    { label: "Listing title", ok: !!listing.name },
    { label: "Vehicle make", ok: !!listing.carMake },
    { label: "Vehicle model", ok: !!listing.carModel },
    { label: "Vehicle year", ok: !!listing.carYear },
    { label: "Transmission type", ok: !!listing.transmission },
    { label: "Number of seats", ok: !!listing.seats && listing.seats >= 1 },
    { label: "Price per day & currency", ok: !!listing.pricePerNight && !!listing.currency },
    { label: "Pickup location (geocoded)", ok: !!listing.address && !!listing.lat && !!listing.lng },
    { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
    { label: "At least 3 photos", ok: (listing.photos ?? []).length >= 3 },
  ];
}

function buildSummary(listing: any, category: Category) {
  if (category === "hotel") {
    return [
      ["Name", listing.name || "—"],
      ["Category", "Hotel"],
      ["Room type", listing.roomType || "—"],
      ["Units", listing.unitCount?.toString() || "—"],
      ["Price", listing.pricePerNight ? `${listing.currency} ${listing.pricePerNight}/night` : "—"],
      ["Location", [listing.town, listing.country].filter(Boolean).join(", ") || "—"],
      ["Photos", `${(listing.photos ?? []).length} uploaded`],
      ["Documents", `${(listing.documents ?? []).length} / 3 uploaded`],
    ];
  }

  if (category === "apartment") {
    const beds = listing.bedrooms === 0 ? "Studio" : listing.bedrooms ? `${listing.bedrooms} bed` : "—";
    return [
      ["Name", listing.name || "—"],
      ["Category", "Apartment"],
      ["Layout", beds],
      ["Max guests", listing.maxGuests?.toString() || "—"],
      ["Price", listing.pricePerNight ? `${listing.currency} ${listing.pricePerNight}/night` : "—"],
      ["Location", [listing.town, listing.country].filter(Boolean).join(", ") || "—"],
      ["Photos", `${(listing.photos ?? []).length} uploaded`],
    ];
  }

  // car
  return [
    ["Name", listing.name || "—"],
    ["Category", "Car Rental"],
    ["Vehicle", [listing.carMake, listing.carModel, listing.carYear].filter(Boolean).join(" ") || "—"],
    ["Transmission", listing.transmission || "—"],
    ["Seats", listing.seats?.toString() || "—"],
    ["Price", listing.pricePerNight ? `${listing.currency} ${listing.pricePerNight}/day` : "—"],
    ["Pickup", [listing.town, listing.country].filter(Boolean).join(", ") || "—"],
    ["Photos", `${(listing.photos ?? []).length} uploaded`],
  ];
}

export default function SubmitListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing-submit", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
  });

  const category: Category = listing?.category ?? "hotel";
  const isAutoActivate = category === "apartment" || category === "car";

  const actionMutation = useMutation({
    mutationFn: () => listingApi.post(`/listings/${id}/${isAutoActivate ? "activate" : "submit"}`),
    onSuccess: () => router.replace("/listings"),
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message ?? "Action failed. Please check all required fields.");
      setShowConfirm(false);
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!listing) return null;

  const checklist = buildChecklist(listing, category);
  const summary = buildSummary(listing, category);
  const allOk = checklist.every((c) => c.ok);

  const pageTitle = isAutoActivate ? "Review & Activate" : "Review & Submit";
  const pageSubtitle = isAutoActivate
    ? `Check all requirements, then activate your ${category} listing immediately.`
    : "Check all requirements before submitting your listing for admin review.";

  const buttonLabel = actionMutation.isPending
    ? (isAutoActivate ? "Activating…" : "Submitting…")
    : isAutoActivate
      ? `Activate ${category === "car" ? "car rental" : "apartment"}`
      : listing.status === "rejected" ? "Resubmit for Review" : "Submit for Review";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href={`/listings/${id}/edit`} className="text-sm text-primary mb-6 inline-block hover:underline">← Edit listing</Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
        <p className="text-sm text-gray-500 mb-8">{pageSubtitle}</p>

        {isAutoActivate && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800">
              {category === "apartment"
                ? "Apartments go live immediately — no admin review required. Once activated, guests can book your listing right away."
                : "Car rentals go live immediately — no admin review required. Once activated, renters can book your vehicle right away."}
            </p>
          </div>
        )}

        {listing.status === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="font-semibold text-red-800 mb-1">Previously rejected</p>
            <p className="text-sm text-red-700">{(listing.rejectionReasons ?? []).join(", ")}</p>
            {listing.rejectionNote && <p className="text-sm text-red-700 mt-1">{listing.rejectionNote}</p>}
          </div>
        )}

        {/* Listing summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Listing summary</h2>
          <div className="divide-y divide-gray-100 text-sm">
            {summary.map(([label, value]) => (
              <div key={label} className="flex justify-between py-2">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Requirements</h2>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <span className={`font-bold w-5 text-center ${item.ok ? "text-green-600" : "text-red-500"}`}>{item.ok ? "✓" : "✗"}</span>
                <span className={item.ok ? "text-gray-700" : "text-red-600"}>{item.label}</span>
                {!item.ok && (
                  <Link href={`/listings/${id}/edit`} className="ml-auto text-xs text-primary hover:underline">Fix →</Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>}

        {!allOk && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            Complete all requirements above before proceeding.
          </p>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={!allOk || actionMutation.isPending}
          className="w-full bg-primary text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-primary-dark disabled:opacity-50 transition"
        >
          {buttonLabel}
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">
              {isAutoActivate ? "Activate listing?" : "Submit for review?"}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {isAutoActivate
                ? `Your ${category === "car" ? "car rental" : "apartment"} will go live immediately and be visible to guests.`
                : "Once submitted, you won't be able to edit until the admin review is complete. Our team responds within 48 hours."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => actionMutation.mutate()}
                disabled={actionMutation.isPending}
                className="flex-1 bg-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
              >
                {actionMutation.isPending ? "…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
