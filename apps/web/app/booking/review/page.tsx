"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parsePhoneNumber } from "libphonenumber-js";
import { isTaraCountry } from "@zika/types";
import { paymentApi } from "@/lib/payment-api";
import { listingApi } from "@/lib/listing-api";
import { api } from "@/lib/api";
import { storeLatestReviewContext } from "@/services/traveller";
import { useAuthStore } from "@/stores/auth";
import { capitalize } from "@/lib/utils";
import { derivePlatform, fmtMoney } from "@/lib/platform-currency";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PricingPreview {
  units: number;
  baseAmount: number;
  nightlyRate: number;
  promotionDiscount: number;
  voucherDiscount: number;
  serviceFee: number;
  taxAmount: number;
  deliveryFee: number;
  securityDeposit?: number;
  totalAmount: number;
  commissionRate?: number;
  taxRate?: number;
  /** Platform (charge) currency — EUR for Stripe, XAF for Tara. */
  platformCurrency?: string;
  /** Amount actually charged in the platform currency (EUR includes the buffer). */
  platformAmount?: number;
  /** Exchange rate listingCurrency → platformCurrency at lock time. */
  platformRate?: number;
}

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
  roomTypeId?: string;
  roomTypeName?: string;
  roomType?: string;
  pricingPreview?: PricingPreview;
  /** Listing's country commission rate as a decimal fraction (0.05 = 5%).
   *  Only used if pricingPreview is absent. */
  commissionRate?: number;
}

interface WalletVoucher {
  id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
}

interface ConfirmedBooking {
  reference: string;
  bookingId: string;
  totalAmount: number;
  currency: string;
  paymentId: string;
  displayId?: string;
  paymentMethod: string;
  transactionId?: string;
  baseAmount: number;
  serviceFee: number;
  taxes: number;
  discount: number;
  securityDeposit?: number;
  deliveryFee?: number;
  commissionRate?: number;
  taxRate?: number;
}

