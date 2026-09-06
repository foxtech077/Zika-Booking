"use client";
import React from "react";
import Link from "next/link";
import ListingImage from "./ListingImage";

interface Booking {
  id: string;
  reference: string;
  status: string;
  listingId: string;
  listingTitle: string;
  listingCategory: string;
  checkIn?: string | null;
  checkOut?: string | null;
  pickupDatetime?: string | null;
  returnDatetime?: string | null;
  totalAmount: number;
  currency: string;
  nightsOrDays: number;
  primaryPhotoUrl?: string | null;
  primaryPhotoThumbUrl?: string | null;
  canCancel: boolean;
  adults?: number | null;
  children?: number | null;
}

interface Props {
  booking: Booking;
  onCancel: (id: string) => void;
  cancellingId: string | null;
  highlighted?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending_payment: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled_by_guest: "bg-red-50 text-red-600 border-red-200",
  cancelled_by_provider: "bg-red-50 text-red-600 border-red-200",
  cancelled_by_system: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  pending_payment: "Awaiting Payment",
  completed: "Completed",
  cancelled_by_guest: "Cancelled",
  cancelled_by_provider: "Cancelled by Host",
  cancelled_by_system: "Cancelled",
};

const CAT_LABEL: Record<string, string> = {
  hotel: "Hotel",
  apartment: "Apartment",
  car: "Car Rental",
};

function fmt(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReservationCard({ booking, onCancel, cancellingId, highlighted }: Props) {
  const isCancelling = cancellingId === booking.id;
  const statusStyle = STATUS_STYLES[booking.status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const statusLabel = STATUS_LABEL[booking.status] ?? booking.status;
  const isCar = booking.listingCategory === "car";
  const totalGuests = Number(booking.adults ?? 0) + Number(booking.children ?? 0);

  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (highlighted && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 500);
    }
  }, [highlighted]);

  const dateFrom = isCar ? fmt(booking.pickupDatetime) : fmt(booking.checkIn);
  const dateTo = isCar ? fmt(booking.returnDatetime) : fmt(booking.checkOut);
  const dateLabel = isCar ? "Pickup" : "Check-in";
  const dateLabel2 = isCar ? "Return" : "Check-out";
  const durationLabel = isCar
    ? `${booking.nightsOrDays} day${booking.nightsOrDays !== 1 ? "s" : ""}`
    : `${booking.nightsOrDays} night${booking.nightsOrDays !== 1 ? "s" : ""}`;

  return (
    <div
      ref={cardRef}
      className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
        highlighted
          ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/5 scale-[1.01]"
          : "border-slate-200"
      }`}
    >
      <div className="flex">
        <div className="w-24 h-24 shrink-0 bg-slate-100 overflow-hidden">
          <ListingImage
            listingId={booking.listingId}
            src={booking.primaryPhotoThumbUrl ?? booking.primaryPhotoUrl ?? undefined}
            alt={booking.listingTitle}
            className="w-full h-full object-cover"
            fallbackNode={
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              </div>
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-800 truncate">{booking.listingTitle || "Booking"}</p>
                {highlighted && (
                  <span className="shrink-0 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-400 font-mono">{booking.reference}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] text-slate-400">{CAT_LABEL[booking.listingCategory] ?? booking.listingCategory}</span>
              </div>
            </div>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle}`}>
              {statusLabel}
            </span>
          </div>

          {/* Dates */}
          {dateFrom && (
            <div className="flex gap-3 mt-2">
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">{dateLabel}</p>
                <p className="text-xs font-semibold text-slate-700">{dateFrom}</p>
              </div>
              {dateTo && (
                <div>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">{dateLabel2}</p>
                  <p className="text-xs font-semibold text-slate-700">{dateTo}</p>
                </div>
              )}
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Duration</p>
                <p className="text-xs font-semibold text-slate-700">{durationLabel}</p>
              </div>
              {!isCar && totalGuests > 0 && (
                <div>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider">Guests</p>
                  <p className="text-xs font-semibold text-slate-700">{totalGuests} guest{totalGuests !== 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm font-bold text-[#0B1E3F]">
              {booking.currency} {booking.totalAmount.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              {(booking.status === "completed") && (
                <Link
                  href={`/traveller/reviews?bookingId=${encodeURIComponent(booking.id)}&listingId=${encodeURIComponent(booking.listingId)}&listingName=${encodeURIComponent(booking.listingTitle ?? "")}`}
                  className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition"
                >
                  Leave Review
                </Link>
              )}
              {booking.canCancel && (
                <button
                  onClick={() => onCancel(booking.id)}
                  disabled={isCancelling}
                  className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                >
                  {isCancelling ? "Cancelling…" : "Cancel"}
                </button>
              )}
              {booking.status === "pending_payment" && (
                <span className="text-[10px] text-amber-600 font-medium">Payment required</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}