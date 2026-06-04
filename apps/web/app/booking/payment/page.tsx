"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";

interface BookingDetail {
  id: string;
  reference: string;
  listingType: string;
  totalAmount: number;
  currency: string;
  listing: { title: string; primaryPhotoUrl: string | null };
  checkIn?: string | null;
  checkOut?: string | null;
  pickupDatetime?: string | null;
  returnDatetime?: string | null;
  nightsOrDays: number;
}

export default function PaymentPage() {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "tara">("stripe");
  const [mobileNumber, setMobileNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"select" | "stripe_card" | "polling">("select");

  const stripeCardRef = useRef<HTMLDivElement>(null);
  const [stripeInstance, setStripeInstance] = useState<any>(null);
  const [stripeCardElement, setStripeCardElement] = useState<any>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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
  }, []);

  useEffect(() => {
    if (step !== "stripe_card" || !stripeInstance || !stripeCardRef.current) return;
    const elements = stripeInstance.elements();
    const card = elements.create("card", {
      style: { base: { fontSize: "14px", color: "#1e293b", fontFamily: "inherit", "::placeholder": { color: "#94a3b8" } } },
    });
    card.mount(stripeCardRef.current);
    setStripeCardElement(card);
    return () => { try { card.destroy(); } catch { /* already destroyed */ } };
  }, [step, stripeInstance]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handlePay() {
    if (!booking) return;
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, any> = { bookingId: booking.id, paymentProvider };
      if (paymentProvider === "tara") {
        if (!mobileNumber) { setError("Please enter your mobile number."); setSubmitting(false); return; }
        body.mobileNumber = mobileNumber;
      }

      const res = await paymentApi.post<any>("/initiate", body);
      if (!res.data.success) {
        setError(res.data?.error?.message ?? "Payment initiation failed.");
        return;
      }

      const pmId: string = res.data.data.paymentId;
      setPaymentId(pmId);

      if (paymentProvider === "stripe") {
        const { clientSecret, publishableKey } = res.data.data as { clientSecret: string; publishableKey: string };
        setStripeClientSecret(clientSecret);
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(publishableKey);
        setStripeInstance(stripe);
        setStep("stripe_card");
      } else {
        setStep("polling");
        startPolling(pmId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? "Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStripeConfirm() {
    if (!stripeInstance || !stripeCardElement || !stripeClientSecret) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await stripeInstance.confirmCardPayment(stripeClientSecret, {
        payment_method: { card: stripeCardElement },
      });
      if (result.error) {
        setError(result.error.message ?? "Card payment failed.");
      } else {
        setStep("polling");
        startPolling(paymentId);
      }
    } catch (err: any) {
      setError(err?.message ?? "Card payment failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function startPolling(pmId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await paymentApi.get<any>(`/${pmId}/status`);
        const status = res.data?.data?.status as string | undefined;
        if (status === "captured") {
          clearInterval(pollRef.current!);
          router.push("/booking/success");
        } else if (status === "failed" || status === "timed_out") {
          clearInterval(pollRef.current!);
          setError("Payment failed. Please try again.");
          setStep("select");
        }
      } catch { /* ignore transient errors */ }
    }, 3000);
  }

  if (loading || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin h-8 w-8 border-4 border-[#0B1E3F] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3 shadow-sm">
        {step === "select" && (
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-base font-bold text-slate-900">
            {step === "polling" ? "Processing Payment…" : "Payment"}
          </h1>
          <p className="text-xs text-slate-400">Step 2 of 2 — {booking.reference}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Booking summary */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="font-bold text-slate-900">{booking.listing.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{booking.reference}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#0B1E3F]">{booking.currency} {Number(booking.totalAmount).toLocaleString()}</p>
            <p className="text-xs text-slate-400">{booking.nightsOrDays} {booking.listingType === "car" ? "day" : "night"}{booking.nightsOrDays !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Payment method selection */}
        {step === "select" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Method</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Card */}
              <button
                type="button"
                onClick={() => setPaymentProvider("stripe")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 border-2 rounded-xl transition font-semibold text-sm ${paymentProvider === "stripe" ? "border-[#0B1E3F] bg-[#0B1E3F]/5" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentProvider === "stripe" ? "bg-[#0B1E3F] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900">Credit / Debit Card</p>
                  <p className="text-xs text-slate-400 font-normal">Visa, Mastercard, Amex</p>
                </div>
                {paymentProvider === "stripe" && (
                  <svg className="w-5 h-5 ml-auto text-[#0B1E3F]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* M-Pesa */}
              <button
                type="button"
                onClick={() => setPaymentProvider("tara")}
                className={`w-full flex items-center gap-3 px-4 py-3.5 border-2 rounded-xl transition font-semibold text-sm ${paymentProvider === "tara" ? "border-[#0B1E3F] bg-[#0B1E3F]/5" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentProvider === "tara" ? "bg-[#0B1E3F] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900">M-Pesa / Mobile Money</p>
                  <p className="text-xs text-slate-400 font-normal">Tara mobile payments</p>
                </div>
                {paymentProvider === "tara" && (
                  <svg className="w-5 h-5 ml-auto text-[#0B1E3F]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* M-Pesa number input */}
              {paymentProvider === "tara" && (
                <input
                  type="tel"
                  placeholder="Mobile number e.g. +254712345678"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#0B1E3F]"
                />
              )}

              {paymentProvider === "stripe" && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  256-bit SSL encrypted · Powered by Stripe
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stripe card form */}
        {step === "stripe_card" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-700">Enter Card Details</p>
            <div ref={stripeCardRef} className="bg-white border border-slate-300 rounded-xl px-3 py-3 min-h-[44px]" />
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              256-bit SSL encrypted · Powered by Stripe
            </div>
          </div>
        )}

        {/* Polling / waiting */}
        {step === "polling" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-4">
            <div className="w-14 h-14 border-4 border-slate-200 border-t-[#0B1E3F] rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-bold text-slate-900">Processing your payment…</p>
              <p className="text-sm text-slate-400 mt-1">
                {paymentProvider === "tara" ? "Check your phone for the M-Pesa prompt" : "Please wait while we confirm your payment"}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-red-600">{error}</p>
          </div>
        )}

        {/* Action button */}
        {step !== "polling" && (
          <div className="pb-8">
            {step === "select" && (
              <button
                onClick={handlePay}
                disabled={submitting}
                className="w-full py-4 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 text-white font-bold rounded-2xl transition text-sm"
              >
                {submitting ? "Processing…" : `Pay ${booking.currency} ${Number(booking.totalAmount).toLocaleString()} Now`}
              </button>
            )}
            {step === "stripe_card" && (
              <div className="space-y-3">
                <button
                  onClick={handleStripeConfirm}
                  disabled={submitting || !stripeCardElement}
                  className="w-full py-4 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 text-white font-bold rounded-2xl transition text-sm"
                >
                  {submitting ? "Processing…" : `Confirm Payment`}
                </button>
                <button
                  onClick={() => { setStep("select"); setError(""); }}
                  className="w-full py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-2xl transition text-sm"
                >
                  Change Payment Method
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
