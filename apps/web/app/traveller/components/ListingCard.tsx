"use client";
import React from "react";
import { useRouter } from "next/navigation";
import type { PublicListingDetail } from "@/types";
import ListingImage from "./ListingImage";

import { isPromotionValid, type ActivePromotion } from "../utils/promo-utils";

interface ListingCardProps {
  listing: PublicListingDetail;
  onSelect: (id: string) => void;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  promotionBadge?: { label: string; colour: string };
  variant?: "featured" | "compact";
  activePromotion?: ActivePromotion | null;
  /** Controlled favourite state — when provided, overrides local state */
  isFavourited?: boolean;
  /** Called when user clicks the heart. If omitted, falls back to local-only toggle. */
  onToggleFavourite?: (listingId: string) => void;
}

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
  promotionBadge,
  variant = "featured",
  activePromotion,
  isFavourited: controlledFav,
  onToggleFavourite,
}) => {
  const [localFav, setLocalFav] = React.useState(listing.isFavourited ?? false);
  // Use controlled value when the parent manages favourite state; fall back to local
  const isFav = controlledFav !== undefined ? controlledFav : localFav;
  const isHovered = hoveredId === listing.id;

  function handleFavClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onToggleFavourite) {
      onToggleFavourite(listing.id);
    } else {
      setLocalFav((v) => !v);
    }
  }

  const basePrice = listing.pricePerNight || 0;
  const isCar = listing.category === "car";
  const unit = isCar ? "day" : "night";

  // Calculate discount based on active promotion first, fallback to long stay discount
  const hasLongStay = listing.longStayDiscountEnabled;
  const longStayPct = hasLongStay ? 15 : 0;

  let displayPrice = basePrice;
  let promoBadge = promotionBadge;

  const isValidPromo = activePromotion && activePromotion.activity === listing.category && isPromotionValid(activePromotion);

  if (isValidPromo) {
    console.log("[Promotion] ListingCard received promotion:", activePromotion, "| listing:", listing.id);
    const promoDiscount = activePromotion.discountType === "percentage"
      ? Math.round(basePrice * (Number(activePromotion.discountValue) / 100))
      : Math.round(Number(activePromotion.discountValue));
    displayPrice = Math.max(0, basePrice - promoDiscount);
    console.log("[Promotion] Discounted price calculated:", { basePrice, promoDiscount, displayPrice });

    promoBadge = {
      label: activePromotion.labelText || (
        activePromotion.discountType === "percentage"
          ? `${activePromotion.discountValue}% OFF`
          : `KES ${activePromotion.discountValue} OFF`
      ),
      colour: activePromotion.labelColour || "#E31C5F"
    };
  } else if (hasLongStay) {
    displayPrice = Math.round(basePrice * (1 - longStayPct / 100));
    promoBadge = {
      label: `${longStayPct}% OFF`,
      colour: "#E31C5F"
    };
  }

  /* ── COMPACT card (2-col grid) ── */
  if (variant === "compact") {
    return (
      <div
        onClick={() => onSelect(listing.id)}
        onMouseEnter={() => onHover?.(listing.id)}
        onMouseLeave={() => onHover?.(null)}
        className={`group relative bg-white border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
          isHovered ? "border-[#1D8D2B] shadow-xl" : "border-slate-200 shadow-md hover:shadow-xl"
        }`}
      >
        {/* Image — fixed height so cards stay consistent regardless of column width */}
        <div className="h-44 w-full overflow-hidden relative">
          <ListingImage
            listingId={listing.id}
            alt={listing.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
            fallbackNode={<NoImage category={listing.category} />}
          />
          {(listing.isAccredited || listing.instantBooking || promoBadge) && (
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
              {listing.isAccredited && (
                <span className="bg-[#1D8D2B]/90 backdrop-blur-sm text-white text-[9px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Verified
                </span>
              )}
              {promoBadge && (
                <span className="backdrop-blur-sm text-white text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: promoBadge.colour }}>
                  {promoBadge.label}
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleFavClick}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition shadow-sm"
            aria-label={isFav ? "Remove from wishlist" : "Save to wishlist"}
          >
            <svg className={`w-3.5 h-3.5 ${isFav ? "text-red-500 fill-current" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {listing.town}{listing.country ? `, ${listing.country}` : ""}
            </p>
            <div className="text-right shrink-0 ml-2">
              <p className="text-sm font-bold text-slate-800">
                {listing.currency} {displayPrice.toLocaleString()}
                <span className="text-[10px] font-medium text-slate-400">/{unit}</span>
              </p>
              {displayPrice < basePrice && (
                <p className="text-[9px] text-slate-400 line-through leading-none">{listing.currency} {basePrice.toLocaleString()}</p>
              )}
            </div>
          </div>
          <h3 className="font-bold text-sm text-slate-900 leading-snug mb-2 line-clamp-1 group-hover:text-[#024622] transition">
            {listing.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {isCar ? (
                <>{listing.seats || 4} Seats · {listing.transmission || "Auto"}</>
              ) : (
                <>
                  {listing.bedrooms ? `${listing.bedrooms} BR` : ""}
                  {listing.bedrooms && listing.bathrooms ? "  " : ""}
                  {listing.bathrooms ? `${listing.bathrooms} BA` : ""}
                </>
              )}
            </p>
            <button className="text-xs font-semibold text-[#0c2614] hover:text-[#1D8D2B] transition flex items-center gap-0.5">
              Explore <span className="text-base leading-none">›</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── FEATURED card (full-width horizontal) ── */
  return (
    <div
      onClick={() => onSelect(listing.id)}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative bg-white border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 flex h-[200px] ${
        isHovered
          ? "border-[#1D8D2B] shadow-xl ring-1 ring-[#1D8D2B]/20"
          : "border-slate-200 shadow-md hover:shadow-xl hover:-translate-y-0.5"
      }`}
    >
      {/* Image — left 38% fixed height */}
      <div className="relative w-[38%] shrink-0 overflow-hidden">
        <ListingImage
          listingId={listing.id}
          alt={listing.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
          fallbackNode={<NoImage category={listing.category} />}
        />
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
          {listing.isAccredited && (
            <span className="bg-[#1D8D2B]/90 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Verified
            </span>
          )}
          {listing.instantBooking && (
            <span className="bg-[#1D8D2B]/90 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
              ⚡ Instant Book
            </span>
          )}
          {promoBadge && (
            <span className="backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: promoBadge.colour }}>
              {promoBadge.label}
            </span>
          )}
        </div>
        {/* Heart */}
        <button
          onClick={handleFavClick}
          className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition shadow-sm"
          aria-label={isFav ? "Remove from wishlist" : "Save to wishlist"}
        >
          <svg className={`w-3.5 h-3.5 transition ${isFav ? "text-red-500 fill-current" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Content — right 62%, fixed height via parent */}
      <div className="flex-1 px-4 py-3 flex flex-col justify-between min-w-0">
        {/* Top: location + rating, title, specs */}
        <div className="flex flex-col gap-1.5">
          {/* Location + Rating */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 truncate">
              <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {listing.town}{listing.country ? `, ${listing.country}` : ""}
            </p>
            {listing.starRating ? (
              <div className="shrink-0 flex items-center gap-0.5 text-xs font-bold text-slate-700 ml-2">
                <span className="text-amber-400">★</span>
                {listing.starRating}
              </div>
            ) : null}
          </div>

          {/* Title */}
          <h3 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-[#024622] transition line-clamp-1">
            {listing.name}
          </h3>

          {/* Specs */}
          {!isCar ? (
            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              {listing.bedrooms ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  {listing.bedrooms} Bed{listing.bedrooms !== 1 ? "s" : ""}
                </span>
              ) : null}
              {listing.bathrooms ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                  </svg>
                  {listing.bathrooms} Bath{listing.bathrooms !== 1 ? "s" : ""}
                </span>
              ) : null}
              {listing.maxGuests ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {listing.maxGuests} Guest{listing.maxGuests !== 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              {listing.carMake && <span>{listing.carMake} {listing.carModel} {listing.carYear}</span>}
              {listing.seats && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {listing.seats} Seats
                </span>
              )}
              {listing.transmission && <span className="capitalize">{listing.transmission}</span>}
              {listing.fuelType && <span className="capitalize">{listing.fuelType}</span>}
            </div>
          )}
        </div>

        {/* Bottom: Price + CTA */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold text-slate-900 leading-tight">
              {listing.currency} {displayPrice > 0 ? displayPrice.toLocaleString() : "—"}
            </p>
            {basePrice > displayPrice && (
              <p className="text-[10px] text-slate-400 line-through leading-none">{listing.currency} {basePrice.toLocaleString()}</p>
            )}
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Per {unit}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(listing.id); }}
            className="flex items-center gap-1.5 bg-[#0c2614] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#1D8D2B] transition shadow-sm"
          >
            View Details
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
