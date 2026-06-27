"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { paymentApi } from "@/lib/payment-api";
import { listingApi } from "@/lib/listing-api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckoutCtx {
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
  adults: number;
  children: number;
  lockToken: string;
  lockExpiresAt: string;
  voucherCode?: string;
  voucherDiscount?: number;
  promotionId?: string;
  discountSource?: "voucher" | "promotion";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialRequests?: string;
  driverFirstName?: string;
  driverLastName?: string;
  driverAge?: number;
  deliveryRequested?: boolean;
  deliveryAddress?: string;
}

interface ConfirmedBooking {
  reference: string;
  bookingId: string;
  totalAmount: number;
  currency: string;
  paymentId: string;
  paymentMethod: string;
  transactionId?: string;
  baseAmount: number;
  serviceFee: number;
  taxes: number;
  discount: number;
}

type PayStep = "review" | "payment" | "stripe_card" | "polling" | "confirmed";
type PayProvider = "stripe" | "tara";

// ─── Constants ────────────────────────────────────────────────────────────────

const AFRICAN_COUNTRIES = new Set([
  "Kenya", "Nigeria", "Ghana", "Tanzania", "Uganda", "South Africa", "Rwanda",
  "Ethiopia", "Zambia", "Zimbabwe", "Cameroon", "Ivory Coast", "Senegal",
  "Mali", "Burkina Faso", "Niger", "Chad", "Somalia", "Sudan", "Egypt",
  "Morocco", "Algeria", "Tunisia", "Libya", "Angola", "Mozambique",
  "Madagascar", "Malawi", "Botswana", "Namibia", "Lesotho", "Eswatini",
  "Mauritius", "Seychelles", "Burundi", "Djibouti", "Eritrea", "Gabon",
  "Guinea", "Liberia", "Sierra Leone", "Gambia", "Cape Verde",
]);

const TAX_RATES: Record<string, number> = {
  Kenya: 0.16, Nigeria: 0.075, Ghana: 0.125, Tanzania: 0.18,
  Uganda: 0.18, "South Africa": 0.15, Rwanda: 0.18, Ethiopia: 0.15,
  Zambia: 0.16, Zimbabwe: 0.15, Egypt: 0.14,
};

