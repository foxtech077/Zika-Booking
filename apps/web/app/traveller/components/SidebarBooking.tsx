"use client";
// TODO: This component appears to be unused (not imported anywhere). Verify and remove if dead code.
import type { PublicListingDetail } from "@/types";
import React from "react";
import DateRangePicker from "./DateRangePicker";

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

  const rawRate = listing.pricePerNight || 0;

  // Promo discount calculation
  const promoPercentFromBadge = listing.promoBadge?.labelText
    ? parseFloat(listing.promoBadge.labelText.replace(/[^0-9.]/g, ""))
    : 0;

  const hasPromoBadge = promoPercentFromBadge > 0;
  const promoRate = hasPromoBadge ? Number((rawRate * (1 - promoPercentFromBadge / 100)).toFixed(2)) : rawRate;
  const mrpPrice = hasPromoBadge ? rawRate : (listing.mrpPrice && listing.mrpPrice > rawRate) ? listing.mrpPrice : null;
  const effectiveRate = hasPromoBadge ? promoRate : rawRate;

  // Long-stay discount calculation
  const longStayMin = listing.longStayMinNights ?? 7;
  const longStayApplies = !isCar && listing.longStayEnabled && days >= longStayMin && (listing.longStayDiscountValue ?? 0) > 0;
  const longStayVal = Number(listing.longStayDiscountValue ?? 0);

  const originalSubtotal = effectiveRate * days;
  const longStayDiscountAmount = longStayApplies
    ? Number((listing.longStayDiscountType === "percentage" ? originalSubtotal * (longStayVal / 100) : longStayVal * days).toFixed(2))
    : 0;

  const subtotalAfterDiscount = Math.max(0, originalSubtotal - longStayDiscountAmount);

  // Service fee — flat rate served by GET /listings/:id/public (serviceFeeRate,
  // currently 0.04). This is a pass-through transaction fee that covers payment
  // gateway costs. The nightly/daily rate is the raw list price (commission is
  // deducted from the provider's payout, never baked into the guest price).
  const serviceFeeRate = listing.serviceFeeRate ?? 0.04;
  const serviceFeePercent = Math.round(serviceFeeRate * 1000) / 10;
  const serviceFee = days > 0 ? Math.ceil(subtotalAfterDiscount * serviceFeeRate * 100) / 100 : 0;
  // Car rentals collect the security deposit upfront (added on dev).
  // Waived when the provider supplies a driver — mirrors the backend,
  // which zeroes the deposit in calculateBilling under the same condition.
  const securityDeposit = isCar && !listing.driverProvided ? Number(listing.securityDeposit ?? 0) : 0;
  const grandTotal = subtotalAfterDiscount + serviceFee + securityDeposit;

  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-left space-y-5">
      {/* Price header */}
      <div>
        {mrpPrice != null && mrpPrice > effectiveRate && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-400 line-through">
              {listing.currency} {mrpPrice.toLocaleString()}
            </span>
            {listing.promoBadge?.labelText && (
              <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                🔥 {listing.promoBadge.labelText}
              </span>
            )}
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <div className="text-2xl font-bold text-slate-900">
            {listing.currency} {effectiveRate.toLocaleString()}
            <span className="text-sm font-normal text-slate-500 ml-1">/ {isCar ? "day" : "night"}</span>
          </div>
          {listing.starRating && (
            <span className="text-sm font-semibold text-slate-700">⭐ {listing.starRating}</span>
          )}
        </div>
      </div>

      {/* Long-Stay Discount Banner */}
      {listing.longStayEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2.5">
          <span className="text-base">🎉</span>
          <div>
            <p className="font-bold text-amber-900">Long-Stay Discount</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Book {longStayMin}+ nights and save {listing.longStayDiscountValue ?? 0}{listing.longStayDiscountType === "percentage" ? "%" : ` ${listing.currency}`} automatically.
            </p>
          </div>
        </div>
      )}

      {/* Date inputs */}
      <div className="space-y-3">
        {isCar ? (
          <DateRangePicker
            label="Rental Dates"
            isCar
            startDate={searchPickupDate}
            endDate={searchReturnDate}
            onChange={(start, end) => {
              setSearchPickupDate(start);
              setSearchReturnDate(end);
            }}
            minDate={getTodayString()}
          />
        ) : (
          <>
            <DateRangePicker
              label="Check-in – Check-out"
              startDate={searchCheckIn}
              endDate={searchCheckOut}
              onChange={(start, end) => {
                setSearchCheckIn(start);
                setSearchCheckOut(end);
              }}
              minDate={getTodayString()}
            />
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guests</p>
              <select value={searchGuests} onChange={(e) => setSearchGuests(Number(e.target.value))} className="w-full mt-1 text-sm bg-transparent outline-none font-bold text-slate-700">
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
        {lockingListing ? "Securing your dates…" : "Continue — You won't be charged yet"}
      </button>

      {/* Price breakdown */}
      {days > 0 && (
        <div className="space-y-2 pt-3 border-t border-slate-100 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>
              {listing.currency} {(hasPromoBadge ? rawRate : effectiveRate).toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}
            </span>
            <span>{listing.currency} {(rawRate * days).toLocaleString()}</span>
          </div>
          {hasPromoBadge && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Promotional discount ({listing.promoBadge?.labelText})</span>
              <span>−{listing.currency} {((rawRate - promoRate) * days).toLocaleString()}</span>
            </div>
          )}
          {longStayApplies && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Long-stay discount</span>
              <span>−{listing.currency} {longStayDiscountAmount.toLocaleString()}</span>
            </div>
          )}
          {serviceFeePercent > 0 && (
            <div className="flex justify-between">
              <span>Service fee ({serviceFeePercent}%)</span>
              <span>{listing.currency} {serviceFee.toLocaleString()}</span>
            </div>
          )}
          {isCar && securityDeposit > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Security deposit</span>
              <span>{listing.currency} {securityDeposit.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-base">
            <span>Total</span>
            <span className="text-emerald-700">{listing.currency} {grandTotal.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarBooking;
