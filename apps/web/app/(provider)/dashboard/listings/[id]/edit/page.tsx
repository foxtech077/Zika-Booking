"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import type { Listing } from "@/types/provider";
import { HotelForm } from "./_forms/HotelForm";
import { ApartmentForm } from "./_forms/ApartmentForm";
import { CarForm } from "./_forms/CarForm";

export default function EditListingPage() {
  const { id } = useParams();
  const listingId = id as string;

  const { data: listing, isLoading, isError } = useQuery<Listing>({
    queryKey: ["listing-edit", listingId],
    queryFn: () => listingApi.get(`/listings/${listingId}`).then((r) => r.data.data ?? r.data),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-10 space-y-5 animate-pulse">
        <div className="h-8 w-56 bg-slate-200 rounded" />
        <div className="h-4 w-32 bg-slate-200 rounded" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-3">
        <p className="text-lg font-semibold text-slate-700">Listing not found</p>
        <p className="text-sm text-slate-400">This listing may have been deleted or you do not have access.</p>
      </div>
    );
  }

  const props = { listingId, listing };

  return (
    <>
      {listing.category === "hotel" && <HotelForm {...props} />}
      {listing.category === "apartment" && <ApartmentForm {...props} />}
      {listing.category === "car" && <CarForm {...props} />}
    </>
  );
}
