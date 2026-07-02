"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, ArrowLeft, Search } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { fetchFavourites, removeFavourite } from "@/services/traveller";
import type { FavouriteListing } from "@/services/traveller";
import ListingImage from "../components/ListingImage";

const CAT_LABEL: Record<string, string> = {
  hotel: "Hotel",
  apartment: "Apartment",
  car: "Car Rental",
};

export default function FavouritesPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const [favourites, setFavourites] = useState<FavouriteListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    loadFavourites(0, true);
  }, [_hasHydrated, isAuthenticated]);

  async function loadFavourites(cursorValue: number, reset: boolean) {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetchFavourites(cursorValue);
      setFavourites((prev) => (reset ? res.favourites : [...prev, ...res.favourites]));
      setNextCursor(res.nextCursor);
      setCursor(cursorValue + res.favourites.length);
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleRemove(listingId: string) {
    setRemovingId(listingId);
    try {
      await removeFavourite(listingId);
      setFavourites((prev) => prev.filter((f) => f.listingId !== listingId));
    } catch {
      // revert not needed — just keep the item visible if API fails
    } finally {
      setRemovingId(null);
    }
  }

  if (!_hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/traveller"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1D8D2B] transition uppercase tracking-wide"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#E31C5F] fill-current" />
              My Favourites
            </h1>
            {!loading && (
              <p className="text-sm text-slate-500 mt-0.5">
                {favourites.length} saved {favourites.length === 1 ? "listing" : "listings"}
              </p>
            )}
          </div>
        </div>

        {favourites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Heart className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-lg">No saved listings yet</p>
              <p className="text-slate-400 text-sm mt-1">Tap the heart icon on any listing to save it here.</p>
            </div>
            <Link
              href="/traveller"
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#0c2614] text-white text-sm font-semibold rounded-full hover:bg-[#1D8D2B] transition"
            >
              <Search className="w-4 h-4" />
              Explore Listings
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {favourites.map((fav) => {
                const l = fav.listing;
                const isRemoving = removingId === fav.listingId;
                const isCar = l.category === "car";
                return (
                  <div
                    key={fav.listingId}
                    className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${isRemoving ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {/* Image */}
                    <div className="aspect-[4/3] relative overflow-hidden bg-slate-100">
                      <ListingImage
                        listingId={l.id}
                        alt={l.title}
                        className="w-full h-full object-cover hover:scale-105 transition duration-500"
                      />
                      <button
                        onClick={() => handleRemove(fav.listingId)}
                        disabled={isRemoving}
                        aria-label="Remove from favourites"
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition"
                      >
                        <Heart className="w-4 h-4 text-[#E31C5F] fill-current" />
                      </button>
                      <span className="absolute top-3 left-3 bg-[#024622]/90 text-white text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full">
                        {CAT_LABEL[l.category] ?? l.category}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-slate-900 line-clamp-1">{l.title}</h3>
                      {l.city && (
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {l.city}{l.countryCode ? `, ${l.countryCode}` : ""}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <div>
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Per {isCar ? "day" : "night"}</p>
                          <p className="text-base font-bold text-[#024622]">
                            {l.currency ?? "KES"} {l.nightlyRate ? l.nightlyRate.toLocaleString() : "—"}
                          </p>
                        </div>
                        <Link
                          href="/traveller"
                          onClick={() => {
                            sessionStorage.setItem("zika:open_listing", l.id);
                          }}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-[#0c2614] text-white hover:bg-[#1D8D2B] transition"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {nextCursor && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => loadFavourites(cursor, false)}
                  disabled={loadingMore}
                  className="px-6 py-2.5 border-2 border-[#1D8D2B] text-[#1D8D2B] text-sm font-bold rounded-full hover:bg-[#0c2614] hover:text-white transition disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
