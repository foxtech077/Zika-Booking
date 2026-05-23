import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import ListingForm from "@/components/ListingForm";
import Link from "next/link";
import { useState } from "react";

export default function EditListingPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  // Fetch the listing – the same data used by ListingForm's internal query
  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const queryClient = useQueryClient();

  // When the form successfully saves, invalidate the listing cache
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      await listingApi.patch(`/listings/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["listing", id]);
    },
  });

  // ── Additional mutations ──
  const submitMutation = useMutation({
    mutationFn: async () => await listingApi.post(`/listings/${id}/submit`),
    onSuccess: () => queryClient.invalidateQueries(["listing", id]),
  });
  const activateMutation = useMutation({
    mutationFn: async () => await listingApi.post(`/listings/${id}/activate`),
    onSuccess: () => queryClient.invalidateQueries(["listing", id]),
  });
  const deactivateMutation = useMutation({
    mutationFn: async () => await listingApi.post(`/listings/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries(["listing", id]),
  });
  const reactivateMutation = useMutation({
    mutationFn: async () => await listingApi.post(`/listings/${id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries(["listing", id]),
  });

  // ── Fetch auxiliary data ──
  const { data: availability } = useQuery({
    queryKey: ["availability", id],
    queryFn: async () => {
      const res = await listingApi.get(`/listings/${id}/availability`);
      return res.data.data;
    },
    enabled: !!id,
  });
  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const res = await listingApi.get(`/listings/${id}/reviews`);
      return res.data.data;
    },
    enabled: !!id,
  });
  const { data: blockedDates } = useQuery({
    queryKey: ["blockedDates", id],
    queryFn: async () => {
      const res = await listingApi.get(`/listings/${id}/blocked-dates`);
      return res.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Edit Listing – {listing?.name}</h1>
      {/* Pass the fetched listing to the form via mode="edit" */}
      <ListingForm mode="edit" />

      {/* Action buttons */}
      <div className="mt-6 space-x-2">
        <button onClick={() => submitMutation.mutate()} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark">Submit</button>
        <button onClick={() => activateMutation.mutate()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Activate</button>
        <button onClick={() => deactivateMutation.mutate()} className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">Deactivate</button>
        <button onClick={() => reactivateMutation.mutate()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Reactivate</button>
        <Link href={`/listings/${id}/public`} className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900">Public View</Link>
      </div>

      {/* Optional data sections */}
      {availability && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold">Availability</h2>
          <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(availability, null, 2)}</pre>
        </div>
      )}
      {reviews && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold">Reviews</h2>
          <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(reviews, null, 2)}</pre>
        </div>
      )}
      {blockedDates && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold">Blocked Dates</h2>
          <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(blockedDates, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
