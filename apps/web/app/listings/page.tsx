"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";

interface Listing {
  id: string;
  name: string | null;
  category: string;
  status: string;
  starRating: number | null;
  town: string | null;
  country: string | null;
  pricePerNight: number | null;
  currency: string | null;
  submissionCount: number;
  rejectionReasons: string[];
  rejectionNote: string | null;
  photos: { cdnUrl: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  deactivated: "bg-gray-100 text-gray-500",
  suspended: "bg-orange-100 text-orange-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Under Review",
  approved: "Live",
  rejected: "Rejected",
  deactivated: "Deactivated",
  suspended: "Suspended",
};

export default function MyListingsPage() {
  const qc = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "deactivate"; id: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { listings: Listing[] } }>("/listings");
      return res.data.data.listings;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listingApi.delete(`/listings/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-listings"] }); setConfirmAction(null); },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => listingApi.post(`/listings/${id}/deactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-listings"] }); setConfirmAction(null); },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your hotels, apartments, and car rentals.</p>
          </div>
          <Link
            href="/listings/new"
            className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-dark transition"
          >
            + Add new listing
          </Link>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!isLoading && !data?.length && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">No listings yet</p>
            <p className="text-gray-400 text-sm">Add your first hotel, apartment, or car rental listing to get started.</p>
          </div>
        )}

        <div className="space-y-4">
          {data?.map((listing) => (
            <div key={listing.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-900 truncate">{listing.name || "Untitled listing"}</h2>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[listing.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABEL[listing.status] ?? listing.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                    {listing.town ? ` · ${listing.town}` : ""}
                    {listing.country ? `, ${listing.country}` : ""}
                    {listing.pricePerNight ? ` · ${listing.currency} ${listing.pricePerNight}/night` : ""}
                  </p>

                  {listing.status === "rejected" && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <strong>Rejected:</strong> {listing.rejectionReasons.join(", ")}
                      {listing.rejectionNote && <span className="block mt-1 text-xs">{listing.rejectionNote}</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {listing.status !== "pending_review" && (
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                      {listing.status === "rejected" ? "View Feedback & Edit" : "Edit"}
                    </Link>
                  )}
                  {listing.status === "draft" && (
                    <button
                      onClick={() => setConfirmAction({ type: "delete", id: listing.id })}
                      className="px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  )}
                  {listing.status === "approved" && (
                    <button
                      onClick={() => setConfirmAction({ type: "deactivate", id: listing.id })}
                      className="px-3 py-1.5 text-sm border border-orange-200 rounded-lg text-orange-600 hover:bg-orange-50 transition"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">
              {confirmAction.type === "delete" ? "Delete draft?" : "Deactivate listing?"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {confirmAction.type === "delete"
                ? "This draft will be permanently deleted. This cannot be undone."
                : "This will remove your listing from search. Existing bookings are unaffected."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === "delete") deleteMutation.mutate(confirmAction.id);
                  else deactivateMutation.mutate(confirmAction.id);
                }}
                disabled={deleteMutation.isPending || deactivateMutation.isPending}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {confirmAction.type === "delete" ? "Delete" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
