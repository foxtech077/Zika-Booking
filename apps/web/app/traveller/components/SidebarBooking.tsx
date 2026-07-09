"use client";
import React from "react";
import type { PublicListingDetail } from "@/types";

interface SidebarBookingProps {
  listing: PublicListingDetail;
  searchCheckIn: string;
  setSearchCheckIn: (v: string) => void;
  searchCheckOut: string;
  setSearchCheckOut: (v: string) => void;
  searchPickupDate: string;
  setSearchPickupDate: (v: string) => void;
  searchReturnDate: string;
  setSearchReturnDate: (v: string) => void;
  searchGuests: number;
  setSearchGuests: (n: number) => void;
  lockingListing: boolean;
  availabilityStatus: "checking" | "available" | "unavailable" | null;
  bookingError: string;
  onInitiateLock: () => void;
  getTodayString: () => string;
  calcDays: (start: string, end: string) => number;
}

const SidebarBooking: React.FC<SidebarBookingProps> = ({
  listing,
  searchCheckIn,
  setSearchCheckIn,
  searchCheckOut,
  setSearchCheckOut,
  searchPickupDate,
  setSearchPickupDate,
  searchReturnDate,
  setSearchReturnDate,
  searchGuests,
  setSearchGuests,
  lockingListing,
  availabilityStatus,
  bookingError,
  onInitiateLock,
  getTodayString,
  calcDays,
}) => {
  const isCar = listing.category === "car";
  const start = isCar ? searchPickupDate : searchCheckIn;
  const end = isCar ? searchReturnDate : searchCheckOut;
  const days = calcDays(start, end);
  const baseTotal = listing.pricePerNight * days;
  const serviceFee = days > 0 ? Math.round(baseTotal * 0.1) : 0;
  const grandTotal = baseTotal + serviceFee;

  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-left space-y-5">
      {/* Price header */}
      <div className="flex justify-between items-baseline">
        <div className="text-2xl font-bold text-slate-900">
          {listing.currency} {listing.pricePerNight.toLocaleString()}
          <span className="text-sm font-normal text-slate-500 ml-1">/ {isCar ? "day" : "night"}</span>
        </div>
        {listing.starRating && (
          <span className="text-sm font-semibold text-slate-700">⭐ {listing.starRating}</span>
        )}
      </div>

      {/* Date inputs */}
      <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-300">
        {isCar ? (
          <div className="grid grid-cols-2 divide-x divide-slate-300">
            <div className="p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup</p>
              <input type="date" min={getTodayString()} value={searchPickupDate} onChange={(e) => setSearchPickupDate(e.target.value)} className="w-full mt-1 text-sm bg-transparent outline-none" />
            </div>
            <div className="p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return</p>
              <input type="date" min={searchPickupDate || getTodayString()} value={searchReturnDate} onChange={(e) => setSearchReturnDate(e.target.value)} className="w-full mt-1 text-sm bg-transparent outline-none" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 divide-x divide-slate-300">
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Check-in</p>
                <input type="date" min={getTodayString()} value={searchCheckIn} onChange={(e) => setSearchCheckIn(e.target.value)} className="w-full mt-1 text-sm bg-transparent outline-none" />
              </div>
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Check-out</p>
                <input type="date" min={searchCheckIn || getTodayString()} value={searchCheckOut} onChange={(e) => setSearchCheckOut(e.target.value)} className="w-full mt-1 text-sm bg-transparent outline-none" />
              </div>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guests</p>
              <select value={searchGuests} onChange={(e) => setSearchGuests(Number(e.target.value))} className="w-full mt-1 text-sm bg-transparent outline-none">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Availability indicator */}
      {availabilityStatus === "checking" && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          Checking availability…
        </div>
      )}
      {availabilityStatus === "unavailable" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-700">
           These dates are not available. Please choose different dates.
        </div>
      )}
      {availabilityStatus === "available" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-semibold text-emerald-700">
           Dates are available — reserve now!
        </div>
      )}

      {bookingError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs font-semibold text-red-600">
          {bookingError}
        </div>
      )}

      <button
        onClick={onInitiateLock}
        disabled={lockingListing || availabilityStatus === "unavailable" || availabilityStatus === "checking"}
        className="w-full py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition text-sm"
      >
        {lockingListing ? "Securing your dates…" : "Reserve — You won't be charged yet"}
      </button>

      {/* Price breakdown */}
      {days > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>{listing.currency} {listing.pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}</span>
            <span>{listing.currency} {baseTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Service fee (10%)</span>
            <span>{listing.currency} {serviceFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
            <span>Total</span>
            <span>{listing.currency} {grandTotal.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarBooking;