type PayStep = "review" | "payment" | "stripe_card" | "polling" | "confirmed";
type PayProvider = "stripe" | "tara";

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_LOGOS = ["Visa", "Mastercard", "Amex", "UnionPay", "Apple Pay", "Google Pay", "PayPal", "Bank Debit", "Klarna"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (typeof n !== "number" || isNaN(n)) return "0";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPricing(ctx: CheckoutCtx) {
  if (!ctx.pricingPreview) return null;
  const pp = ctx.pricingPreview;
  const base = pp.baseAmount ?? 0;
  const serviceFee = pp.serviceFee ?? 0;
  const taxAmount = pp.taxAmount ?? 0;
  const deliveryFee = pp.deliveryFee ?? 0;
  const securityDeposit = pp.securityDeposit ?? 0;
  const totalDiscount = ctx.discountSource === "voucher"
    ? (ctx.voucherDiscount ?? 0)
    : (pp.promotionDiscount ?? 0);
  const subtotal = Math.max(0, base - totalDiscount);
  const total = subtotal + serviceFee + taxAmount + deliveryFee + securityDeposit;
  // The end amount the guest pays is the platform-currency total (EUR for
  // Stripe, XAF for Tara) returned by the booking API. Breakdown lines stay in
  // the listing currency; only this converted total is shown in the platform
  // currency. Fall back to the listing total for older checkout sessions.
  const info = derivePlatform(pp, ctx.currency, total);
  return {
    base, discount: totalDiscount, subtotal, serviceFee, taxes: taxAmount,
    deliveryFee, securityDeposit, total,
    platformCurrency: info.platformCurrency,
    platformAmount: info.platformAmount,
    platformRate: info.platformRate,
    listingCurrency: ctx.currency,
  };
}

/** Platform amount as primary value with the listing amount muted underneath. */
function MoneyValue({ platform, listing, currency, listingCurrency }: { platform: number; listing: number; currency: string; listingCurrency: string }) {
  return (
    <span className="text-right">
      <div>{fmtMoney(platform, currency)}</div>
      {currency !== listingCurrency && (
        <div className="text-[10px] font-normal text-slate-400">Billed as approx. {fmtMoney(listing, listingCurrency)}</div>
      )}
    </span>
  );
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

function toActivity(category: string): string {
  const map: Record<string, string> = { hotel: "hotels", apartment: "apartments", car: "cars" };
  return map[category] ?? category;
}

export default function BookingReviewPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  // Acceptance is recorded against the account on the first booking, so the
  // gate is only shown to guests who have not yet accepted. Defaults to true
  // when the flag is absent (e.g. a session persisted before the field
  // existed), which fails safe by asking rather than silently skipping.
  const needsTermsAcceptance = user?.requiresTermsAcceptance ?? true;

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

  // ── Voucher State ────────────────────────────────────────────────────────────
  const [reviewVoucherCode, setReviewVoucherCode] = useState("");
  const [reviewVoucherError, setReviewVoucherError] = useState("");
  const [reviewVoucherApplying, setReviewVoucherApplying] = useState(false);
  const [walletVouchers, setWalletVouchers] = useState<WalletVoucher[]>([]);
  const [loadingWalletVouchers, setLoadingWalletVouchers] = useState(false);

  // ── Payment State ────────────────────────────────────────────────────────────
  const [mobileNumber, setMobileNumber] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("");
  const [taraXafAmount, setTaraXafAmount] = useState<number | null>(null);
  const [taraXafLoading, setTaraXafLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  // Gates the Pay button (Todo#2 row 7). Account-level acceptance is recorded
  // separately at sign-up / via the consent screen; this is the per-transaction
  // confirmation the client asked for.
  const [payTermsAccepted, setPayTermsAccepted] = useState(false);

  // ── Stripe ──────────────────────────────────────────────────────────────────
  const [stripeInstance, setStripeInstance] = useState<any>(null);
  const [stripeCardElement, setStripeCardElement] = useState<any>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string>("");
  const stripeCardRef = useRef<HTMLDivElement>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Abandoned-payment cancel ───────────────────────────────────────────────
  // When the guest leaves the page mid-checkout, tell the payment service to
  // cancel the open Stripe PaymentIntent (idempotent, best-effort).
  const paymentResolvedRef = useRef(false);
  const lastCancelledPaymentIdRef = useRef<string | null>(null);

  function firePaymentCancel(paymentId: string | null) {
    if (!paymentId || provider !== "stripe" || paymentResolvedRef.current) return;
    if (lastCancelledPaymentIdRef.current === paymentId) return;
    lastCancelledPaymentIdRef.current = paymentId;

    const baseUrl = paymentApi.defaults.baseURL ?? "";
    const token =
      sessionStorage.getItem("zika:access_token") ??
      localStorage.getItem("zika:access_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      fetch(`${baseUrl}/payments/${paymentId}/cancel`, {
        method: "POST",
        keepalive: true,
        headers,
      }).catch(() => { });
    } catch { /* best-effort */ }
  }

  useEffect(() => {
    const onPageHide = () => firePaymentCancel(paymentId);
    const onBeforeUnload = () => firePaymentCancel(paymentId);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [paymentId, provider]);

  // ── Derived pricing ──────────────────────────────────────────────────────────
  const pricing = ctx ? getPricing(ctx) : null;

  // Fetch the XAF amount the guest will pay when Tara is selected and the
  // booking is not already in XAF (Tara only charges in XAF).
  useEffect(() => {
    if (provider !== "tara" || !ctx || !pricing) {
      setTaraXafAmount(null);
      setTaraXafLoading(false);
      return;
    }
    if ((ctx.currency ?? "").toUpperCase() === "XAF") {
      setTaraXafAmount(null);
      setTaraXafLoading(false);
      return;
    }
    let cancelled = false;
    setTaraXafLoading(true);
    listingApi
      .get<any>("/fx/convert", {
        params: { amount: pricing.total, from: ctx.currency, to: "XAF" },
      })
      .then((res) => {
        if (!cancelled && res.data?.success && res.data.data?.converted != null) {
          setTaraXafAmount(Number(res.data.data.converted));
        }
      })
      .catch(() => {
        if (!cancelled) setTaraXafAmount(null);
      })
      .finally(() => {
        if (!cancelled) setTaraXafLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, ctx, pricing?.total]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const raw = sessionStorage.getItem("zika:checkout");
    if (!raw) { router.replace("/"); return; }
    try {
      const data: CheckoutCtx = JSON.parse(raw);
      setCtx(data);
      if (data.voucherCode) setReviewVoucherCode(data.voucherCode);
      if ((data as any).mobileNumber) setMobileNumber((data as any).mobileNumber ?? "");
      if (data.phone) {
        try {
          const parsed = parsePhoneNumber(data.phone);
          if (parsed?.country) {
            setPhoneCountry(parsed.country);
            setProvider(isTaraCountry(data.listingCountry) ? "tara" : "stripe");
          } else {
            setProvider("stripe");
          }
        } catch {
          setProvider("stripe");
        }
      } else {
        setProvider("stripe");
      }

      // Resume timer from lockExpiresAt
      const expiresAt = new Date(data.lockExpiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      // Fetch wallet vouchers for the dropdown
      setLoadingWalletVouchers(true);
      listingApi.get<any>("/vouchers/wallet")
        .then((res) => { if (res.data.success) setWalletVouchers(res.data.data ?? []); })
        .catch(() => { })
        .finally(() => setLoadingWalletVouchers(false));
    } catch {
      router.replace("/");
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

  function startPolling(
    pmId: string,
    ref: string,
    reviewBookingId: string,
    total: number,
    base: number,
    fee: number,
    tax: number,
    disc: number,
    method: string,
    securityDeposit?: number,
    deliveryFee?: number,
    commissionRate?: number,
    taxRate?: number,
  ) {
    if (pollRef.current) clearInterval(pollRef.current);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 120_000) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setPayError("Payment took too long. Please try again.");
        setStep("payment");
        return;
      }
      try {
        const res = await paymentApi.get(`/payments/${pmId}/status`);
        const status = res.data?.data?.status as string | undefined;
        if (status === "captured") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          paymentResolvedRef.current = true;
          const txId = res.data?.data?.transactionId ?? res.data?.data?.transaction_id ?? pmId;
          const displayId = res.data?.data?.displayId as string | undefined;
          storeLatestReviewContext({
            bookingId: reviewBookingId,
            listingId: ctx!.listingId,
            listingName: ctx!.listingTitle,
            completedAt: new Date().toISOString(),
          });
          setConfirmed({
            reference: ref,
            bookingId: reviewBookingId,
            totalAmount: total,
            currency: ctx!.currency,
            paymentId: pmId, displayId, paymentMethod: method, transactionId: txId,
            baseAmount: base, serviceFee: fee, taxes: tax, discount: disc,
            securityDeposit,
            deliveryFee,
            commissionRate, taxRate,
          });
          sessionStorage.removeItem("zika:checkout");
          setStep("confirmed");
        } else if (status === "failed" || status === "timed_out") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          paymentResolvedRef.current = true;
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

    // Record the acceptance the guest just gave, once. Best-effort: a failure
    // must not cost them their reservation lock, so it is logged and the
    // payment proceeds — the checkbox itself is still an enforced gate.
    // Anonymous guests have no account to record acceptance against, so the
    // call is skipped (the backend would reject it with ACCOUNT_REQUIRED).
    if (needsTermsAcceptance && user) {
      void api
        .post("/auth/accept-terms", { acceptedTerms: true })
        .then(() => updateUser({ requiresTermsAcceptance: false }))
        .catch((err) => console.error("[checkout] Failed to record terms acceptance:", err));
    }

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
      if (ctx.listingCategory === "hotel") {
        body.roomTypeId = ctx.roomTypeId;
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
        let phoneCountry = "";
        try {
          phoneCountry = parsePhoneNumber(mobileNumber.trim())?.country ?? "";
        } catch { /* handled below */ }
        if (!phoneCountry || !isTaraCountry(phoneCountry)) {
          setPayError("Mobile money is only available for supported African countries. Please use card payment instead.");
          return;
        }
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
        startPolling(pmId, bRef, bId, total, pricing.base, pricing.serviceFee, pricing.taxes, pricing.discount, "Mobile Money", ctx.pricingPreview?.securityDeposit, ctx.pricingPreview?.deliveryFee, ctx.pricingPreview?.commissionRate, ctx.pricingPreview?.taxRate);
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
        if (paymentId) startPolling(paymentId, bookingRef, bookingId, pricing.total, pricing.base, pricing.serviceFee, pricing.taxes, pricing.discount, "Card", ctx!.pricingPreview?.securityDeposit, ctx!.pricingPreview?.deliveryFee, ctx!.pricingPreview?.commissionRate, ctx!.pricingPreview?.taxRate);
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
    // Cancel the open Stripe PaymentIntent so it doesn't stay dangling
    firePaymentCancel(paymentId);
    sessionStorage.removeItem("zika:checkout");
    if (pollRef.current) clearInterval(pollRef.current);
    setShowCancelConfirm(false);
    router.push("/");
  }

  async function handleReviewVoucherApply(codeOverride?: string) {
    const code = codeOverride ?? reviewVoucherCode;
    if (!ctx || !code.trim()) return;
    setReviewVoucherError("");
    setReviewVoucherApplying(true);
    try {
      const base = ctx.pricePerNight * ctx.nightsOrDays;
      const res = await listingApi.post<any>("/vouchers/validate", {
        code: code.trim(),
        totalAmount: base,
        listingId: ctx.listingId,
        activity: toActivity(ctx.listingCategory),
        guestCountry: ctx.listingCountry,
        guestId: user?.id ?? "",
        guestTier: user?.currentTier ? capitalize(user.currentTier) : undefined,
      });
      if (res.data.success && res.data.data.valid) {
        const vDiscount: number = res.data.data.discountAmount || 0;
        const updated: CheckoutCtx = {
          ...ctx,
          voucherCode: code.trim(),
          voucherDiscount: vDiscount,
          discountSource: "voucher",
          promotionId: undefined,
        };
        setCtx(updated);
        sessionStorage.setItem("zika:checkout", JSON.stringify(updated));
      } else {
        setReviewVoucherError(res.data?.data?.message ?? res.data?.error?.message ?? "Invalid voucher code");
      }
    } catch (err: any) {
      setReviewVoucherError(err?.response?.data?.error?.message ?? "Invalid voucher code");
    } finally {
      setReviewVoucherApplying(false);
    }
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
  // Mobile Money is shown iff the listing is in a Tara-supported country.
  // The guest's phone country is validated when they enter the number.
  const taraListingEligible = isTaraCountry(ctx.listingCountry);
  const hasTara = taraListingEligible;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print-only voucher overlay */}
      {showVoucher && confirmed && (
        <div className="print-only fixed inset-0 z-[9999] bg-white p-8 overflow-auto" id="voucher-print">
          <VoucherLayout confirmed={confirmed} ctx={ctx} />
        </div>
      )}

      <div className="min-h-screen bg-[#F8FAFC] print:hidden">

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <Link href="/" className="flex items-center">
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
              onDownload={handleDownloadPDF}
              onViewBookings={() => router.push("/?tab=bookings")}
              isAuthenticated={!!user}
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
                    {submitting ? "Processing…" : `Pay ${pricing!.platformCurrency} ${fmt(pricing!.platformAmount)}`}
                  </button>
                  {pricing!.platformCurrency !== ctx.currency && (
                    <p className="text-xs text-slate-400 mt-2">
                      Billed as approx. {ctx.currency} {fmt(pricing!.total)} · charged in {pricing!.platformCurrency}
                    </p>
                  )}
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
                          {ctx.roomTypeName && (
                            <p className="text-xs font-semibold text-[#1D8D2B] mt-0.5">{ctx.roomTypeName}</p>
                          )}
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

                    {/* Voucher / promo code */}
                    <SectionCard title="Discount Code">
                      {ctx.discountSource === "voucher" && ctx.voucherCode ? (
                        /* ── Voucher applied ── */
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-emerald-700">
                            ✓ {ctx.voucherCode} — saves {ctx.currency} {fmt(ctx.voucherDiscount ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated: CheckoutCtx = { ...ctx, voucherCode: undefined, voucherDiscount: 0, discountSource: undefined };
                              setCtx(updated);
                              setReviewVoucherCode("");
                              sessionStorage.setItem("zika:checkout", JSON.stringify(updated));
                            }}
                            className="text-xs text-slate-400 hover:text-red-500 transition font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ) : ctx.discountSource === "promotion" ? (
                        /* ── Promotion active — user can still override with a higher voucher ── */
                        <div className="space-y-3">
                          <p className="text-sm text-emerald-700 font-semibold flex items-center gap-1.5">
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Promotion applied — saves {ctx.currency} {fmt(pricing?.discount ?? 0)}
                          </p>
                          <p className="text-xs text-slate-500">Have a voucher that saves more? Select or enter it below:</p>

                          {/* Wallet dropdown */}
                          {loadingWalletVouchers ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 py-0.5">
                              <div className="w-3 h-3 border-2 border-slate-300 border-t-[#0B1E3F] rounded-full animate-spin" />
                              Loading your vouchers…
                            </div>
                          ) : walletVouchers.length > 0 ? (
                            <div className="relative">
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  const code = e.target.value;
                                  if (!code) return;
                                  setReviewVoucherCode(code);
                                  handleReviewVoucherApply(code);
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 appearance-none cursor-pointer focus:outline-none focus:border-[#0B1E3F] pr-7"
                              >
                                <option value="">Select a voucher from wallet…</option>
                                {walletVouchers.map((v) => (
                                  <option key={v.id} value={v.code}>
                                    {v.code}
                                    {v.description
                                      ? ` — ${v.description}`
                                      : v.discountType === "percentage"
                                        ? ` — ${v.discountValue}% off`
                                        : ` — ${ctx.currency} ${v.discountValue} off`}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          ) : null}

                          {/* Manual code input */}
                          <div className="flex gap-2 items-center border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                            <input
                              type="text"
                              placeholder={walletVouchers.length > 0 ? "Or enter code manually" : "Voucher code"}
                              value={reviewVoucherCode}
                              onChange={(e) => setReviewVoucherCode(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleReviewVoucherApply()}
                              className="bg-transparent border-0 focus:ring-0 focus:outline-none text-sm text-slate-800 flex-1 min-w-0"
                            />
                            <button
                              type="button"
                              onClick={() => handleReviewVoucherApply()}
                              disabled={reviewVoucherApplying || !reviewVoucherCode.trim()}
                              className="text-xs font-bold text-[#0B1E3F] border border-[#0B1E3F] px-3 py-1.5 rounded-lg hover:bg-[#0B1E3F] hover:text-white disabled:opacity-40 transition shrink-0"
                            >
                              {reviewVoucherApplying ? "…" : "Apply"}
                            </button>
                          </div>
                          {reviewVoucherError && <p className="text-xs text-red-600 font-medium">{reviewVoucherError}</p>}
                        </div>
                      ) : (
                        /* ── No discount yet ── */
                        <div className="space-y-2.5">
                          {/* Wallet dropdown */}
                          {loadingWalletVouchers ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 py-0.5">
                              <div className="w-3 h-3 border-2 border-slate-300 border-t-[#0B1E3F] rounded-full animate-spin" />
                              Loading your vouchers…
                            </div>
                          ) : walletVouchers.length > 0 ? (
                            <div className="relative">
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  const code = e.target.value;
                                  if (!code) return;
                                  setReviewVoucherCode(code);
                                  handleReviewVoucherApply(code);
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 appearance-none cursor-pointer focus:outline-none focus:border-[#0B1E3F] pr-7"
                              >
                                <option value="">Select a voucher from wallet…</option>
                                {walletVouchers.map((v) => (
                                  <option key={v.id} value={v.code}>
                                    {v.code}
                                    {v.description
                                      ? ` — ${v.description}`
                                      : v.discountType === "percentage"
                                        ? ` — ${v.discountValue}% off`
                                        : ` — ${ctx.currency} ${v.discountValue} off`}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          ) : null}

                          {/* Manual code input */}
                          <div className="flex gap-2 items-center border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                            <input
                              type="text"
                              placeholder={walletVouchers.length > 0 ? "Or enter code manually" : "Promo / voucher code"}
                              value={reviewVoucherCode}
                              onChange={(e) => setReviewVoucherCode(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleReviewVoucherApply()}
                              className="bg-transparent border-0 focus:ring-0 focus:outline-none text-sm text-slate-800 flex-1 min-w-0"
                            />
                            <button
                              type="button"
                              onClick={() => handleReviewVoucherApply()}
                              disabled={reviewVoucherApplying || !reviewVoucherCode.trim()}
                              className="text-xs font-bold text-[#0B1E3F] border border-[#0B1E3F] px-3 py-1.5 rounded-lg hover:bg-[#0B1E3F] hover:text-white disabled:opacity-40 transition shrink-0"
                            >
                              {reviewVoucherApplying ? "…" : "Apply"}
                            </button>
                          </div>
                          {reviewVoucherError && <p className="text-xs text-red-600 font-medium">{reviewVoucherError}</p>}
                        </div>
                      )}
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
                        {(taraListingEligible ? (["tara", "stripe"] as PayProvider[]) : (["stripe"] as PayProvider[])).map((p) => (
                          <button
                            key={p}
                            onClick={() => setProvider(p)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition text-sm font-semibold ${provider === p ? "border-[#0B1E3F] bg-[#0B1E3F]/5 text-[#0B1E3F]" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                          >
                            <span className="text-2xl">{p === "tara" ? "📱" : "💳"}</span>
                            <span>{p === "tara" ? "Mobile Money" : "Card & Digital Wallets"}</span>
                            {hasTara && p === "tara" && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Recommended</span>}
                            {!hasTara && p === "stripe" && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Recommended</span>}
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
                          onChange={(e) => {
                            setMobileNumber(e.target.value);
                            try {
                              const parsed = parsePhoneNumber(e.target.value);
                              setPhoneCountry(parsed?.country ?? "");
                            } catch {
                              setPhoneCountry("");
                            }
                          }}
                          placeholder="+254 700 000 000"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1E3F]/20 focus:border-[#0B1E3F]"
                        />
                        {phoneCountry && !isTaraCountry(phoneCountry) && (
                          <p className="text-xs text-red-600 mt-2">
                            Mobile money is only available for supported African countries. Please use card payment instead.
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-2">You will receive a payment prompt on this number.</p>
                        {ctx && (ctx.currency ?? "").toUpperCase() !== "XAF" && (
                          <p className="text-xs text-slate-500 mt-1">
                            {taraXafLoading
                              ? "Converting to XAF…"
                              : taraXafAmount != null
                                ? `You'll pay approximately ${taraXafAmount.toLocaleString()} XAF (mobile money is charged in XAF).`
                                : "Mobile money is charged in XAF (Central African CFA Franc)."}
                          </p>
                        )}
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

                    {/* Terms & Conditions — required before completing a payment
                        or booking. Acceptance is stored against the account on the
                        first booking, so this is shown once and skipped thereafter.
                        The Privacy Policy is handled earlier, at registration. */}
                    {needsTermsAcceptance && (
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={payTermsAccepted}
                          onChange={(e) => setPayTermsAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0B1E3F] focus:ring-[#0B1E3F]"
                        />
                        <span className="text-sm text-slate-600">
                          I have read and agree to the{" "}
                          <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0B1E3F] underline">
                            Terms &amp; Conditions
                          </a>
                          .
                        </span>
                      </label>
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
                        disabled={submitting || (needsTermsAcceptance && !payTermsAccepted)}
                        className="flex-[2] py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 text-white font-bold rounded-xl transition text-sm"
                      >
                        {submitting ? "Please wait…" : provider === "tara" ? "Send Payment Request" : `Pay ${pricing!.platformCurrency} ${fmt(pricing!.platformAmount)}`}
                      </button>
                    </div>
                    {provider === "stripe" && pricing!.platformCurrency !== ctx.currency && (
                      <p className="text-xs text-slate-400 mt-2 text-center">
                        Billed as approx. {ctx.currency} {fmt(pricing!.total)} · charged in {pricing!.platformCurrency}
                      </p>
                    )}
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
                onClick={() => { sessionStorage.removeItem("zika:checkout"); router.push("/"); }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
              >
                Search again
              </button>
              <button
                onClick={() => { sessionStorage.removeItem("zika:checkout"); router.push(`/?listing=${ctx.listingId}`); }}
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

function PriceSummary({ ctx, pricing }: { ctx: CheckoutCtx; pricing: NonNullable<ReturnType<typeof getPricing>> }) {
  const isCar = ctx.listingCategory === "car";
  const securityDeposit = isCar ? Number(ctx.pricingPreview?.securityDeposit ?? 0) : 0;
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
            {ctx.roomTypeName && (
              <p className="text-[10px] font-semibold text-[#1D8D2B] truncate">{ctx.roomTypeName}</p>
            )}
            <p className="text-xs text-slate-500">{ctx.listingTown}</p>
          </div>
        </div>

        {/* Line items in listing currency; the total is shown in the platform currency */}
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>{ctx.currency} {fmt(ctx.pricingPreview?.nightlyRate ?? ctx.pricePerNight)} × {ctx.pricingPreview?.units ?? ctx.nightsOrDays} {isCar ? "day" : "night"}{(ctx.pricingPreview?.units ?? ctx.nightsOrDays) !== 1 ? "s" : ""}</span>
            <span>{ctx.currency} {fmt(pricing.base)}</span>
          </div>
          {pricing.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>{ctx.discountSource === "promotion" ? "Promotional discount" : "Voucher discount"}</span>
              <span>−{ctx.currency} {fmt(pricing.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-2">
            <span>Subtotal</span>
            <span>{ctx.currency} {fmt(pricing.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Service fee{ctx.pricingPreview?.commissionRate ? ` (${Math.round(ctx.pricingPreview.commissionRate * 100)}%)` : ''}</span>
            <span>{ctx.currency} {fmt(pricing.serviceFee)}</span>
          </div>
          {pricing.taxes > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Taxes{ctx.pricingPreview?.taxRate ? ` (${Math.round(ctx.pricingPreview.taxRate * 100)}%)` : ''}</span>
              <span>{ctx.currency} {fmt(pricing.taxes)}</span>
            </div>
          )}
          {pricing.deliveryFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Delivery fee</span>
              <span>{ctx.currency} {fmt(pricing.deliveryFee)}</span>
            </div>
          )}
          {isCar && securityDeposit > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Security deposit</span>
              <span>{ctx.currency} {fmt(securityDeposit)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-3 text-base">
            <span>Total</span>
            <MoneyValue platform={pricing.platformAmount} listing={pricing.total} currency={pricing.platformCurrency} listingCurrency={pricing.listingCurrency} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmed View ───────────────────────────────────────────────────────────

function ConfirmedView({
  confirmed, ctx, onDownload, onViewBookings, isAuthenticated,
}: {
  confirmed: ConfirmedBooking;
  ctx: CheckoutCtx;
  onDownload: () => void;
  onViewBookings: () => void;
  isAuthenticated: boolean;
}) {
  const isCar = ctx.listingCategory === "car";
  const info = derivePlatform(ctx.pricingPreview, confirmed.currency, confirmed.totalAmount);
  const platformCurrency = info.platformCurrency;
  const platformAmount = info.platformAmount;
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

      {/* Anonymous → create an account banner. Adopt-by-email attaches this
          booking to the account automatically on sign-up/login with the same
          email, so the guest does not lose access. */}
      {!isAuthenticated && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div>
            <h3 className="font-bold text-amber-900 text-sm">Want to keep your bookings in one place?</h3>
            <p className="text-amber-800 text-xs leading-relaxed mt-1">
              Create a free account with <strong>{ctx.email}</strong> and this booking will be attached to it
              automatically. You'll be able to view your reservations, save favourites, and earn rewards.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/auth/register?email=${encodeURIComponent(ctx.email)}`}
              className="inline-flex items-center justify-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition"
            >
              Create an account
            </a>
            <button
              onClick={onViewBookings}
              className="inline-flex items-center justify-center px-4 py-2 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold rounded-lg transition"
            >
              Continue browsing
            </button>
          </div>
        </div>
      )}

      {/* Booking info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800">Booking Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Booking Reference" value={confirmed.reference} />
          <InfoRow label="Traveller Name" value={`${ctx.firstName} ${ctx.lastName}`} />
          <InfoRow label={isCar ? "Vehicle" : "Property"} value={ctx.listingTitle} />
          {ctx.roomTypeName && (
            <InfoRow label="Room Type" value={ctx.roomTypeName} />
          )}
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
              <span>{ctx.discountSource === "promotion" ? "Promotional discount" : "Voucher discount"}</span>
              <span>−{confirmed.currency} {fmt(confirmed.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Service fee{confirmed.commissionRate ? ` (${Math.round(confirmed.commissionRate * 100)}%)` : ''}</span>
            <span>{confirmed.currency} {fmt(confirmed.serviceFee)}</span>
          </div>
          {confirmed.taxes > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Taxes{confirmed.taxRate ? ` (${Math.round(confirmed.taxRate * 100)}%)` : ''}</span>
              <span>{confirmed.currency} {fmt(confirmed.taxes)}</span>
            </div>
          )}
          {isCar && confirmed.securityDeposit != null && confirmed.securityDeposit > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Security deposit</span>
              <span>{confirmed.currency} {fmt(confirmed.securityDeposit)}</span>
            </div>
          )}
          {confirmed.deliveryFee != null && confirmed.deliveryFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Delivery fee</span>
              <span>{confirmed.currency} {fmt(confirmed.deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-3 text-base">
            <span>Total Paid</span>
            <MoneyValue platform={platformAmount} listing={confirmed.totalAmount} currency={platformCurrency} listingCurrency={confirmed.currency} />
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Payment Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Payment Method" value={confirmed.paymentMethod} />
          <InfoRow label="Transaction ID" value={confirmed.displayId ?? confirmed.transactionId ?? confirmed.paymentId} />
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
        {/* <button
          onClick={onDownload}
          className="flex-1 py-3.5 border-2 border-[#166534] text-[#166534] font-bold rounded-xl hover:bg-[#166534]/5 transition text-sm flex items-center justify-center gap-2"
        >
          <span>⬇</span> Download Voucher PDF
        </button> */}
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
  confirmed, ctx,
}: {
  confirmed: ConfirmedBooking;
  ctx: CheckoutCtx;
}) {
  const isCar = ctx.listingCategory === "car";
  const info = derivePlatform(ctx.pricingPreview, confirmed.currency, confirmed.totalAmount);
  const platformCurrency = info.platformCurrency;
  const platformAmount = info.platformAmount;
  const lv = (value: number) => `${confirmed.currency} ${fmt(value)}`;
  const totalDisplay = platformCurrency === confirmed.currency
    ? lv(platformAmount)
    : `${fmtMoney(platformAmount, platformCurrency)}  (Billed as approx. ${lv(confirmed.totalAmount)})`;
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
        {ctx.roomTypeName && (
          <VoucherRow label="Room Type" value={ctx.roomTypeName} />
        )}
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
        <VoucherRow label="Base amount" value={lv(confirmed.baseAmount)} />
        {confirmed.discount > 0 && <VoucherRow label="Discount" value={`−${lv(confirmed.discount)}`} />}
        <VoucherRow label={`Service fee${confirmed.commissionRate ? ` (${Math.round(confirmed.commissionRate * 100)}%)` : ''}`} value={lv(confirmed.serviceFee)} />
        {confirmed.taxes > 0 && <VoucherRow label={`Taxes${confirmed.taxRate ? ` (${Math.round(confirmed.taxRate * 100)}%)` : ''}`} value={lv(confirmed.taxes)} />}
        {isCar && confirmed.securityDeposit != null && confirmed.securityDeposit > 0 && <VoucherRow label="Security deposit" value={lv(confirmed.securityDeposit)} />}
        <VoucherRow label="Total Paid" value={totalDisplay} bold />
      </VoucherSection>

      {/* Payment Info */}
      <VoucherSection title="Payment Information">
        <VoucherRow label="Payment Method" value={confirmed.paymentMethod} />
        <VoucherRow label="Transaction ID" value={confirmed.displayId ?? confirmed.transactionId ?? confirmed.paymentId} />
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
