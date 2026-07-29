"use client";
import React from "react";
import type { PublicListingDetail } from "@/types";

const AMENITY_ICONS: Record<string, JSX.Element> = {
  wifi: <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />,
  parking: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />,
  pool: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />,
  ac: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />,
  gym: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
  kitchen: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />,
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  parking: "Parking",
  pool: "Swimming Pool",
  ac: "Air Conditioning",
  gym: "Gym",
  kitchen: "Kitchen",
  tv: "Smart TV",
  washer: "Washer & Dryer",
  fireplace: "Fireplace",
};

interface InfoSectionProps {
  listing: PublicListingDetail;
  reviews?: any[];
}

const InfoSection: React.FC<InfoSectionProps> = ({ listing, reviews = [] }) => {
  const amenityKeys = listing.amenities?.map((a) => a.amenityKey) ?? [];

  return (
    <div className="lg:col-span-12 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900 leading-tight">{listing.name}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600">
          {listing.starRating && (
            <span className="flex items-center gap-1 font-semibold">
              ⭐ {listing.starRating}
            </span>
          )}
          {listing.town && (
            <span className="text-slate-400">
              📍 {listing.address ? `${listing.address}, ` : ""}{listing.town}, {listing.country}
            </span>
          )}
          {listing.cancellationPolicy && (
            <span className="capitalize text-slate-400">· {listing.cancellationPolicy} cancellation</span>
          )}
        </div>
      </div>

      {/* Property highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200 text-sm text-slate-700">
        {listing.category !== "car" ? (
          <>
            {listing.maxGuests && <div><span className="font-bold">{listing.maxGuests}</span> guests</div>}
            {listing.bedrooms && <div><span className="font-bold">{listing.bedrooms}</span> bedrooms</div>}
            {listing.bathrooms && <div><span className="font-bold">{listing.bathrooms}</span> bathrooms</div>}
            {listing.minStayNights > 1 && <div>Min <span className="font-bold">{listing.minStayNights}</span> nights</div>}
          </>
        ) : (
          <>
            {listing.carMake && <div className="font-bold">{listing.carMake} {listing.carModel}</div>}
            {listing.carYear && <div>{listing.carYear}</div>}
            {listing.seats && <div><span className="font-bold">{listing.seats}</span> seats</div>}
            {listing.transmission && <div className="capitalize">{listing.transmission}</div>}
          </>
        )}
      </div>

      {/* Description */}
      {listing.description && (
        <div className="pb-6 border-b border-slate-200">
          <p className="text-slate-600 leading-relaxed">{listing.description}</p>
        </div>
      )}

      {/* Amenities from API */}
      {(amenityKeys.length > 0 || listing.customAmenities?.length > 0) && (
        <div className="pb-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold mb-4">What this place offers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {amenityKeys.map((key) => (
              <div key={key} className="flex items-center gap-3 text-slate-700 text-sm">
                <svg className="w-5 h-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  {AMENITY_ICONS[key] ?? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                </svg>
                {AMENITY_LABELS[key] ?? key}
              </div>
            ))}
            {listing.customAmenities?.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-slate-700 text-sm">
                <svg className="w-5 h-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {a.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Car-specific details */}
      {listing.category === "car" && (
        <div className="pb-6 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {listing.fuelType && <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Fuel</span>{listing.fuelType}</div>}
          {listing.mileagePolicy && <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Mileage</span>{listing.mileagePolicy}</div>}
          {listing.transmission && <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Transmission</span><span className="capitalize">{listing.transmission}</span></div>}
          {listing.securityDeposit != null && listing.securityDeposit > 0 && (
            <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Security Deposit</span>{listing.currency} {listing.securityDeposit.toLocaleString()}</div>
          )}
        </div>
      )}

      {/* Reviews from API */}
      {reviews.length > 0 && (
        <div className="pb-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold mb-4">
            {listing.starRating && `⭐ ${listing.starRating} · `}{reviews.length} review{reviews.length !== 1 ? "s" : ""}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.slice(0, 4).map((r: any) => (
              <div key={r.id} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0B1E3F] text-white flex items-center justify-center font-bold text-sm uppercase">
                    {(r.guestName || r.reviewerName || "G").charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{r.guestName || r.reviewerName}</p>
                    <p className="text-xs text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : ""}</p>
                  </div>
                </div>
                {r.body && <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{r.body}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location */}
      <div className="pb-6">
        <h2 className="text-xl font-semibold mb-3">Location</h2>
        {listing.address && <p className="text-slate-500 text-sm mb-4">{listing.address}</p>}
        <div className="w-full h-[300px] bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-200">
          <div className="text-center space-y-2">
            <svg className="w-8 h-8 mx-auto text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <p className="text-sm font-semibold">{listing.town}{listing.country ? `, ${listing.country}` : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoSection;
