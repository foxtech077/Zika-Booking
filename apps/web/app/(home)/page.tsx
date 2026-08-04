import { Suspense } from "react";
import type { Metadata } from "next";
import TravellerDashboard from "../traveller/TravellerPageClient";

interface PageProps {
  searchParams: { listing?: string };
}

/**
 * `?listing=` is attacker-controllable and is interpolated into a server-side
 * request to the internal listing API, so it is checked against the id format
 * before it is used. Without this, a crafted value containing path separators
 * could redirect that request at a different endpoint and reflect whatever came
 * back into this page's title and description tags.
 */
const LISTING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const listingId = searchParams.listing;

  if (!listingId || !LISTING_ID_PATTERN.test(listingId)) {
    return {};
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_LISTING_API_URL ?? "http://localhost:3003";
    const res = await fetch(`${apiUrl}/listings/${encodeURIComponent(listingId)}/public`, {
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
