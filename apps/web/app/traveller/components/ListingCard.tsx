"use client";
import React from "react";
import type { PublicListingDetail } from "@/types";
import ListingImage from "./ListingImage";

interface ListingCardProps {
  listing: PublicListingDetail;
  onSelect: (id: string) => void;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
}

const CAT_LABEL: Record<string, string> = {
  hotel: "Hotel",
  apartment: "Apartment",
  car: "Car Rental",
};

function NoImage({ category }: { category: string }) {
  return (
    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-300">
      {category === "car" ? (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      ) : category === "apartment" ? (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ) : (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      )}
      <span className="text-[10px] font-semibold uppercase tracking-wider">No photo</span>
    </div>
  );
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onSelect,
  hoveredId,
  onHover,
}) => {
  const [isFav, setIsFav] = React.useState(listing.isFavourited ?? false);
  const [imgFailed, setImgFailed] = React.useState(false);
  const isHovered = hoveredId === listing.id;

  // Replaced direct image URL with ListingImage component

  const basePrice = listing.pricePerNight || 0;
  const isCar = listing.category === "car";
  const unit = isCar ? "day" : "night";
  // Derive discount: long-stay listings get ~15% off as promotional display price
  const hasPromo = listing.longStayDiscountEnabled;
  const discountPct = hasPromo ? 15 : 0;
  const displayPrice = hasPromo ? Math.round(basePrice * (1 - discountPct / 100)) : basePrice;

  const distLabel =
    listing.distanceKm !== undefined && listing.distanceKm > 0
      ? listing.distanceKm < 1
        ? `${Math.round(listing.distanceKm * 1000)} m`
        : `${listing.distanceKm.toFixed(1)} km`
      : null;

  return (
    <div
      onClick={() => onSelect(listing.id)}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative bg-white border rounded-3xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 ${
        isHovered ? "border-[#166534] ring-2 ring-[#166534]/20" : "border-slate-200"
      }`}
    >
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {listing.isAccredited && (
          <span className="bg-[#0B1E3F]/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Verified
          </span>
        )}
        {listing.instantBooking && (
          <span className="bg-amber-500/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">
            ⚡ Instant Book
          </span>
        )}
        {listing.longStayDiscountEnabled && (
          <span className="bg-[#E31C5F]/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            {discountPct}% OFF
          </span>
        )}
      </div>

      {/* Favourite */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsFav((v) => !v); }}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition shadow-sm"
      >
        <svg className={`w-4 h-4 transition ${isFav ? "text-[#E31C5F] fill-current" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      {/* Image — only from API */}
      <div className="aspect-[4/3] w-full overflow-hidden relative">
        <ListingImage
          listingId={listing.id}
          alt={listing.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          fallbackNode={<NoImage category={listing.category} />}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {distLabel && (
          <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full">
            📍 {distLabel}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2.5">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
              {CAT_LABEL[listing.category] ?? listing.category}
            </p>
            <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-[#0B1E3F] transition mt-0.5">
              {listing.name}
            </h3>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {listing.town}{listing.country ? `, ${listing.country}` : ""}
            </p>
          </div>
          {listing.starRating ? (
            <div className="shrink-0 flex items-center gap-0.5 text-xs font-bold text-slate-800 bg-yellow-50 border border-yellow-100 px-2 py-1 rounded-lg">
              <span className="text-yellow-400 text-[10px]">★</span>
              {listing.starRating}
            </div>
          ) : null}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Per {unit}</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-base font-black text-[#0B1E3F]">
                {listing.currency} {displayPrice > 0 ? displayPrice.toLocaleString() : "—"}
              </p>
              {hasPromo && basePrice > 0 && (
                <p className="text-[10px] text-slate-400 line-through font-medium">
                  {basePrice.toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-lg">
            {isCar ? (
              <>{listing.seats || 4} seats · {listing.transmission || "Auto"}</>
            ) : (
              <>{listing.maxGuests || 2} guests{listing.bedrooms ? ` · ${listing.bedrooms}bd` : ""}</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ListingCard;
