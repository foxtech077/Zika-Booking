"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";
import ListingImage from "../../traveller/components/ListingImage";
import { MessageProviderButton } from "../../traveller/components/MessageProviderButton";

interface ManageListing {
  id: string;
  title: string;
  address: string | null;
  town: string | null;
  neighborhood: string | null;
  country: string | null;
  primaryPhotoUrl: string | null;
}

interface ManageBooking {
  id: string;
  reference: string;
  status: string;
  listingType: string;
  listing: ManageListing;
  checkIn: string | null;
  checkOut: string | null;
  pickupDatetime: string | null;
  returnDatetime: string | null;
  nightsOrDays: number;
  adults: number | null;
  children: number | null;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  serviceFee: number;
  serviceFeeRate?: number;
  taxAmount: number;
  securityDeposit: number;
  voucherCode: string | null;
  voucherDiscount: number;
  totalAmount: number;
  currency: string;
  priceBreakdownJson?: any;
  cancellationPolicy: string;
  refundAmount: number | null;
  cancelledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  canCancel: boolean;
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

const POLICY_LABEL: Record<string, string> = {
  flexible: "Flexible — free cancellation until 48 hours before check-in",
  moderate: "Moderate — full refund up to 7 days before, 50% from 48 hours before",
  strict: "Strict — 50% refund up to 14 days before",
  non_refundable: "Non-refundable",
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BookingManageView() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const code = typeof params?.code === "string" ? params.code : undefined;
  const token = searchParams.get("token");

  const [booking, setBooking] = useState<ManageBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorExpired, setErrorExpired] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // No token → keep the legacy deep-link behaviour for signed-in users.
  const redirected = useRef(false);
  useEffect(() => {
    if (!token && code && !redirected.current) {
      redirected.current = true;
      router.replace(`/?tab=bookings&bookingCode=${encodeURIComponent(code)}`);
    }
  }, [token, code, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listingApi.get(`/bookings/manage/${encodeURIComponent(token)}`);
      setBooking(res.data?.data ?? null);
    } catch (err: any) {
      const status = err?.response?.status;
      setErrorExpired(status === 410);
      setError(
        status === 410
          ? "This booking link has expired."
          : status === 404
            ? "This booking link is invalid."
            : "Something went wrong while loading your booking. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = useCallback(async () => {
    if (!token || !booking) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await listingApi.post(`/bookings/manage/${encodeURIComponent(token)}/cancel`, {});
      const data = res.data?.data;
      setBooking((b) =>
        b
          ? {
              ...b,
              status: "cancelled_by_guest",
              canCancel: false,
              cancelledAt: new Date().toISOString(),
              refundAmount: typeof data?.refundAmount === "number" ? data.refundAmount : b.refundAmount,
            }
          : b,
      );
    } catch (err: any) {
      setCancelError(
        err?.response?.data?.error?.message ?? "Could not cancel the booking. Please try again.",
      );
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }, [token, booking]);

  // Legacy deep link without a token — redirect handled by the effect above.
  if (!token) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
          <p className="text-slate-500 font-medium text-sm animate-pulse">
            Loading your booking details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-800">
            {errorExpired ? "Link expired" : "Link not found"}
          </h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            {error ?? "This booking link is invalid."}
          </p>
          <div className="mt-6 space-y-2">
            <Link
              href="/auth/register"
              className="block w-full text-center px-4 py-2.5 bg-[#1D8D2B] hover:bg-[#177024] text-white text-sm font-semibold rounded-xl transition"
            >
              Create an account
            </Link>
            <Link
              href="/"
              className="block w-full text-center px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold rounded-xl transition"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCar = booking.listingType === "car";
  const isCancelled = booking.status.startsWith("cancelled");
  const statusStyle = STATUS_STYLES[booking.status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  const statusLabel = STATUS_LABEL[booking.status] ?? booking.status;
  const dateLabel1 = isCar ? "Pick-up" : "Check-in";
  const dateLabel2 = isCar ? "Return" : "Check-out";
  const dateFrom = isCar ? fmtDateTime(booking.pickupDatetime) : fmtDate(booking.checkIn);
  const dateTo = isCar ? fmtDateTime(booking.returnDatetime) : fmtDate(booking.checkOut);
  const durationLabel = isCar
    ? `${booking.nightsOrDays} day${booking.nightsOrDays !== 1 ? "s" : ""}`
    : `${booking.nightsOrDays} night${booking.nightsOrDays !== 1 ? "s" : ""}`;
  const totalGuests = Number(booking.adults ?? 0) + Number(booking.children ?? 0);
  const discount = Number(booking.discountAmount) + Number(booking.voucherDiscount);
  // booking.subtotal is the post-discount subtotal; the gross commission-inclusive
  // base is read from the price snapshot so the receipt lines reconcile.
  // Fallback: reconstruct gross base from post-discount subtotal + discount
  // (not booking.subtotal alone, which is post-discount).
  const grossBase = Number(
    booking.priceBreakdownJson?.breakdown?.baseAmount
    ?? (Number(booking.subtotal) + discount)
  );
  const currency = booking.currency;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[#1D8D2B] font-extrabold text-xl tracking-tight">
              Kainook
            </Link>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="hidden sm:inline text-sm text-slate-500 font-medium">Your Booking</span>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Status banner */}
        {isCancelled ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h1 className="font-bold text-red-700 text-lg">This booking has been cancelled</h1>
            <p className="text-red-600/80 text-sm mt-1 leading-relaxed">
              {booking.refundAmount && booking.refundAmount > 0 ? (
                <>A refund of <strong>{currency} {fmt(booking.refundAmount)}</strong> is being processed to your original payment method.</>
              ) : (
                "No refund applies based on the cancellation policy."
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-slate-800 text-lg">Booking {booking.reference}</h1>
              <p className="text-sm text-slate-500">
                Booked by {booking.guestFirstName} {booking.guestLastName} · {booking.guestEmail}
              </p>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${statusStyle}`}>
              {statusLabel}
            </span>
          </div>
        )}

        {/* Listing card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex">
            <div className="w-28 h-28 shrink-0 bg-slate-100 overflow-hidden">
              <ListingImage
                listingId={booking.listing.id}
                src={booking.listing.primaryPhotoUrl ?? undefined}
                alt={booking.listing.title}
                className="w-full h-full object-cover"
                fallbackNode={
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                  </div>
                }
              />
            </div>
            <div className="flex-1 p-4 min-w-0">
              <p className="text-sm font-bold text-slate-800">{booking.listing.title || "Booking"}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {CAT_LABEL[booking.listingType] ?? booking.listingType}
                {booking.listing.town && ` · ${booking.listing.town}`}
                {booking.listing.country && `, ${booking.listing.country}`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{dateLabel1}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{dateFrom}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{dateLabel2}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{dateTo}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Duration</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{durationLabel}</p>
                </div>
                {totalGuests > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Guests</p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">
                      {totalGuests} guest{totalGuests !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h2 className="font-bold text-slate-800 text-sm">Receipt</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Base amount ({durationLabel})</span>
              <span>{currency} {fmt(grossBase)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>−{currency} {fmt(discount)}</span>
              </div>
            )}
            {Number(booking.serviceFee) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Service fee{booking.serviceFeeRate ? ` (${Math.round(Number(booking.serviceFeeRate) * 100)}%)` : ''}</span>
                <span>{currency} {fmt(Number(booking.serviceFee))}</span>
              </div>
            )}
            {Number(booking.taxAmount) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Taxes</span>
                <span>{currency} {fmt(Number(booking.taxAmount))}</span>
              </div>
            )}
            {Number(booking.deliveryFee) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Delivery fee</span>
                <span>{currency} {fmt(Number(booking.deliveryFee))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2">
              <span>Total Paid</span>
              <span>{currency} {fmt(Number(booking.totalAmount))}</span>
            </div>
          </div>
        </div>

        {/* Contact host — available after payment, not just before booking */}
        {isAuthenticated && !isCancelled && booking.listing?.id && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-800 text-sm">Need to reach your host?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Message your host about check-in, directions, or any special requests.
            </p>
            <MessageProviderButton listingId={booking.listing.id} />
          </div>
        )}

        {/* Cancellation policy */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h2 className="font-bold text-slate-800 text-sm">Cancellation Policy</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {POLICY_LABEL[booking.cancellationPolicy] ?? booking.cancellationPolicy}
          </p>
          {!isCancelled && booking.canCancel && (
            <div className="pt-2">
              {confirming ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    Are you sure you want to cancel this booking? Any refund is determined by the cancellation policy above.
                  </p>
                  {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {cancelling ? "Cancelling…" : "Yes, cancel booking"}
                    </button>
                    <button
                      onClick={() => { setConfirming(false); setCancelError(null); }}
                      disabled={cancelling}
                      className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      Keep booking
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl border border-red-200 transition"
                >
                  Cancel booking
                </button>
              )}
            </div>
          )}
          {booking.status === "confirmed" && !booking.canCancel && (
            <p className="pt-2 text-sm text-slate-500 leading-relaxed">
              Cancellation is no longer available because your check-in has already started.
            </p>
          )}
          {isCancelled && booking.cancelledAt && (
            <p className="text-xs text-slate-400">
              Cancelled on {fmtDate(booking.cancelledAt.slice(0, 10))}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          This link is private to this booking and stays valid until 24 hours after your stay ends.
        </p>
      </main>
    </div>
  );
}
