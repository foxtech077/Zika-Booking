import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListingDetailClient from "./ListingDetailClient";

interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const API_URL = process.env.NEXT_PUBLIC_LISTING_API_URL ?? "http://localhost:3003";

async function fetchListing(id: string) {
  try {
    const res = await fetch(`${API_URL}/listings/${id}/public`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const listing = await fetchListing(params.id);

  if (!listing) {
    return {
      title: "Listing Not Found",
      description: "This listing is unavailable.",
    };
  }

  const title = listing.name ?? "Kainook";
  const description = listing.description
    ? listing.description.slice(0, 200)
    : "Book hotels, apartments, and car rentals worldwide.";
  const imageUrl = listing.photos?.[0]?.cdnUrl ?? listing.primaryPhotoUrl ?? null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Kainook",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function ListingDetailPage({ params, searchParams }: PageProps) {
  const listing = await fetchListing(params.id);

  if (!listing) {
    notFound();
  }

  const pick = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ListingDetailClient
        listingId={params.id}
        checkIn={pick("checkin")}
        checkOut={pick("checkout")}
        pickup={pick("pickup")}
        returnDate={pick("return")}
        guests={pick("guests")}
      />
    </Suspense>
  );
}
