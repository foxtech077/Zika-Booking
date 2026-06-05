"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listingApi } from "@/lib/listing-api";

interface CheckoutContext {
  listingId: string;
  listingTitle: string;
  listingCategory: string;
  listingPhoto: string | null;
  listingTown: string;
  listingCountry: string;
  pricePerNight: number;
  currency: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  lockToken: string;
  lockExpiresAt: string;
  voucherCode?: string;
  voucherDiscount: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  adults: number;
  children: number;
  specialRequests: string;
  driverFirstName?: string;
  driverLastName?: string;
  driverAge?: number;
  deliveryRequested?: boolean;
  deliveryAddress?: string;
}

function fmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReviewPage() {
  const router = useRouter();
  const [ctx, setCtx] = useState<CheckoutContext | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("zika:checkout");
    if (!raw) { router.replace("/traveller"); return; }
    const data: CheckoutContext = JSON.parse(raw);
    setCtx(data);
    const remaining = Math.max(0, Math.floor((new Date(data.lockExpiresAt).getTime() - Date.now()) / 1000));
    setSecondsLeft(remaining);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && ctx) {
      sessionStorage.removeItem("zika:checkout");
      router.replace("/traveller");
    }
  }, [secondsLeft, ctx]);

  async function handleConfirm() {
    if (!ctx) return;
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, any> = {
        lockToken: ctx.lockToken,
        listingId: ctx.listingId,
        guestFirstName: ctx.firstName,
        guestLastName: ctx.lastName,
        guestEmail: ctx.email,
        guestPhone: ctx.phone,
        adults: ctx.adults,
        children: ctx.children,
        specialRequests: ctx.specialRequests,
      };
      if (ctx.listingCategory !== "car") {
        body.checkIn = ctx.checkIn;
        body.checkOut = ctx.checkOut;
      } else {
        body.pickupDatetime = ctx.pickupDatetime;
        body.returnDatetime = ctx.returnDatetime;
        body.driverFirstName = ctx.driverFirstName;
        body.driverLastName = ctx.driverLastName;
        body.driverAge = ctx.driverAge;
        body.deliveryRequested = ctx.deliveryRequested ?? false;
        body.deliveryAddress = ctx.deliveryAddress;
      }
      if (ctx.voucherCode) body.voucherCode = ctx.voucherCode;

      const res = await listingApi.post<any>("/bookings", body);
      if (!res.data.success) {
        setError(res.data?.error?.message ?? "Booking failed. Please try again.");
        return;
      }
      const bookingId = res.data.data.bookingId;
      sessionStorage.setItem("zika:booking_id", bookingId);
      router.push("/booking/payment");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin h-8 w-8 border-4 border-[#0B1E3F] border-t-transparent rounded-full" />
      </div>
    );
  }

  const isCar = ctx.listingCategory === "car";
  const base = ctx.pricePerNight * ctx.nightsOrDays;
  const serviceFee = Math.ceil(base * 0.05);
  const grandTotal = Math.max(0, base + serviceFee - (ctx.voucherDiscount ?? 0));
  const timerExpiring = secondsLeft < 60;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 transition">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900">Review Booking</h1>
          <p className="text-xs text-slate-400">Step 1 of 2 — Confirm your details</p>
        </div>
        {/* Lock countdown */}
        <div className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${timerExpiring ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:{(secondsLeft % 60).toString().padStart(2, "0")}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Listing card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-3 shadow-sm">
          {ctx.listingPhoto && (
            <img src={ctx.listingPhoto} alt={ctx.listingTitle} className="w-16 h-16 rounded-xl object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{ctx.listingTitle}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{ctx.listingCategory} · {ctx.listingTown}, {ctx.listingCountry}</p>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Duration</p>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">{isCar ? "Pickup" : "Check-in"}</span>
              <span className="font-semibold text-slate-900">{fmt(isCar ? ctx.pickupDatetime : ctx.checkIn)}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">{isCar ? "Return" : "Check-out"}</span>
              <span className="font-semibold text-slate-900">{fmt(isCar ? ctx.returnDatetime : ctx.checkOut)}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">Duration</span>
              <span className="font-semibold text-slate-900">{ctx.nightsOrDays} {isCar ? "day" : "night"}{ctx.nightsOrDays !== 1 ? "s" : ""}</span>
            </div>
            {!isCar && (
              <div className="flex justify-between px-4 py-3">
                <span className="text-slate-500">Guests</span>
                <span className="font-semibold text-slate-900">{ctx.adults + ctx.children} guest{ctx.adults + ctx.children !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </div>

        {/* Traveller details */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Traveller Details</p>
            <button onClick={() => router.back()} className="text-xs font-semibold text-[#0B1E3F] hover:underline">Edit</button>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">Name</span>
              <span className="font-semibold text-slate-900">{ctx.firstName} {ctx.lastName}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-900 truncate max-w-[55%] text-right">{ctx.email}</span>
            </div>
            {ctx.phone && (
              <div className="flex justify-between px-4 py-3">
                <span className="text-slate-500">Phone</span>
                <span className="font-semibold text-slate-900">{ctx.phone}</span>
              </div>
            )}
            {ctx.specialRequests && (
              <div className="flex justify-between px-4 py-3">
                <span className="text-slate-500">Requests</span>
                <span className="font-semibold text-slate-900 text-right max-w-[60%]">{ctx.specialRequests}</span>
              </div>
            )}
            {isCar && ctx.driverAge && (
              <div className="flex justify-between px-4 py-3">
                <span className="text-slate-500">Driver Age</span>
                <span className="font-semibold text-slate-900">{ctx.driverAge} years</span>
              </div>
            )}
          </div>
        </div>

        {/* Price breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Price Breakdown</p>
          </div>
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>{ctx.currency} {ctx.pricePerNight.toLocaleString()} × {ctx.nightsOrDays} {isCar ? "day" : "night"}{ctx.nightsOrDays !== 1 ? "s" : ""}</span>
              <span>{ctx.currency} {base.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Service fee (5%)</span>
              <span>{ctx.currency} {serviceFee.toLocaleString()}</span>
            </div>
            {(ctx.voucherDiscount ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Voucher discount</span>
                <span>−{ctx.currency} {ctx.voucherDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-base">
              <span>Total Amount</span>
              <span>{ctx.currency} {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-8">
          <button
            onClick={handleConfirm}
            disabled={submitting || secondsLeft === 0}
            className="w-full py-4 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 text-white font-bold rounded-2xl transition text-sm"
          >
            {submitting ? "Confirming…" : `Confirm & Proceed to Payment →`}
          </button>
          <button
            onClick={() => router.back()}
            className="w-full py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-2xl transition text-sm"
          >
            Edit Details
          </button>
        </div>
      </div>
    </div>
  );
}