const CARD_LOGOS = ["Visa", "Mastercard", "Amex", "UnionPay", "Apple Pay", "Google Pay", "PayPal", "Bank Debit", "Klarna"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function calcPricing(ctx: CheckoutCtx) {
  const base = ctx.pricePerNight * ctx.nightsOrDays;
  const discount = ctx.voucherDiscount ?? 0;
  const subtotal = base - discount;
  const serviceFee = Math.round(subtotal * 0.05);
  const taxRate = TAX_RATES[ctx.listingCountry] ?? 0;
  const taxes = Math.round(subtotal * taxRate);
  const total = subtotal + serviceFee + taxes;
  return { base, discount, subtotal, serviceFee, taxes, total };
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function toIsoDatetime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  if (dateStr.includes("T")) return dateStr;
  return new Date(dateStr + "T00:00:00Z").toISOString();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingReviewPage() {
  const router = useRouter();

  // ── Context from sessionStorage ─────────────────────────────────────────────
  const [ctx, setCtx] = useState<CheckoutCtx | null>(null);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<PayStep>("review");
  const [provider, setProvider] = useState<PayProvider>("stripe");
  const [showExpiry, setShowExpiry] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);

  // ── Payment State ────────────────────────────────────────────────────────────
  const [mobileNumber, setMobileNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);

  // ── Stripe ──────────────────────────────────────────────────────────────────
  const [stripeInstance, setStripeInstance] = useState<any>(null);
  const [stripeCardElement, setStripeCardElement] = useState<any>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string>("");
  const stripeCardRef = useRef<HTMLDivElement>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived pricing ──────────────────────────────────────────────────────────
  const pricing = ctx ? calcPricing(ctx) : null;

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const raw = sessionStorage.getItem("zika:checkout");
    if (!raw) { router.replace("/traveller"); return; }
    try {
      const data: CheckoutCtx = JSON.parse(raw);
      setCtx(data);
      setProvider(AFRICAN_COUNTRIES.has(data.listingCountry) ? "tara" : "stripe");
      if ((data as any).mobileNumber) setMobileNumber((data as any).mobileNumber ?? "");

      // Resume timer from lockExpiresAt
      const expiresAt = new Date(data.lockExpiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    } catch {
      router.replace("/traveller");
    }
  }, []);

  // ─── Countdown ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      setShowExpiry(true);
      return;
    }
    timerRef.current = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [secondsLeft]);

  // ─── Stripe card element ──────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== "stripe_card" || !stripeInstance || !stripeCardRef.current) return;
    const elements = stripeInstance.elements();
    const card = elements.create("card", {
      style: { base: { fontSize: "15px", color: "#1e293b", fontFamily: "inherit", "::placeholder": { color: "#94a3b8" } } },
    });
    card.mount(stripeCardRef.current);
    setStripeCardElement(card);
    return () => { try { card.destroy(); } catch { } };
  }, [step, stripeInstance]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ─── Timer helpers ────────────────────────────────────────────────────────────

  const timerColor = () => {
    if (secondsLeft === null) return "text-slate-500";
    if (secondsLeft > 120) return "text-emerald-600";
    if (secondsLeft > 30) return "text-amber-500";
    return "text-red-600";
  };

  const timerBg = () => {
    if (secondsLeft === null) return "bg-slate-100 border-slate-200";
    if (secondsLeft > 120) return "bg-emerald-50 border-emerald-200";
    if (secondsLeft > 30) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  const timerMsg = () => {
    if (secondsLeft === null || secondsLeft <= 0) return "";
    const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    if (secondsLeft > 120) return `Booking held — complete payment`;
    if (secondsLeft > 30) return `Hurry — only ${mm}:${ss} remaining!`;
    return `Less than 30 seconds — pay now!`;
  };

  const timerDisplay = () => {
    if (secondsLeft === null) return "—:——";
    const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // ─── Actions ──────────────────────────────────────────────────────────────────

  function startPolling(pmId: string, ref: string, total: number, base: number, fee: number, tax: number, disc: number, method: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await paymentApi.get(`/payments/${pmId}/status`);
        const status = res.data?.data?.status as string | undefined;
        if (status === "captured") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          const txId = res.data?.data?.transactionId ?? res.data?.data?.transaction_id ?? pmId;
          setConfirmed({
            reference: ref, bookingId, totalAmount: total, currency: ctx!.currency,
            paymentId: pmId, paymentMethod: method, transactionId: txId,
            baseAmount: base, serviceFee: fee, taxes: tax, discount: disc,
          });
          sessionStorage.removeItem("zika:checkout");
          setStep("confirmed");
        } else if (status === "failed" || status === "timed_out") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setPayError("Payment failed. Please try again.");
          setStep("payment");
        }
      } catch { }
    }, 3000);
  }

  async function handlePay() {
    if (!ctx || !pricing) return;
    setSubmitting(true);
    setPayError("");

    try {
      // Step 1: Create booking
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
        body.pickupDatetime = toIsoDatetime(ctx.pickupDatetime);
        body.returnDatetime = toIsoDatetime(ctx.returnDatetime);
        body.driverFirstName = ctx.driverFirstName ?? ctx.firstName;
        body.driverLastName = ctx.driverLastName ?? ctx.lastName;
        body.driverAge = ctx.driverAge;
        body.deliveryRequested = ctx.deliveryRequested;
        body.deliveryAddress = ctx.deliveryAddress;
      }
      if (ctx.discountSource === "voucher" && ctx.voucherCode) body.voucherCode = ctx.voucherCode;
      if (ctx.discountSource === "promotion" && ctx.promotionId) body.promotionId = ctx.promotionId;

      const bookRes = await listingApi.post<any>("/bookings", body);
      if (!bookRes.data.success || !bookRes.data.data?.bookingId) {
        setPayError(bookRes.data?.error?.message ?? "Booking failed. Please try again.");
        return;
      }
      const bId = bookRes.data.data.bookingId as string;
      const bRef = bookRes.data.data.bookingReference as string;
      const total = Number(bookRes.data.data.totalAmount) || pricing.total;
      setBookingId(bId);
      setBookingRef(bRef);

      // Step 2: Initiate payment
      let pmId: string;
      if (provider === "stripe") {
        const intentRes = await paymentApi.post<any>("/payments/create-intent", { bookingId: bId });
        if (!intentRes.data.success) {
          setPayError(intentRes.data?.error?.message ?? "Payment initiation failed.");
          return;
        }
        pmId = intentRes.data.data.paymentId as string;
        const clientSecret = intentRes.data.data.clientSecret as string;
        const publishableKey =
          (intentRes.data.data.publishableKey as string) ||
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
        setPaymentId(pmId);
        setStripeClientSecret(clientSecret);
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(publishableKey);
        setStripeInstance(stripe);
        setStep("stripe_card");
      } else {
        // Tara M-Pesa
        if (!mobileNumber.trim()) { setPayError("Please enter your mobile number."); return; }
        const payRes = await paymentApi.post<any>("/payments/initiate", {
          bookingId: bId,
          paymentProvider: "tara",
          mobileNumber: mobileNumber.trim(),
        });
        if (!payRes.data.success) {
          setPayError(payRes.data?.error?.message ?? "Payment initiation failed.");
          return;
        }
        pmId = payRes.data.data.paymentId as string;
        setPaymentId(pmId);
        setStep("polling");
        startPolling(pmId, bRef, total, pricing.base, pricing.serviceFee, pricing.taxes, pricing.discount, "Mobile Money");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? "Something went wrong.";
      setPayError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStripeConfirm() {
    if (!stripeInstance || !stripeCardElement || !stripeClientSecret || !pricing) return;
    setSubmitting(true);
    setPayError("");
    try {
      const result = await stripeInstance.confirmCardPayment(stripeClientSecret, {
        payment_method: { card: stripeCardElement },
      });
      if (result.error) {
        setPayError(result.error.message ?? "Card payment failed. Please check your details.");
      } else {
        setStep("polling");
        if (paymentId) startPolling(paymentId, bookingRef, pricing.total, pricing.base, pricing.serviceFee, pricing.taxes, pricing.discount, "Card");
      }
    } catch (err: any) {
      setPayError(err?.message ?? "Card payment failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelBooking() {
    // Abandon lock if possible
    if (ctx?.lockToken) {
      try { await listingApi.delete(`/bookings/lock/${ctx.lockToken}`); } catch { }
    }
    sessionStorage.removeItem("zika:checkout");
    if (pollRef.current) clearInterval(pollRef.current);
    setShowCancelConfirm(false);
    router.push("/traveller");
  }

  function handleDownloadPDF() {
    setShowVoucher(true);
    setTimeout(() => window.print(), 300);
  }

  // ─── Loading ──────────────────────────────────────────────────────────────────

  if (!ctx || secondsLeft === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin h-10 w-10 border-4 border-[#0B1E3F] border-t-transparent rounded-full" />
      </div>
    );
  }

  const isCar = ctx.listingCategory === "car";
  const isAfrican = AFRICAN_COUNTRIES.has(ctx.listingCountry);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print-only voucher overlay */}
      {showVoucher && confirmed && (
        <div className="print-only fixed inset-0 z-[9999] bg-white p-8 overflow-auto" id="voucher-print">
          <VoucherLayout confirmed={confirmed} ctx={ctx} pricing={pricing!} />
        </div>
      )}

      <div className="min-h-screen bg-[#F8FAFC] print:hidden">

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <Link href="/traveller" className="flex items-center">
            <img src="/images/kainook-logo.jpeg" alt="Kainook" className="h-9 w-auto object-contain" />
          </Link>

          {/* Timer */}
          {step !== "confirmed" && (
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-semibold font-mono ${timerBg()}`}>
              <svg className={`w-4 h-4 animate-pulse ${timerColor()}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={timerColor()}>{timerDisplay()}</span>
              <span className={`hidden sm:inline text-xs font-medium ${timerColor()}`}>{timerMsg()}</span>
            </div>
          )}

          {step !== "confirmed" && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-xs text-slate-500 hover:text-red-600 transition font-medium px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              Cancel booking
            </button>
          )}
        </header>

        {/* ── Timer Banner (mobile friendly, below header) ── */}
        {step !== "confirmed" && (
          <div className={`sm:hidden px-4 py-2.5 flex items-center gap-2 text-xs font-medium border-b ${timerBg()} ${timerColor()}`}>
            <svg className="w-3.5 h-3.5 animate-pulse shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{timerMsg()}</span>
          </div>
        )}

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* ── CONFIRMED ── */}
          {step === "confirmed" && confirmed && (
            <ConfirmedView
              confirmed={confirmed}
              ctx={ctx}
              pricing={pricing!}
              onDownload={handleDownloadPDF}
              onViewBookings={() => router.push("/traveller?tab=bookings")}
            />
          )}

          {/* ── POLLING ── */}
          {step === "polling" && (
            <div className="max-w-md mx-auto text-center py-20 space-y-6">
              <div className="w-20 h-20 mx-auto relative">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#0B1E3F] animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  {provider === "tara" ? "Payment Request Sent" : "Processing Payment"}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {provider === "tara"
                    ? "A payment request has been sent to your phone. Please approve it to complete your booking."
                    : "Please wait while we confirm your payment."}
                </p>
                <p className="text-slate-400 text-xs mt-3 animate-pulse">Waiting for payment confirmation…</p>
              </div>
            </div>
          )}

          {/* ── STRIPE CARD ── */}
          {step === "stripe_card" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
              <div className="space-y-6">
                <SectionCard title="Secure Payment" icon="🔒">
                  <p className="text-sm text-slate-500 mb-5 flex items-center gap-1.5">
                    <span className="text-emerald-500">✓</span> Your payment is processed securely.
                  </p>
                  {/* Card logos */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {CARD_LOGOS.map((c) => (
                      <span key={c} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-semibold text-slate-500 border border-slate-200">{c}</span>
                    ))}
                  </div>
                  <div ref={stripeCardRef} className="border border-slate-200 rounded-xl p-4 bg-white min-h-[44px]" />
                  {payError && <p className="text-red-600 text-sm mt-3">{payError}</p>}
                  <button
                    onClick={handleStripeConfirm}
                    disabled={submitting}
                    className="mt-5 w-full py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 text-white font-bold rounded-xl transition text-sm"
                  >
                    {submitting ? "Processing…" : `Pay ${ctx.currency} ${fmt(pricing!.total)}`}
                  </button>
                </SectionCard>
              </div>
              <PriceSummary ctx={ctx} pricing={pricing!} />
            </div>
          )}

          {/* ── REVIEW & PAYMENT SELECTION ── */}
          {(step === "review" || step === "payment") && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">

              {/* Left column */}
              <div className="space-y-6">

                {/* Step indicator */}
                <div className="flex items-center gap-0">
                  {[{ k: "review", n: 1, l: "Review" }, { k: "payment", n: 2, l: "Payment" }].map((s, i) => (
                    <div key={s.k} className="flex items-center">
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${step === s.k ? "text-[#0B1E3F]" : s.n < (step === "payment" ? 2 : 1) ? "text-emerald-600" : "text-slate-400"}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.k ? "bg-[#0B1E3F] text-white" : s.n < (step === "payment" ? 2 : 1) ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                          {s.n < (step === "payment" ? 2 : 1) ? "✓" : s.n}
                        </span>
                        {s.l}
                      </div>
                      {i < 1 && <div className="w-12 h-px bg-slate-200 mx-2" />}
                    </div>
                  ))}
                </div>

                {/* ── REVIEW step ── */}
                {step === "review" && (
                  <>
                    {/* Listing card */}
                    <SectionCard title="Your Booking">
                      <div className="flex gap-4">
                        {ctx.listingPhoto ? (
                          <img src={ctx.listingPhoto} alt="" className="w-24 h-20 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="w-24 h-20 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                            <span className="text-slate-400 text-2xl">{isCar ? "🚗" : "🏨"}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{ctx.listingCategory}</p>
                          <h3 className="font-bold text-slate-800 text-base leading-snug">{ctx.listingTitle}</h3>
                          <p className="text-sm text-slate-500 mt-0.5">{ctx.listingTown}, {ctx.listingCountry}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        {!isCar ? (
                          <>
                            <InfoRow label="Check-in" value={fmtDate(ctx.checkIn)} />
                            <InfoRow label="Check-out" value={fmtDate(ctx.checkOut)} />
                          </>
                        ) : (
                          <>
                            <InfoRow label="Pick-up" value={fmtDate(ctx.pickupDatetime)} />
                            <InfoRow label="Return" value={fmtDate(ctx.returnDatetime)} />
                          </>
                        )}
                        <InfoRow label="Duration" value={`${ctx.nightsOrDays} ${isCar ? "day" : "night"}${ctx.nightsOrDays !== 1 ? "s" : ""}`} />
                        <InfoRow label="Guests" value={`${ctx.adults} adult${ctx.adults !== 1 ? "s" : ""}${ctx.children > 0 ? `, ${ctx.children} child${ctx.children !== 1 ? "ren" : ""}` : ""}`} />
                      </div>
                    </SectionCard>

                    {/* Guest details */}
                    <SectionCard title="Guest Details">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <InfoRow label="Name" value={`${ctx.firstName} ${ctx.lastName}`} />
                        <InfoRow label="Email" value={ctx.email} />
                        <InfoRow label="Phone" value={ctx.phone || "—"} />
                        {ctx.specialRequests && <InfoRow label="Special requests" value={ctx.specialRequests} />}
                      </div>
                    </SectionCard>

                    <button
                      onClick={() => setStep("payment")}
                      className="w-full py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] text-white font-bold rounded-xl transition text-sm"
                    >
                      Continue to Payment
                    </button>
                  </>
                )}

                {/* ── PAYMENT step ── */}
                {step === "payment" && (
                  <>
                    {/* Payment method selector */}
                    <SectionCard title="Payment Method">
                      <div className="grid grid-cols-2 gap-3">
                        {(isAfrican ? (["tara", "stripe"] as PayProvider[]) : (["stripe", "tara"] as PayProvider[])).map((p) => (
                          <button
                            key={p}
                            onClick={() => setProvider(p)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition text-sm font-semibold ${provider === p ? "border-[#0B1E3F] bg-[#0B1E3F]/5 text-[#0B1E3F]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                          >
                            <span className="text-2xl">{p === "tara" ? "📱" : "💳"}</span>
                            <span>{p === "tara" ? "Mobile Money" : "Card & Digital Wallets"}</span>
                            {isAfrican && p === "tara" && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Recommended</span>}
                            {!isAfrican && p === "stripe" && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Recommended</span>}
                          </button>
                        ))}
                      </div>
                    </SectionCard>

                    {/* Mobile Money form */}
                    {provider === "tara" && (
                      <SectionCard title="Mobile Money" icon="📱">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
                        <input
                          type="tel"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder="+254 700 000 000"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E3F]/20 focus:border-[#0B1E3F]"
                        />
                        <p className="text-xs text-slate-400 mt-2">You will receive a payment prompt on this number.</p>
                      </SectionCard>
                    )}

                    {/* Card & Digital Wallets info */}
                    {provider === "stripe" && (
                      <SectionCard title="Card & Digital Wallets" icon="🔒">
                        <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5">
                          <span className="text-emerald-500">✓</span> Your payment is processed securely.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {CARD_LOGOS.map((c) => (
                            <span key={c} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-semibold text-slate-500 border border-slate-200">{c}</span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-3">You will be prompted to enter your card details on the next step.</p>
                      </SectionCard>
                    )}

                    {payError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{payError}</div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => { setStep("review"); setPayError(""); }}
                        className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handlePay}
                        disabled={submitting}
                        className="flex-[2] py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 text-white font-bold rounded-xl transition text-sm"
                      >
                        {submitting ? "Please wait…" : provider === "tara" ? "Send Payment Request" : "Pay Now"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Right column — price summary */}
              <PriceSummary ctx={ctx} pricing={pricing!} />
            </div>
          )}
        </main>
      </div>

      {/* ── Expiry Modal ── */}
      {showExpiry && (
        <Modal>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">⏰</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Reservation Expired</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Your reservation hold has expired and is no longer available.</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { sessionStorage.removeItem("zika:checkout"); router.push("/traveller"); }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
              >
                Search again
              </button>
              <button
                onClick={() => { sessionStorage.removeItem("zika:checkout"); router.push(`/traveller?listing=${ctx.listingId}`); }}
                className="flex-1 py-2.5 bg-[#0B1E3F] text-white font-bold rounded-xl hover:bg-[#07152B] transition text-sm"
              >
                Try to rebook
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Cancel Confirmation ── */}
      {showCancelConfirm && (
        <Modal>
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Cancel your booking?</h2>
            <p className="text-slate-500 text-sm">Are you sure you want to cancel this booking?</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
              >
                Keep booking
              </button>
              <button
                onClick={handleCancelBooking}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition text-sm"
              >
                Cancel booking
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          #voucher-print { display: block !important; position: static !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-700 break-all">{value}</p>
    </div>
  );
}

function PriceSummary({ ctx, pricing }: { ctx: CheckoutCtx; pricing: ReturnType<typeof calcPricing> }) {
  const isCar = ctx.listingCategory === "car";
  return (
    <div className="lg:sticky lg:top-20 self-start">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800">Price Breakdown</h3>

        {/* Listing mini card */}
        <div className="flex gap-3 pb-4 border-b border-slate-100">
          {ctx.listingPhoto ? (
            <img src={ctx.listingPhoto} alt="" className="w-16 h-14 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-xl">
              {isCar ? "🚗" : "🏨"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{ctx.listingCategory}</p>
            <p className="text-sm font-bold text-slate-800 truncate">{ctx.listingTitle}</p>
            <p className="text-xs text-slate-500">{ctx.listingTown}</p>
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>{ctx.currency} {fmt(ctx.pricePerNight)} × {ctx.nightsOrDays} {isCar ? "day" : "night"}{ctx.nightsOrDays !== 1 ? "s" : ""}</span>
            <span>{fmt(pricing.base)}</span>
          </div>
          {pricing.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>{ctx.discountSource === "promotion" ? "Promotion discount" : "Voucher discount"}</span>
              <span>−{fmt(pricing.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-2">
            <span>Subtotal</span>
            <span>{fmt(pricing.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Service fee (5%)</span>
            <span>{fmt(pricing.serviceFee)}</span>
          </div>
          {pricing.taxes > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Taxes</span>
              <span>{fmt(pricing.taxes)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-3 text-base">
            <span>Total</span>
            <span>{ctx.currency} {fmt(pricing.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmed View ───────────────────────────────────────────────────────────

function ConfirmedView({
  confirmed, ctx, pricing, onDownload, onViewBookings,
}: {
  confirmed: ConfirmedBooking;
  ctx: CheckoutCtx;
  pricing: ReturnType<typeof calcPricing>;
  onDownload: () => void;
  onViewBookings: () => void;
}) {
  const isCar = ctx.listingCategory === "car";
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Success header */}
      <div className="text-center py-8 space-y-3">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full tracking-widest uppercase">CONFIRMED</span>
        <h1 className="text-3xl font-bold text-slate-800">Booking Confirmed</h1>
        <div className="inline-block bg-[#0B1E3F] text-white font-mono font-bold text-lg px-5 py-2 rounded-xl tracking-wider shadow-lg">
          {confirmed.reference}
        </div>
        <p className="text-slate-500 text-sm">A confirmation email with your PDF voucher has been sent to <strong>{ctx.email}</strong>.</p>
      </div>

      {/* Booking info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800">Booking Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Booking Reference" value={confirmed.reference} />
          <InfoRow label="Traveller Name" value={`${ctx.firstName} ${ctx.lastName}`} />
          <InfoRow label={isCar ? "Vehicle" : "Property"} value={ctx.listingTitle} />
          {!isCar ? (
            <>
              <InfoRow label="Check-in" value={fmtDate(ctx.checkIn)} />
              <InfoRow label="Check-out" value={fmtDate(ctx.checkOut)} />
            </>
          ) : (
            <>
              <InfoRow label="Pick-up" value={fmtDate(ctx.pickupDatetime)} />
              <InfoRow label="Return" value={fmtDate(ctx.returnDatetime)} />
            </>
          )}
          <InfoRow label="Guests" value={`${ctx.adults} adult${ctx.adults !== 1 ? "s" : ""}${ctx.children > 0 ? `, ${ctx.children} child${ctx.children !== 1 ? "ren" : ""}` : ""}`} />
        </div>
      </div>

      {/* Receipt */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-800">Receipt</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Base amount</span>
            <span>{confirmed.currency} {fmt(confirmed.baseAmount)}</span>
          </div>
          {confirmed.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>{ctx.discountSource === "promotion" ? "Promotion discount" : "Voucher discount"}</span>
              <span>−{fmt(confirmed.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Service fee</span>
            <span>{confirmed.currency} {fmt(confirmed.serviceFee)}</span>
          </div>
          {confirmed.taxes > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Taxes</span>
              <span>{confirmed.currency} {fmt(confirmed.taxes)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-3 text-base">
            <span>Total Paid</span>
            <span>{confirmed.currency} {fmt(confirmed.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Payment Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Payment Method" value={confirmed.paymentMethod} />
          <InfoRow label="Transaction ID" value={confirmed.transactionId ?? confirmed.paymentId} />
        </div>
      </div>

      {/* Cancellation policy */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-amber-800 mb-2 text-sm">Cancellation Policy</h3>
        <p className="text-amber-700 text-sm leading-relaxed">
          Free cancellation up to 48 hours before check-in. Cancellations made after that may be subject to a fee. Please review the full cancellation policy in your booking details.
        </p>
      </div>

      {/* Email confirmation notice */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-emerald-500 text-lg mt-0.5">✉</span>
        <div>
          <p className="text-emerald-800 font-semibold text-sm">Confirmation email sent</p>
          <p className="text-emerald-700 text-xs mt-0.5">
            Your booking is confirmed — {confirmed.reference}. Booking details, receipt, and your PDF voucher have been sent to {ctx.email}.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <button
          onClick={onDownload}
          className="flex-1 py-3.5 border-2 border-[#166534] text-[#166534] font-bold rounded-xl hover:bg-[#166534]/5 transition text-sm flex items-center justify-center gap-2"
        >
          <span>⬇</span> Download Voucher PDF
        </button>
        <button
          onClick={onViewBookings}
          className="flex-1 py-3.5 bg-[#166534] text-white font-bold rounded-xl hover:bg-[#14532d] transition text-sm"
        >
          View My Reservations
        </button>
      </div>
    </div>
  );
}

// ─── Voucher (print layout) ───────────────────────────────────────────────────

function VoucherLayout({
  confirmed, ctx, pricing,
}: {
  confirmed: ConfirmedBooking;
  ctx: CheckoutCtx;
  pricing: ReturnType<typeof calcPricing>;
}) {
  const isCar = ctx.listingCategory === "car";
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 680, margin: "0 auto", color: "#1e293b" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #0B1E3F", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0B1E3F" }}>Kainook</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Booking Reference</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "#0B1E3F" }}>{confirmed.reference}</div>
          <div style={{ fontSize: 10, background: "#dcfce7", color: "#166534", padding: "2px 10px", borderRadius: 20, display: "inline-block", marginTop: 4, fontWeight: 700, letterSpacing: "0.1em" }}>CONFIRMED</div>
        </div>
      </div>

      {/* Guest Details */}
      <VoucherSection title="Guest Details">
        <VoucherRow label="Name" value={`${ctx.firstName} ${ctx.lastName}`} />
        <VoucherRow label="Email" value={ctx.email} />
        <VoucherRow label="Phone" value={ctx.phone || "—"} />
      </VoucherSection>

      {/* Booking Details */}
      <VoucherSection title="Booking Details">
        <VoucherRow label={isCar ? "Vehicle" : "Property"} value={ctx.listingTitle} />
        <VoucherRow label="Location" value={`${ctx.listingTown}, ${ctx.listingCountry}`} />
        {!isCar ? (
          <>
            <VoucherRow label="Check-in" value={fmtDate(ctx.checkIn)} />
            <VoucherRow label="Check-out" value={fmtDate(ctx.checkOut)} />
          </>
        ) : (
          <>
            <VoucherRow label="Pick-up" value={fmtDate(ctx.pickupDatetime)} />
            <VoucherRow label="Return" value={fmtDate(ctx.returnDatetime)} />
          </>
        )}
        <VoucherRow label="Duration" value={`${ctx.nightsOrDays} ${isCar ? "day" : "night"}${ctx.nightsOrDays !== 1 ? "s" : ""}`} />
        <VoucherRow label="Guests" value={`${ctx.adults} adult${ctx.adults !== 1 ? "s" : ""}${ctx.children > 0 ? `, ${ctx.children} child` : ""}`} />
      </VoucherSection>

      {/* Receipt */}
      <VoucherSection title="Itemised Receipt">
        <VoucherRow label="Base amount" value={`${confirmed.currency} ${fmt(confirmed.baseAmount)}`} />
        {confirmed.discount > 0 && <VoucherRow label="Discount" value={`−${fmt(confirmed.discount)}`} />}
        <VoucherRow label="Service fee (5%)" value={`${confirmed.currency} ${fmt(confirmed.serviceFee)}`} />
        {confirmed.taxes > 0 && <VoucherRow label="Taxes" value={`${confirmed.currency} ${fmt(confirmed.taxes)}`} />}
        <VoucherRow label="Total Paid" value={`${confirmed.currency} ${fmt(confirmed.totalAmount)}`} bold />
      </VoucherSection>

      {/* Payment Info */}
      <VoucherSection title="Payment Information">
        <VoucherRow label="Payment Method" value={confirmed.paymentMethod} />
        <VoucherRow label="Transaction ID" value={confirmed.transactionId ?? confirmed.paymentId} />
      </VoucherSection>

      {/* Cancellation Policy */}
      <VoucherSection title="Cancellation Policy">
        <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
          Free cancellation up to 48 hours before check-in. Cancellations made after that may be subject to a fee.
        </p>
      </VoucherSection>

      {/* QR placeholder */}
      <div style={{ textAlign: "center", padding: "24px 0", borderTop: "1px dashed #cbd5e1" }}>
        <div style={{ width: 80, height: 80, border: "2px solid #0B1E3F", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 24 }}>▦</div>
          <div style={{ fontSize: 8, color: "#64748b" }}>QR Code</div>
        </div>
        <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>Scan to verify booking</p>
      </div>

      <div style={{ textAlign: "center", paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#94a3b8" }}>
        Kainook — kainook.com · This voucher serves as proof of your confirmed booking.
      </div>
    </div>
  );
}

function VoucherSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#0B1E3F", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function VoucherRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: bold ? "#0B1E3F" : "#1e293b" }}>{value}</span>
    </div>
  );
}
