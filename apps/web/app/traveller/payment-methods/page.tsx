"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GuestPaymentMethod,
  addTaraPaymentMethod,
  confirmStripePaymentMethod,
  createStripeSetupIntent,
  deletePaymentMethod,
  extractApiErrorMessage,
  getGuestPaymentMethods,
  setDefaultPaymentMethod,
} from "@/lib/payment-api";
import { useAuthStore } from "@/stores/auth";

// ─── Icons ────────────────────────────────────────────────────────────────────

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

// ─── Card brand display ───────────────────────────────────────────────────────

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  unionpay: "UnionPay",
  jcb: "JCB",
  diners: "Diners",
};

function methodLabel(m: GuestPaymentMethod): string {
  if (m.paymentProvider === "tara") {
    return `M-Pesa ••••${m.mobileNumberMasked ?? ""}`;
  }
  const brand = BRAND_LABELS[m.cardBrand?.toLowerCase() ?? ""] ?? (m.cardBrand ?? "Card");
  return `${brand} •••• ${m.cardLast4 ?? ""}  ${m.cardExpMonth}/${m.cardExpYear}`;
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type AddMode = "none" | "stripe" | "tara";

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();

  const [methods, setMethods] = useState<GuestPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // ── Add card (Stripe SetupIntent) ─────────────────────────────────────────
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Stripe Elements state
  const stripeCardRef = useRef<HTMLDivElement>(null);
  const [stripeInst, setStripeInst] = useState<any>(null);
  const [stripeCardEl, setStripeCardEl] = useState<any>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState("");

  // ── Add Tara ──────────────────────────────────────────────────────────────
  const [taraNumber, setTaraNumber] = useState("");

  // ── Delete confirm ────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GuestPaymentMethod | null>(null);

  // ── Set default ───────────────────────────────────────────────────────────
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // ── Success banner ────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState("");

  // ─── Auth guard ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user) { router.replace("/auth/login"); return; }
    fetchMethods();
  }, [_hasHydrated, user]);

  // ─── Stripe card element ──────────────────────────────────────────────────

  useEffect(() => {
    if (addMode !== "stripe" || !stripeInst || !stripeCardRef.current || stripeClientSecret === "") return;
    const elements = stripeInst.elements();
    const card = elements.create("card", {
      style: {
        base: {
          fontSize: "15px",
          color: "#1e293b",
          fontFamily: "inherit",
          "::placeholder": { color: "#94a3b8" },
        },
      },
    });
    card.mount(stripeCardRef.current);
    setStripeCardEl(card);
    return () => { try { card.destroy(); } catch { } };
  }, [addMode, stripeInst, stripeClientSecret]);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  async function fetchMethods() {
    setLoading(true);
    setPageError("");
    try {
      const res = await getGuestPaymentMethods();
      setMethods(res.data?.paymentMethods ?? []);
    } catch (err) {
      setPageError(extractApiErrorMessage(err, "Failed to load payment methods."));
    } finally {
      setLoading(false);
    }
  }

  // ─── Start adding Stripe card ──────────────────────────────────────────────

  async function handleStartStripe() {
    setAddError("");
    setAddLoading(true);
    try {
      const res = await createStripeSetupIntent();
      if (!res.success) { setAddError("Could not initialise card setup. Please try again."); return; }
      setStripeClientSecret(res.data.clientSecret);
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      setStripeInst(stripe);
      setAddMode("stripe");
    } catch (err) {
      setAddError(extractApiErrorMessage(err, "Could not start card setup."));
    } finally {
      setAddLoading(false);
    }
  }

  // ─── Confirm Stripe card ───────────────────────────────────────────────────

  async function handleConfirmStripe() {
    if (!stripeInst || !stripeCardEl || !stripeClientSecret) return;
    setAddError("");
    setAddLoading(true);
    try {
      const result = await stripeInst.confirmCardSetup(stripeClientSecret, {
        payment_method: { card: stripeCardEl },
      });
      if (result.error) {
        setAddError(result.error.message ?? "Card setup failed. Please check your details.");
        return;
      }
      const pmId = result.setupIntent?.payment_method as string | undefined;
      if (!pmId) { setAddError("Card setup incomplete. Please try again."); return; }
      const saved = await confirmStripePaymentMethod(pmId);
      if (!saved.success) { setAddError("Failed to save card."); return; }
      setAddMode("none");
      setStripeClientSecret("");
      setStripeInst(null);
      setStripeCardEl(null);
      setSuccessMsg("Card saved successfully.");
      await fetchMethods();
    } catch (err) {
      setAddError(extractApiErrorMessage(err, "Failed to save card."));
    } finally {
      setAddLoading(false);
    }
  }

  // ─── Add Tara ─────────────────────────────────────────────────────────────

  async function handleAddTara(e: React.FormEvent) {
    e.preventDefault();
    const num = taraNumber.trim();
    if (!num) { setAddError("Please enter a mobile number."); return; }
    if (!/^\+\d{7,15}$/.test(num)) {
      setAddError("Enter a valid E.164 number (e.g. +254712345678).");
      return;
    }
    setAddError("");
    setAddLoading(true);
    try {
      const res = await addTaraPaymentMethod(num);
      if (!res.success) { setAddError("Failed to save M-Pesa account."); return; }
      setAddMode("none");
      setTaraNumber("");
      setSuccessMsg("M-Pesa account saved.");
      await fetchMethods();
    } catch (err) {
      setAddError(extractApiErrorMessage(err, "Failed to save M-Pesa account."));
    } finally {
      setAddLoading(false);
    }
  }

  // ─── Set default ──────────────────────────────────────────────────────────

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id);
    try {
      await setDefaultPaymentMethod(id);
      setMethods((prev) =>
        prev.map((m) => ({ ...m, isDefault: m.id === id }))
      );
      setSuccessMsg("Default payment method updated.");
    } catch (err) {
      setPageError(extractApiErrorMessage(err, "Failed to update default method."));
    } finally {
      setSettingDefaultId(null);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      await deletePaymentMethod(id);
      setMethods((prev) => prev.filter((m) => m.id !== id));
      setSuccessMsg("Payment method removed.");
    } catch (err) {
      setPageError(extractApiErrorMessage(err, "Failed to delete payment method."));
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Dismiss add form ─────────────────────────────────────────────────────

  function cancelAdd() {
    setAddMode("none");
    setAddError("");
    setTaraNumber("");
    setStripeClientSecret("");
    setStripeInst(null);
    setStripeCardEl(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Methods</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your saved cards and mobile money accounts.</p>
        </div>

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-800 font-medium">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {successMsg}
            </span>
            <button type="button" onClick={() => setSuccessMsg("")} className="text-xs text-emerald-600 hover:text-emerald-800 underline">Dismiss</button>
          </div>
        )}

        {/* Page error */}
        {pageError && (
          <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 font-medium">
            {pageError}
            <button type="button" onClick={() => setPageError("")} className="text-xs underline shrink-0">Dismiss</button>
          </div>
        )}

        {/* Saved methods list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 text-sm">Saved Methods</h2>
            {!loading && methods.length > 0 && (
              <span className="text-xs text-slate-400">{methods.length} saved</span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3 p-5">
              {[1, 2].map((n) => (
                <div key={n} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : methods.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 px-5 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                <CreditCardIcon className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No payment methods saved</p>
              <p className="text-xs text-slate-400 max-w-xs">Add a card or M-Pesa account so you can pay faster at checkout.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {methods.map((m) => {
                const isSettingDefault = settingDefaultId === m.id;
                const isDeleting = deletingId === m.id;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-4">
                    {/* Icon */}
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${m.paymentProvider === "stripe" ? "bg-violet-50" : "bg-emerald-50"}`}>
                      {m.paymentProvider === "stripe" ? (
                        <CreditCardIcon className="w-4.5 h-4.5 text-violet-600 w-5 h-5" />
                      ) : (
                        <PhoneIcon className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{methodLabel(m)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 capitalize">{m.paymentProvider === "stripe" ? "Card" : "M-Pesa"}</span>
                        {m.isDefault && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!m.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(m.id)}
                          disabled={isSettingDefault || isDeleting}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40 transition"
                        >
                          {isSettingDefault ? (
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                              Setting…
                            </span>
                          ) : "Set Default"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(m)}
                        disabled={isDeleting || isSettingDefault}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 transition"
                        aria-label={`Delete ${methodLabel(m)}`}
                      >
                        {isDeleting ? (
                          <span className="w-2.5 h-2.5 border border-red-300 border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          <TrashIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Add method section */}
        {addMode === "none" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm">Add Payment Method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleStartStripe}
                disabled={addLoading}
                className="flex items-center gap-3 px-4 py-3.5 border-2 border-dashed border-slate-200 hover:border-violet-400 rounded-xl text-sm font-semibold text-slate-600 hover:text-violet-700 hover:bg-violet-50/40 disabled:opacity-50 transition group"
              >
                {addLoading ? (
                  <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                ) : (
                  <CreditCardIcon className="w-5 h-5 text-violet-500 group-hover:text-violet-700 shrink-0" />
                )}
                <span>
                  <span className="block text-sm font-bold">{addLoading ? "Setting up…" : "Add Card"}</span>
                  <span className="block text-[11px] font-normal text-slate-400">Visa, Mastercard, Amex</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setAddMode("tara"); setAddError(""); }}
                className="flex items-center gap-3 px-4 py-3.5 border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl text-sm font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/40 transition group"
              >
                <PhoneIcon className="w-5 h-5 text-emerald-500 group-hover:text-emerald-700 shrink-0" />
                <span>
                  <span className="block text-sm font-bold">Add M-Pesa</span>
                  <span className="block text-[11px] font-normal text-slate-400">Mobile money account</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Stripe card form */}
        {addMode === "stripe" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <CreditCardIcon className="w-4 h-4 text-violet-500" />
                Add Card
              </h2>
              <button type="button" onClick={cancelAdd} className="text-xs text-slate-400 hover:text-slate-600 transition">Cancel</button>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              256-bit SSL encrypted · Powered by Stripe
            </p>

            <div ref={stripeCardRef} className="border border-slate-200 rounded-xl p-4 bg-slate-50 min-h-[48px]" />

            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{addError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={cancelAdd}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStripe}
                disabled={addLoading || !stripeCardEl}
                className="flex-[2] py-2.5 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 text-white font-bold rounded-xl transition text-sm"
              >
                {addLoading ? "Saving…" : "Save Card"}
              </button>
            </div>
          </div>
        )}

        {/* Tara form */}
        {addMode === "tara" && (
          <form onSubmit={handleAddTara} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <PhoneIcon className="w-4 h-4 text-emerald-500" />
                Add M-Pesa Account
              </h2>
              <button type="button" onClick={cancelAdd} className="text-xs text-slate-400 hover:text-slate-600 transition">Cancel</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
              <input
                type="tel"
                value={taraNumber}
                onChange={(e) => setTaraNumber(e.target.value)}
                placeholder="+254712345678"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              />
              <p className="text-xs text-slate-400 mt-1.5">Include country code (e.g. +254 for Kenya)</p>
            </div>

            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{addError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={cancelAdd}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addLoading}
                className="flex-[2] py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl transition text-sm"
              >
                {addLoading ? "Saving…" : "Save M-Pesa Account"}
              </button>
            </div>
          </form>
        )}

        {/* Security note */}
        <div className="text-center text-xs text-slate-400 pb-4">
          <span>Your payment information is encrypted and stored securely.</span>
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <ModalBackdrop>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <TrashIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Remove payment method?</h3>
              <p className="text-sm text-slate-500 mt-0.5">{methodLabel(confirmDelete)}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            This method will be permanently removed from your account. Any active subscriptions using it may be affected.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => handleDelete(confirmDelete.id)}
              className="flex-[1.5] py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition text-sm"
            >
              Remove
            </button>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}
