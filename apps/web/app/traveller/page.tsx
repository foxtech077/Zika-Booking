import { Suspense } from "react";
import type { Metadata } from "next";
import TravellerDashboard from "./TravellerPageClient";

interface PageProps {
  searchParams: { listing?: string };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const listingId = searchParams.listing;

  if (!listingId) {
    return {};
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_LISTING_API_URL ?? "http://localhost:3003";
    const res = await fetch(`${apiUrl}/listings/${listingId}/public`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error("Failed to fetch listing");

    const json = await res.json();
    const listing = json.data;

    const title = listing.name ?? "Kainook";
    const description = listing.description
      ? listing.description.slice(0, 200)
      : "Book hotels, apartments, and car rentals worldwide.";
    const imageUrl = listing.photos?.[0]?.cdnUrl ?? listing.primaryPhotoUrl ?? null;

    const og: Metadata = {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
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

    return og;
  } catch {
    return {};
  }
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <TravellerDashboard />
    </Suspense>
  );
}
