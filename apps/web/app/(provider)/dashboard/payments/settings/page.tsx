"use client";

/**
 * Provider → Dashboard → Payments → Settings
 *
 * API integrations (all via paymentApi):
 *  ✅ GET  /merchant/me                         — load profile on mount
 *  ✅ PATCH /merchant/me                        — save payout details
 *  ✅ POST  /merchant/me/stripe/connect         — start Stripe onboarding
 *  ✅ GET   /merchant/me/stripe/connect/refresh — regenerate expired link
 *  ✅ GET   /merchant/me/stripe/connect/status  — check connection status
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  ExternalLink,
  Loader2,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  getMerchantProfile,
  updateMerchantProfile,
  startStripeConnect,
  refreshStripeConnect,
  getStripeConnectStatus,
  type MerchantProfile,
  type StripeConnectStatusResponse,
} from "@/lib/payment-api";

// ─── Types ───────────────────────────────────────────────────────────────────

type PayoutMethod = MerchantProfile["payoutMethod"];

// ─── Toast helper ─────────────────────────────────────────────────────────────

type Toast = { message: string; type: "success" | "error" } | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PaymentSettingsPage() {
  // ── Profile state ──
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ── Form state ──
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("manual");
  // Bank Transfer
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  // Mobile Money
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  // Shared
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");

  // ── Stripe Connect state ──
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatusResponse | null>(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeRefreshing, setStripeRefreshing] = useState(false);
  const [stripeChecking, setStripeChecking] = useState(false);

  // ── Action state ──
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Hydrate form from profile ──
  function hydrateForm(p: MerchantProfile) {
    setPayoutMethod(p.payoutMethod ?? "manual");
    setBankName(p.bankName ?? "");
    setBankAccountNumber(p.bankAccountNumber ?? "");
    setBankAccountName(p.bankAccountName ?? "");
    setMobileMoneyNumber(p.mobileMoneyNumber ?? "");
    setBusinessName(p.businessName ?? "");
    setCountry(p.country ?? "");
  }

  // ── Fetch merchant profile ──
  async function loadProfile() {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await getMerchantProfile();
      setProfile(res.data);
      hydrateForm(res.data);
      // If payout method is stripe, also fetch stripe status
      if (res.data.payoutMethod === "stripe_connect" || res.data.stripeConnectAccountId) {
        await loadStripeStatus();
      }
    } catch (err) {
      setProfileError(extractErrorMessage(err, "Failed to load your merchant profile."));
    } finally {
      setProfileLoading(false);
    }
  }

  // ── Fetch stripe connect status ──
  async function loadStripeStatus() {
    try {
      const res = await getStripeConnectStatus();
      setStripeStatus(res.data);
    } catch {
      // No stripe account yet — silence the error; we'll show the Connect button
      setStripeStatus(null);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save payout details ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Build payload — only include fields relevant to the selected method
    const payload: Parameters<typeof updateMerchantProfile>[0] = {
      payoutMethod,
      ...(businessName.trim() ? { businessName: businessName.trim() } : {}),
      ...(country.trim() ? { country: country.trim() } : {}),
    };

    if (payoutMethod === "bank_transfer") {
      if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
        showToast("Please fill in all required bank fields.", "error");
        setSaving(false);
        return;
      }
      payload.bankName = bankName.trim();
      payload.bankAccountNumber = bankAccountNumber.trim();
      payload.bankAccountName = bankAccountName.trim();
    } else if (payoutMethod === "mobile_money") {
      if (!mobileMoneyNumber.trim()) {
        showToast("Please enter your mobile money number.", "error");
        setSaving(false);
        return;
      }
      payload.mobileMoneyNumber = mobileMoneyNumber.trim();
    }

    try {
      const res = await updateMerchantProfile(payload);
      setProfile(res.data);
      hydrateForm(res.data);
      showToast("Payment details updated successfully!");
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to save payment details."), "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Connect Stripe ──
  async function handleConnectStripe() {
    setStripeConnecting(true);
    try {
      const res = await startStripeConnect();
      // Redirect to Stripe-hosted onboarding page
      window.location.href = res.data.onboardingUrl;
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to start Stripe Connect onboarding."), "error");
      setStripeConnecting(false);
    }
  }

  // ── Refresh expired Stripe link ──
  async function handleRefreshStripeLink() {
    setStripeRefreshing(true);
    try {
      const res = await refreshStripeConnect();
      window.location.href = res.data.onboardingUrl;
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to refresh Stripe onboarding link."), "error");
      setStripeRefreshing(false);
    }
  }

  // ── Check Stripe status ──
  async function handleCheckStripeStatus() {
    setStripeChecking(true);
    try {
      const res = await getStripeConnectStatus();
      setStripeStatus(res.data);
      if (res.data.onboardingComplete) {
        showToast("Stripe is fully connected and active!");
        // Reload profile so payoutMethod is updated from DB
        await loadProfile();
      } else {
        showToast("Stripe onboarding is not yet complete. Please finish setup on Stripe.", "error");
      }
    } catch (err) {
      showToast(extractErrorMessage(err, "Failed to check Stripe status."), "error");
    } finally {
      setStripeChecking(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-lg border animate-slide-in text-sm font-semibold",
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-red-50 border-red-100 text-red-800"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payments">
          <Button variant="ghost" size="sm" icon={<ArrowLeft />}>Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Settings</h1>
          <p className="mt-0.5 text-sm text-slate-500">Configure your payout method and account details.</p>
        </div>
      </div>

      {/* Loading skeleton */}
      {profileLoading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Profile error */}
      {!profileLoading && profileError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-800">{profileError}</p>
          <Button variant="outline" icon={<RefreshCw />} onClick={loadProfile}>
            Retry
          </Button>
        </div>
      )}

      {/* Main content */}
      {!profileLoading && !profileError && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left column: status + method selection */}
          <div className="space-y-6 md:col-span-1">
            {/* Verification Status */}
            <Card>
              <CardHeader title="Verification Status" />
              <div className="mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 font-medium">Status</span>
                  <Badge
                    label={profile?.isVerified ? "Verified" : "Unverified"}
                    status={profile?.isVerified ? "active" : "suspended"}
                    dot
                  />
                </div>

                {!profile?.isVerified ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 text-xs text-amber-800">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Verification Required</p>
                        <p className="mt-1 leading-relaxed text-amber-700">
                          Please complete payout setup. An admin will verify your account before payouts can be released.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs text-emerald-800">
                    <div className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Account Verified</p>
                        <p className="mt-1 leading-relaxed text-emerald-700">
                          Your account is active. Payouts are scheduled automatically after check-in.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Preferred Method Selection */}
            <Card>
              <CardHeader title="Preferred Method" />
              <div className="mt-3 space-y-2">
                {(
                  [
                    { value: "stripe_connect", label: "Stripe Connect", sub: "Direct instant payouts", Icon: CreditCard },
                    { value: "bank_transfer",  label: "Bank Transfer",  sub: "Standard bank account",   Icon: Building },
                    { value: "mobile_money",   label: "Mobile Money",   sub: "Orange, MTN, M-Pesa",     Icon: Phone },
                  ] as const
                ).map(({ value, label, sub, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPayoutMethod(value)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      payoutMethod === value
                        ? "bg-emerald-50 border-emerald-200 shadow-sm"
                        : "border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", payoutMethod === value ? "text-emerald-700" : "text-slate-400")} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      <p className="text-[10px] text-slate-400">{sub}</p>
                    </div>
                    {payoutMethod === value && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-emerald-600" />
                    )}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Right column: details form */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader
                title={
                  payoutMethod === "stripe_connect"
                    ? "Stripe Connect Integration"
                    : payoutMethod === "bank_transfer"
                    ? "Bank Account Information"
                    : payoutMethod === "mobile_money"
                    ? "Mobile Money Configuration"
                    : "Payout Details"
                }
                subtitle="Enter details for your selected payout method"
              />
              <form onSubmit={handleSave} className="space-y-4 mt-4">
                {/* Optional shared fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Business Name (optional)"
                    placeholder="Your business or trading name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    leftIcon={<User />}
                  />
                  <Input
                    label="Country (optional)"
                    placeholder="e.g. Ghana, Nigeria, Kenya"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>

                {/* ── Stripe Connect ── */}
                {payoutMethod === "stripe_connect" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed">
                      <p className="font-semibold text-slate-800">Why Stripe Connect?</p>
                      <p className="mt-1 text-xs">
                        Stripe Connect enables instant, secure payouts to your regional bank account once a booking is completed. Setting up is free.
                      </p>
                    </div>

                    {/* Connected account info */}
                    {profile?.stripeConnectAccountId && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
                        <p className="text-xs font-semibold text-emerald-800">Stripe Account ID</p>
                        <p className="font-mono text-sm text-emerald-900">{profile.stripeConnectAccountId}</p>
                        {stripeStatus && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Badge label={stripeStatus.onboardingComplete ? "Fully Onboarded" : "Onboarding Incomplete"} status={stripeStatus.onboardingComplete ? "active" : "pending"} dot />
                            {stripeStatus.chargesEnabled && <Badge label="Charges Enabled" status="active" dot />}
                            {stripeStatus.payoutsEnabled && <Badge label="Payouts Enabled" status="active" dot />}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3">
                      {!profile?.stripeConnectAccountId ? (
                        <Button
                          type="button"
                          variant="primary"
                          icon={stripeConnecting ? <Loader2 className="animate-spin" /> : <CreditCard />}
                          loading={stripeConnecting}
                          onClick={handleConnectStripe}
                        >
                          Connect with Stripe
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            icon={stripeConnecting ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                            loading={stripeConnecting}
                            onClick={handleConnectStripe}
                          >
                            Re-open Onboarding
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            icon={stripeRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                            loading={stripeRefreshing}
                            onClick={handleRefreshStripeLink}
                          >
                            Refresh Onboarding Link
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            icon={stripeChecking ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                            loading={stripeChecking}
                            onClick={handleCheckStripeStatus}
                          >
                            Check Stripe Status
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Bank Transfer ── */}
                {payoutMethod === "bank_transfer" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Input
                        label="Account Holder Name"
                        placeholder="Jane Doe"
                        required
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                        leftIcon={<User />}
                      />
                    </div>
                    <Input
                      label="Bank Name"
                      placeholder="Emerald Trust Bank"
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      leftIcon={<Building />}
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Account Number / IBAN"
                        placeholder="1234567890"
                        required
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* ── Mobile Money ── */}
                {payoutMethod === "mobile_money" && (
                  <div className="space-y-4">
                    <Input
                      label="Mobile Money Phone Number"
                      placeholder="+233 50 123 4567"
                      required
                      value={mobileMoneyNumber}
                      onChange={(e) => setMobileMoneyNumber(e.target.value)}
                      leftIcon={<Phone />}
                    />
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-600">
                      Supported networks: MTN Mobile Money, Orange Money, Vodafone Cash, M-Pesa, AirtelTigo Money.
                    </div>
                  </div>
                )}

                {/* Save button — not shown for stripe_connect (no form fields to save aside from shared ones) */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={saving}
                    icon={<Save />}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
