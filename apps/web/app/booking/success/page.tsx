"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listingApi } from "@/lib/listing-api";

interface BookingDetail {
  id: string;
  reference: string;
  status: string;
  listingType: string;
  listing: { title: string; address: string; town: string; country: string; primaryPhotoUrl: string | null };
  checkIn?: string | null;
  checkOut?: string | null;
  pickupDatetime?: string | null;
  returnDatetime?: string | null;
  nightsOrDays: number;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  totalAmount: number;
  currency: string;
  confirmedAt?: string | null;
}

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function SuccessPage() {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bookingId = sessionStorage.getItem("zika:booking_id");
    if (!bookingId) { router.replace("/traveller"); return; }

    listingApi.get<any>(`/guests/me/bookings/${bookingId}`)
      .then((res) => {
        if (res.data.success) setBooking(res.data.data);
        else router.replace("/traveller");
      })
      .catch(() => router.replace("/traveller"))
      .finally(() => setLoading(false));

    // Clear checkout context
    sessionStorage.removeItem("zika:checkout");
  }, []);

  function handleGoHome() {
    sessionStorage.removeItem("zika:booking_id");
    router.replace("/traveller");
  }

  function handleDownloadReceipt() {
    if (!booking) return;
    const isCar = booking.listingType === "car";
    const lines = [
      "ZIKA BOOKING — RECEIPT",
      "=".repeat(40),
      `Booking ID    : ${booking.reference}`,
      `Status        : Confirmed`,
      `Date          : ${fmt(booking.confirmedAt ?? new Date().toISOString())}`,
      "",
      "BOOKING DETAILS",
      "-".repeat(40),
      `Listing       : ${booking.listing.title}`,
      `Location      : ${booking.listing.town}, ${booking.listing.country}`,
      `Type          : ${booking.listingType}`,
      isCar
        ? `Pickup        : ${fmt(booking.pickupDatetime)}`
        : `Check-in      : ${fmt(booking.checkIn)}`,
      isCar
        ? `Return        : ${fmt(booking.returnDatetime)}`
        : `Check-out     : ${fmt(booking.checkOut)}`,
      `Duration      : ${booking.nightsOrDays} ${isCar ? "day" : "night"}${booking.nightsOrDays !== 1 ? "s" : ""}`,
      "",
      "GUEST DETAILS",
      "-".repeat(40),
      `Name          : ${booking.guestFirstName} ${booking.guestLastName}`,
      `Email         : ${booking.guestEmail}`,
      "",
      "PAYMENT",
      "-".repeat(40),
      `Total Paid    : ${booking.currency} ${Number(booking.totalAmount).toLocaleString()}`,
      `Payment Status: Paid`,
      "",
      "=".repeat(40),
      "Thank you for booking with Zika!",
      "Support: support@kainook.com",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ZIKA-Receipt-${booking.reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin h-8 w-8 border-4 border-[#0B1E3F] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!booking) return null;

  const isCar = booking.listingType === "car";

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col items-center">
      <div className="max-w-lg w-full px-4 py-10 space-y-6">

        {/* Success banner */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h1>
            <p className="text-slate-500 mt-1">Your booking has been successfully placed.</p>
          </div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2">
            <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Booking ID</span>
            <span className="font-bold text-emerald-800 font-mono">{booking.reference}</span>
          </div>
        </div>

        {/* Listing card */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {booking.listing.primaryPhotoUrl && (
            <img src={booking.listing.primaryPhotoUrl} alt={booking.listing.title} className="w-full h-40 object-cover" />
          )}
          <div className="p-4">
            <p className="font-bold text-slate-900">{booking.listing.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{booking.listing.town}, {booking.listing.country}</p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">Traveller</span>
              <span className="font-semibold text-slate-900">{booking.guestFirstName} {booking.guestLastName}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">{isCar ? "Pickup" : "Check-in"}</span>
              <span className="font-semibold text-slate-900">{fmt(isCar ? booking.pickupDatetime : booking.checkIn)}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">{isCar ? "Return" : "Check-out"}</span>
              <span className="font-semibold text-slate-900">{fmt(isCar ? booking.returnDatetime : booking.checkOut)}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">Duration</span>
              <span className="font-semibold text-slate-900">{booking.nightsOrDays} {isCar ? "day" : "night"}{booking.nightsOrDays !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">Total Paid</span>
              <span className="font-bold text-slate-900">{booking.currency} {Number(booking.totalAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">Payment Status</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Paid
              </span>
            </div>
          </div>
        </div>

        {/* Email note */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-blue-700">A confirmation email with your booking details and receipt has been sent to <strong>{booking.guestEmail}</strong>.</p>
        </div>

        {/* Actions */}
        <div className="space-y-3 pb-8">
          <button
            onClick={handleDownloadReceipt}
            className="w-full py-4 border-2 border-[#0B1E3F] text-[#0B1E3F] hover:bg-[#0B1E3F] hover:text-white font-bold rounded-2xl transition text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Receipt
          </button>
          <button
            onClick={handleGoHome}
            className="w-full py-4 bg-[#0B1E3F] hover:bg-[#07152B] text-white font-bold rounded-2xl transition text-sm"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}
