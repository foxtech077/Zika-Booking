"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchFavourites, type FavouriteListing } from "@/services/traveller";
import { useAuthStore } from "@/stores/auth";
import { useFavourites } from "@/hooks/useFavourites";
import ListingCard from "../components/ListingCard";
import type { PublicListingDetail } from "@/types";


type Category = "hotel" | "apartment" | "car";
const TABS: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "hotel", label: "Hotels" },
  { key: "apartment", label: "Apartments" },
  { key: "car", label: "Cars" },
];

// Maps the GET /guests/me/favourites response shape — { listingId, savedAt, listing: {...} }
// (services/listing-service/src/routes/search.ts) — into the display card's PublicListingDetail.
function mapListing(item: FavouriteListing): PublicListingDetail {
  const l = item.listing;
  return {
    id: item.listingId,
    providerId: "",
    category: (l.category || "hotel") as "hotel" | "apartment" | "car",
    name: l.title || "Untitled",
    pricePerNight: l.nightlyRate ?? 0,
    currency: l.currency || "KES",
    minStayNights: 1,
    checkinTime: "",
    checkoutTime: "",
    cancellationPolicy: "flexible",
    address: l.city ?? "",
    lat: 0,
    lng: 0,
    town: l.city ?? "",
    country: l.countryCode ?? "",
    primaryPhotoUrl: l.primaryPhotoUrl,
    photos: l.primaryPhotoUrl ? [{ id: "ph", cdnUrl: l.primaryPhotoUrl, position: 1 }] : [],
    amenities: [],
    customAmenities: [],
    description: "",
    isFavourited: true,
    isAccredited: false,
    longStayDiscountEnabled: false,
    instantBooking: false,
  };
}

function SkeletonCard() {
  return (
    <div className="animate-pulse flex flex-col rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-sm">
      <div className="aspect-[4/3] bg-slate-200 w-full" />
      <div className="p-4 space-y-2.5">
        <div className="h-2.5 bg-slate-200 rounded w-1/4" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
          <div className="h-5 bg-slate-200 rounded w-24" />
          <div className="h-8 bg-slate-200 rounded-lg w-20" />
        </div>
      </div>
    </div>
  );
}

export default function WishlistClient() {
  const router = useRouter();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const { isFavourited, toggleFavourite } = useFavourites();

  const [listings, setListings] = useState<PublicListingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Category | "all">("all");
  const [cursor, setCursor] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Redirect unauthenticated users after hydration
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [_hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchWishlist(0, true);
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchWishlist(cursorValue: number, reset: boolean) {
    if (reset) { setLoading(true); setError(null); } else { setLoadingMore(true); }
    try {
      const res = await fetchFavourites(cursorValue);
      const mapped = res.favourites.map(mapListing);
      setListings((prev) => (reset ? mapped : [...prev, ...mapped]));
      setNextCursor(res.nextCursor);
      setCursor(cursorValue + res.favourites.length);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? "Failed to load wishlist.";
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleToggleFavourite(listingId: string) {
    // Capture current state BEFORE the optimistic update so the stale closure
    // in the async continuation doesn't use the wrong isFavourited value.
    const wasCurrentlyFavourited = isFavourited(listingId);
    const result = await toggleFavourite(listingId);
    if (result === "ok" && wasCurrentlyFavourited) {
      // Item was removed from favourites — remove it from the local list
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    }
  }

  function handleSelectListing(id: string) {
    router.push(`/traveller?listing=${id}`);
  }

  const filtered = activeTab === "all"
    ? listings
    : listings.filter((l) => l.category === activeTab);

  const counts: Record<string, number> = {
    all: listings.length,
    hotel: listings.filter((l) => l.category === "hotel").length,
    apartment: listings.filter((l) => l.category === "apartment").length,
    car: listings.filter((l) => l.category === "car").length,
  };

  if (!_hasHydrated || (!isAuthenticated && !_hasHydrated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin h-10 w-10 border-4 border-[#0c2614] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased">

      {/* ── Header ── */}
      {/* <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/traveller" className="text-xl font-bold text-[#0c2614] tracking-tight shrink-0">
            Kainook
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {(["Hotels", "Apartments", "Cars"] as const).map((label) => {
              const href = `/traveller/${label.toLowerCase()}`;
              return (
                <Link key={href} href={href} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-[#0c2614] transition-colors">
                  {label}
                </Link>
              );
            })}
            <Link href="/traveller/wishlist" className="relative px-4 py-2 text-sm font-semibold text-[#0c2614]">
              Wishlist
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#0c2614] rounded-full" />
            </Link>
          </nav>
        </div> */}

        {/* {user && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full py-1.5 px-3 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-[#0c2614] text-white flex items-center justify-center font-bold uppercase text-xs">
              {user.firstName[0]}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-800">{user.firstName}</p>
              <p className="text-[10px] text-[#1D8D2B] font-bold uppercase tracking-widest">
                {(user as any).currentTier || "Bronze"}
              </p>
            </div>
          </div>
        )}
      </header> */}
      

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <svg className="w-6 h-6 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-slate-900">My Wishlist</h1>
          </div>
          <p className="text-sm text-slate-500">
            {loading ? "Loading your saved listings…" : `${listings.length} saved listing${listings.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Category tabs */}
        {/* <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                activeTab === key
                  ? "bg-[#0c2614] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                  activeTab === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div> */}

        {/* Error */}
        {error && !loading && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-red-700 text-sm font-medium">
            <span>{error}</span>
            <button type="button" onClick={() => fetchWishlist(0, true)} className="ml-4 underline hover:no-underline shrink-0">
              Retry
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white border border-slate-100 rounded-3xl shadow-sm">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-5">
              <svg className="w-9 h-9 text-rose-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {activeTab === "all" ? "Your wishlist is empty." : `No saved ${activeTab}s yet.`}
            </h3>
            <p className="text-slate-500 text-sm max-w-xs leading-relaxed mb-6">
              {activeTab === "all"
                ? "Tap the heart icon on any listing to save it here for later."
                : `Browse ${activeTab}s and tap the heart to save them here.`}
            </p>
            <Link
              href={activeTab === "all" ? "/traveller" : `/traveller/${activeTab}s`}
              className="px-6 py-2.5 bg-[#0c2614] text-white text-sm font-bold rounded-xl hover:bg-[#1D8D2B] transition"
            >
              {activeTab === "all" ? "Explore Listings" : `Browse ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}s`}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onSelect={handleSelectListing}
                variant="compact"
                isFavourited={isFavourited(listing.id)}
                onToggleFavourite={handleToggleFavourite}
              />
            ))}
          </div>
        )}

        {!loading && nextCursor && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => fetchWishlist(cursor, false)}
              disabled={loadingMore}
              className="px-6 py-2.5 border-2 border-[#1D8D2B] text-[#1D8D2B] text-sm font-bold rounded-full hover:bg-[#0c2614] hover:text-white transition disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
