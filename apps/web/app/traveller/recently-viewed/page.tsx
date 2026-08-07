"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, ArrowLeft, Search } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { fetchRecentlyViewed } from "@/services/traveller";
import type { RecentlyViewedItem } from "@/services/traveller";
import ListingImage from "../components/ListingImage";

const CAT_LABEL: Record<string, string> = {
  hotel: "Hotel",
  apartment: "Apartment",
  car: "Car Rental",
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function RecentlyViewedPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    fetchRecentlyViewed()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [_hasHydrated, isAuthenticated]);

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
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1D8D2B] transition uppercase tracking-wide"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#1D8D2B]" />
              Recently Viewed
            </h1>
            {!loading && (
              <p className="text-sm text-slate-500 mt-0.5">
                {items.length} {items.length === 1 ? "listing" : "listings"} you recently explored
              </p>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Clock className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-lg">Nothing viewed yet</p>
              <p className="text-slate-400 text-sm mt-1">Listings you open will appear here.</p>
            </div>
            <Link
              href="/"
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#0c2614] text-white text-sm font-semibold rounded-full hover:bg-[#1D8D2B] transition"
            >
              <Search className="w-4 h-4" />
              Explore Listings
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => {
              const l = item.listing;
              const isCar = l.category === "car";
              const rate = l.localizedNightlyRate ?? l.nightlyRate;
              return (
                <div
                  key={item.listingId}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  {/* Image */}
                  <div className="aspect-[4/3] relative overflow-hidden bg-slate-100">
                    <ListingImage
                      listingId={l.id}
                      alt={l.title}
                      className="w-full h-full object-cover hover:scale-105 transition duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-[#024622]/90 text-white text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      {CAT_LABEL[l.category] ?? l.category}
                    </span>
                    <span className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[9px] font-medium px-2 py-1 rounded-full">
                      {timeAgo(item.viewedAt)}
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
                        {l.city}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Per {isCar ? "day" : "night"}</p>
                        <p className="text-base font-bold text-[#024622]">
                          {l.localizedCurrency ?? l.currency ?? "KES"} {rate != null ? rate.toLocaleString() : "—"}
                        </p>
                      </div>
                      {/* Address the listing in the URL. This used to stash the
                          id under "zika:open_listing" and navigate to the bare
                          home page, but nothing ever read that key, so "View"
                          just dropped the guest on the landing page. */}
                      <Link
                        href={`/?listing=${l.id}`}
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
        )}
      </main>
    </div>
  );
}
