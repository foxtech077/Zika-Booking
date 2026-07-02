"use client";

import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import ListingImage from "./ListingImage";
import { MessageProviderButton } from "./MessageProviderButton";

interface Booking {
  id: string;
  reference: string;
  status: string;
  listingId?: string;
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
  canCancel: boolean;
  createdAt?: string | null;
}

interface Props {
  booking: Booking;
  onClose: () => void;
  onCancel: (id: string) => void;
  cancellingId: string | null;
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

function fmtDate(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReservationDetailModal({ booking, onClose, onCancel, cancellingId }: Props) {
  const isCancelling = cancellingId === booking.id;
  const isCar = booking.listingCategory === "car";
  const statusStyle = STATUS_STYLES[booking.status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const statusLabel = STATUS_LABEL[booking.status] ?? booking.status;

  const dateFrom = isCar ? fmtDateTime(booking.pickupDatetime) : fmtDate(booking.checkIn);
  const dateTo = isCar ? fmtDateTime(booking.returnDatetime) : fmtDate(booking.checkOut);
  const dateFromLabel = isCar ? "Pickup" : "Check-in";
  const dateToLabel = isCar ? "Return" : "Check-out";
  const durationLabel = isCar
    ? `${booking.nightsOrDays} day${booking.nightsOrDays !== 1 ? "s" : ""}`
    : `${booking.nightsOrDays} night${booking.nightsOrDays !== 1 ? "s" : ""}`;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="relative z-10 w-full max-w-2xl bg-white rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Reservation details"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1D8D2B]">
              Reservation details
            </p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5 leading-tight">
              {booking.listingTitle || "Booking"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close reservation details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Listing photo */}
          <div className="h-48 shrink-0 bg-slate-100 sm:h-56">
            <ListingImage
              listingId={booking.listingId}
              alt={booking.listingTitle}
              className="h-full w-full object-cover"
              fallbackNode={
                <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-200">
                  <svg className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
              }
            />
          </div>

          <div className="space-y-5 px-6 py-6">
            {/* Status + category row */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle}`}
                >
                  {statusLabel}
                </span>
                <p className="font-mono text-[11px] text-slate-400">#{booking.reference}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {CAT_LABEL[booking.listingCategory] ?? booking.listingCategory}
              </span>
            </div>

            {/* Dates */}
            {(dateFrom || dateTo) && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {isCar ? "Rental period" : "Stay dates"}
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {dateFrom && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{dateFromLabel}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{dateFrom}</p>
                    </div>
                  )}
                  {dateTo && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{dateToLabel}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{dateTo}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Duration</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{durationLabel}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Booking info table */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Booking information
              </p>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                {booking.createdAt && (
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-xs text-slate-500">Booked on</span>
                    <span className="text-xs font-semibold text-slate-800">{fmtDate(booking.createdAt)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <span className="text-xs text-slate-500">Booking status</span>
                  <span className="text-xs font-semibold text-slate-800">{statusLabel}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <span className="text-xs text-slate-500">Listing</span>
                  <span className="max-w-[55%] truncate text-right text-xs font-semibold text-slate-800">
                    {booking.listingTitle || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3.5">
                  <span className="text-sm font-semibold text-slate-700">Total amount</span>
                  <span className="text-base font-bold text-[#0c2614]">
                    {booking.currency} {booking.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Actions</p>
              <div className="flex flex-wrap gap-2">
                {booking.listingId && (
                  <MessageProviderButton
                    listingId={booking.listingId}
                    className="flex-1 min-w-[140px]"
                  />
                )}

                {booking.status === "completed" && (
                  <Link
                    href={`/traveller/reviews?bookingId=${encodeURIComponent(booking.id)}&listingId=${encodeURIComponent(booking.listingId ?? "")}&listingName=${encodeURIComponent(booking.listingTitle ?? "")}`}
                    className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    Leave Review
                  </Link>
                )}

                {booking.canCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(booking.id)}
                    disabled={isCancelling}
                    className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {isCancelling ? "Cancelling…" : "Cancel Booking"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
