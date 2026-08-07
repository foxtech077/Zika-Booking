"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parsePhoneNumber } from "libphonenumber-js";
import { isTaraCountry } from "@zika/types";
import {
  AlertCircle,
  ArrowLeft,
  Building,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  extractApiErrorMessage,
  getMerchantProfile,
  getStripeConnectStatus,
  getStripeOnboardingUrl,
  refreshStripeConnect,
  startStripeConnect,
  updateMerchantProfile,
  type MerchantProfile,
  type StripeConnectStatusResponse,
} from "@/lib/payment-api";

// ── Tara-supported countries for mobile money payouts (shared rule) ─────────

type PayoutMethod = MerchantProfile["payoutMethod"];
type Toast = { message: string; type: "success" | "error" } | null;

type SetupState = {
  label: string;
  detail: string;
  badgeTone: "success" | "warning" | "danger" | "info";
};

type MerchantSetupSnapshot = {
  profile: MerchantProfile;
  stripeStatus: StripeConnectStatusResponse | null;
};

let initialMerchantSetupPromise: Promise<MerchantSetupSnapshot> | null = null;

async function fetchMerchantSetup(): Promise<MerchantSetupSnapshot> {
  const profileRes = await getMerchantProfile();
  const profile = profileRes.data;
  let stripeStatus: StripeConnectStatusResponse | null = null;

  if (profile.stripeConnectAccountId) {
    try {
      const stripeRes = await getStripeConnectStatus();
      stripeStatus = stripeRes.data;
    } catch {
      stripeStatus = null;
    }
  }

  return { profile, stripeStatus };
}

function fetchMerchantSetupOnce(): Promise<MerchantSetupSnapshot> {
  if (!initialMerchantSetupPromise) {
    initialMerchantSetupPromise = fetchMerchantSetup().finally(() => {
      initialMerchantSetupPromise = null;
    });
  }

  return initialMerchantSetupPromise;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  return extractApiErrorMessage(error, fallback);
}

function formatMethodLabel(method: PayoutMethod): string {
  switch (method) {
    case "stripe_connect":
      return "Stripe Connect";
    case "bank_transfer":
      return "Bank Transfer";
    case "mobile_money":
      return "Mobile Money";
    case "manual":
      return "Manual";
  }
}

function maskValue(value: string, visible = 4): string {
  const clean = value.replace(/\s+/g, "");
  if (!clean) return "N/A";
  if (clean.length <= visible) return clean;
  return `${"*".repeat(Math.max(1, clean.length - visible))}${clean.slice(-visible)}`;
}

function maskStripeAccountId(value: string | null | undefined): string {
  if (!value) return "N/A";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getSetupState(profile: MerchantProfile | null, stripeStatus: StripeConnectStatusResponse | null): SetupState {
  if (!profile) {
    return { label: "Not loaded", detail: "Merchant profile is still loading.", badgeTone: "info" };
  }

  if (profile.payoutMethod === "stripe_connect") {
    if (!profile.stripeConnectAccountId) {
      return { label: "Not connected", detail: "Stripe Connect onboarding has not started yet.", badgeTone: "warning" };
    }
    if (stripeStatus?.onboardingComplete) {
      return { label: "Connected and ready for payouts", detail: "Stripe has confirmed onboarding and payout readiness.", badgeTone: "success" };
    }
    if (!stripeStatus) {
      return { label: "Stripe status unavailable", detail: "Use the status check button to confirm onboarding progress.", badgeTone: "warning" };
    }
    if (!stripeStatus.detailsSubmitted) {
      return { label: "Onboarding incomplete", detail: "Stripe onboarding is still missing required details.", badgeTone: "warning" };
    }
    if (!stripeStatus.chargesEnabled || !stripeStatus.payoutsEnabled) {
      return { label: "Action required", detail: "Stripe still needs attention before payouts can flow.", badgeTone: "danger" };
    }
    return { label: "Onboarding in progress", detail: "Stripe is still finalizing account readiness.", badgeTone: "warning" };
  }

  if (profile.payoutMethod === "bank_transfer") {
    const complete = Boolean(profile.bankName && profile.bankAccountNumber && profile.bankAccountName);
    return complete
      ? { label: "Bank details saved", detail: "Bank payout fields are saved on the merchant profile.", badgeTone: "success" }
      : { label: "Bank details incomplete", detail: "Bank transfer requires a bank name, account name, and account number.", badgeTone: "warning" };
  }

  if (profile.payoutMethod === "mobile_money") {
    return profile.mobileMoneyNumber
      ? { label: "Mobile money saved", detail: "Mobile money payout details are saved on the merchant profile.", badgeTone: "success" }
      : { label: "Mobile money incomplete", detail: "Mobile money requires a phone number.", badgeTone: "warning" };
  }

  return { label: "Manual payouts selected", detail: "Manual payout handling is currently selected.", badgeTone: "info" };
}

function getStripeConnectState(profile: MerchantProfile | null, stripeStatus: StripeConnectStatusResponse | null): SetupState {
  if (!profile?.stripeConnectAccountId) {
    return { label: "Not connected", detail: "No Stripe Connect account has been created yet.", badgeTone: "warning" };
  }

  if (!stripeStatus) {
    return { label: "Status unavailable", detail: "Use the status check button to confirm onboarding progress.", badgeTone: "warning" };
  }

  if (stripeStatus.onboardingComplete) {
    return { label: "Connected and ready for payouts", detail: "Stripe has confirmed that the account is fully onboarded.", badgeTone: "success" };
  }

  if (!stripeStatus.detailsSubmitted) {
    return { label: "Onboarding incomplete", detail: "Stripe onboarding has not been finished yet.", badgeTone: "warning" };
  }

  if (!stripeStatus.chargesEnabled || !stripeStatus.payoutsEnabled) {
    return { label: "Action required", detail: "Stripe still needs attention before payouts can flow.", badgeTone: "danger" };
  }

  return { label: "Onboarding in progress", detail: "Stripe is still finalizing account readiness.", badgeTone: "warning" };
}

function getVerificationState(profile: MerchantProfile | null): SetupState {
  if (!profile) {
    return { label: "Not loaded", detail: "Merchant profile is still loading.", badgeTone: "info" };
  }

  return profile.isVerified
    ? { label: "Verified", detail: "Merchant verification has been confirmed in the backend.", badgeTone: "success" }
    : { label: "Not verified", detail: "Merchant verification is still pending.", badgeTone: "warning" };
}

function getAccountSummary(profile: MerchantProfile | null): { label: string; value: string; detail: string } {
  if (!profile) {
    return { label: "Account details", value: "N/A", detail: "Merchant profile is still loading." };
  }

  switch (profile.payoutMethod) {
    case "stripe_connect":
      return {
        label: "Stripe account",
        value: maskStripeAccountId(profile.stripeConnectAccountId),
        detail: profile.stripeConnectAccountId ? "Masked Stripe Connect account ID." : "No Stripe account has been connected yet.",
      };
    case "bank_transfer":
      return {
        label: "Bank account",
        value: profile.bankAccountNumber ? `Ending ${profile.bankAccountNumber.slice(-4)}` : "Not saved",
        detail: profile.bankName ? `${profile.bankName} - ${maskValue(profile.bankAccountNumber ?? "")}` : "Bank details are saved in masked form.",
      };
    case "mobile_money": {
      let formatted = profile.mobileMoneyNumber || "Not saved";
      if (profile.mobileMoneyNumber) {
        try {
          formatted = parsePhoneNumber(profile.mobileMoneyNumber).formatInternational();
        } catch {
          // use raw value
        }
      }
      return {
        label: "Mobile money",
        value: formatted,
        detail: "Phone number used for mobile money payouts.",
      };
    }
    case "manual":
      return {
        label: "Manual payouts",
        value: "No payout account details required",
        detail: "Manual payouts do not expose any stored account details.",
      };
  }
}

function OverviewCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-lg font-bold text-slate-900 leading-tight">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm [&>svg]:h-5 [&>svg]:w-5", tone)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SectionNotice({
  title,
  message,
  tone = "bg-slate-50 border-slate-100 text-slate-700",
}: {
  title: string;
  message: string;
  tone?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 text-sm", tone)}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{message}</p>
    </div>
  );
}

export default function PaymentSettingsPage() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("manual");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");

  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatusResponse | null>(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeRefreshing, setStripeRefreshing] = useState(false);
  const [stripeChecking, setStripeChecking] = useState(false);

  const [mobileMoneyError, setMobileMoneyError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  }

  function hydrateForm(next: MerchantProfile) {
    setPayoutMethod(next.payoutMethod ?? "manual");
    setBankName(next.bankName ?? "");
    setBankAccountNumber(next.bankAccountNumber ?? "");
    setBankAccountName(next.bankAccountName ?? "");
    setMobileMoneyNumber(next.mobileMoneyNumber ?? "");
    setBusinessName(next.businessName ?? "");
    setCountry(next.country ?? "");
  }

  async function loadProfile() {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const snapshot = await fetchMerchantSetup();
      setProfile(snapshot.profile);
      hydrateForm(snapshot.profile);
      setStripeStatus(snapshot.stripeStatus);
    } catch (error) {
      setProfileError(extractErrorMessage(error, "Failed to load your merchant profile."));
    } finally {
      setProfileLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;

    setProfileLoading(true);
    setProfileError(null);

    void fetchMerchantSetupOnce()
      .then((snapshot) => {
        if (cancelled) return;

        setProfile(snapshot.profile);
        hydrateForm(snapshot.profile);
        setStripeStatus(snapshot.stripeStatus);
      })
      .catch((error) => {
        if (!cancelled) {
          setProfileError(extractErrorMessage(error, "Failed to load your merchant profile."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setupState = useMemo(() => getSetupState(profile, stripeStatus), [profile, stripeStatus]);
  const stripeConnectState = useMemo(() => getStripeConnectState(profile, stripeStatus), [profile, stripeStatus]);
  const verificationState = useMemo(() => getVerificationState(profile), [profile]);
  const accountSummary = useMemo(() => getAccountSummary(profile), [profile]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

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

      try {
        const parsed = parsePhoneNumber(mobileMoneyNumber.trim());
        if (!parsed?.country || !isTaraCountry(parsed.country)) {
          setMobileMoneyError("This country doesn't support mobile money via Tara. Please use a supported African number.");
          setSaving(false);
          return;
        }
      } catch {
        setMobileMoneyError("Please enter a valid phone number in international format (e.g. +233501234567).");
        setSaving(false);
        return;
      }

      payload.mobileMoneyNumber = mobileMoneyNumber.trim();
    }

    try {
      const res = await updateMerchantProfile(payload);
      setProfile(res.data);
      hydrateForm(res.data);

      // Only fetch Stripe status when payout method is stripe_connect to avoid
      // the backend resetting payoutMethod back to stripe_connect on a full check.
      if (payoutMethod === "stripe_connect" && res.data.stripeConnectAccountId) {
        try {
          const stripeRes = await getStripeConnectStatus();
          setStripeStatus(stripeRes.data);
        } catch {
          // Keep the current Stripe status visible if the refresh fails.
        }
      }

      showToast("Payment details updated successfully.");
    } catch (error) {
      showToast(extractErrorMessage(error, "Failed to save payment details."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectStripe() {
    setStripeConnecting(true);
    try {
      const res = await startStripeConnect();
      const onboardingUrl = getStripeOnboardingUrl(res);
      if (!onboardingUrl) {
        showToast("Stripe onboarding URL was missing from the response.", "error");
        setStripeConnecting(false);
        return;
      }

      window.location.assign(onboardingUrl);
    } catch (error) {
      showToast(extractErrorMessage(error, "Failed to start Stripe Connect onboarding."), "error");
      setStripeConnecting(false);
    }
  }

  async function handleRefreshStripeLink() {
    setStripeRefreshing(true);
    try {
      const res = await refreshStripeConnect();
      const onboardingUrl = getStripeOnboardingUrl(res);
      if (!onboardingUrl) {
        showToast("Stripe onboarding URL was missing from the response.", "error");
        setStripeRefreshing(false);
        return;
      }

      window.location.assign(onboardingUrl);
    } catch (error) {
      showToast(extractErrorMessage(error, "Failed to refresh Stripe onboarding link."), "error");
      setStripeRefreshing(false);
    }
  }

  async function handleCheckStripeStatus() {
    setStripeChecking(true);
    try {
      const res = await getStripeConnectStatus();
      setStripeStatus(res.data);

      setProfile((current) =>
        current
          ? {
              ...current,
              payoutMethod: res.data.payoutMethod,
              stripeConnectAccountId: res.data.stripeAccountId,
            }
          : current,
      );
      setPayoutMethod(res.data.payoutMethod);

      if (res.data.onboardingComplete) {
        showToast("Stripe Connect is connected and ready for payouts.");
      } else {
        const nextState = getStripeConnectState(profile, res.data);
        showToast(`Stripe status: ${nextState.label}.`, "error");
      }
    } catch (error) {
      showToast(extractErrorMessage(error, "Failed to check Stripe status."), "error");
    } finally {
      setStripeChecking(false);
    }
  }

  const stripeAccountConnected = Boolean(profile?.stripeConnectAccountId);
  const stripeOnboardingComplete = Boolean(stripeStatus?.onboardingComplete);
  const showStripeSection = payoutMethod === "stripe_connect" || stripeAccountConnected;
  const showStripeConnectAction = showStripeSection && !stripeOnboardingComplete;
  const showStripeRefresh = stripeAccountConnected && !stripeOnboardingComplete;
  const stripeActionLabel = stripeAccountConnected ? "Continue Stripe Setup" : "Connect Stripe";
  const stripeBadgeVariant = stripeConnectState.badgeTone;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      {toast && (
        <div
          className={cn(
            "fixed right-4 top-4 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg animate-slide-in",
            toast.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-red-100 bg-red-50 text-red-800",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link href="/dashboard/payments">
          <Button variant="ghost" size="sm" icon={<ArrowLeft />}>
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Settings</h1>
          <p className="mt-0.5 text-sm text-slate-500">Configure your provider payout method and account details.</p>
        </div>
      </div>

      {profileLoading && (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {!profileLoading && profileError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-800">{profileError}</p>
          <Button variant="outline" icon={<RefreshCw />} onClick={() => void loadProfile()}>
            Retry
          </Button>
        </div>
      )}

      {!profileLoading && !profileError && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              label="Current Payout Method"
              value={formatMethodLabel(profile?.payoutMethod ?? payoutMethod)}
              detail="Stored on the merchant profile."
              icon={<Wallet />}
              tone="bg-emerald-600 text-white"
            />
            <OverviewCard
              label="Setup Status"
              value={setupState.label}
              detail={setupState.detail}
              icon={<ShieldCheck />}
              tone="bg-green-700 text-white"
            />
            <OverviewCard
              label="Verification Status"
              value={verificationState.label}
              detail={verificationState.detail}
              icon={<CheckCircle2 />}
              tone="bg-slate-700 text-white"
            />
            <OverviewCard
              label={accountSummary.label}
              value={accountSummary.value}
              detail={accountSummary.detail}
              icon={<CreditCard />}
              tone="bg-sky-600 text-white"
            />
          </div>

          <Card>
            <CardHeader
              title={
                payoutMethod === "stripe_connect"
                  ? "Stripe Connect Integration"
                  : payoutMethod === "bank_transfer"
                    ? "Bank Account Information"
                    : payoutMethod === "mobile_money"
                      ? "Mobile Money Configuration"
                      : "Manual Payout Setup"
              }
              subtitle="Only the fields relevant to the selected payout method are shown below."
            />

            <form onSubmit={handleSave} className="mt-4 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Business Name (optional)"
                  placeholder="Your business or trading name"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  leftIcon={<User />}
                />
                <Input
                  label="Country (optional)"
                  placeholder="e.g. Ghana, Nigeria, Kenya"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </div>

              <Card className="border border-slate-100 bg-slate-50/60" padding="sm">
                <div className="grid gap-2">
                  {([
                    { value: "stripe_connect", label: "Stripe Connect", sub: "Direct onboarding and payouts", Icon: CreditCard },
                    { value: "bank_transfer", label: "Bank Transfer", sub: "Bank account settlement", Icon: Building },
                    { value: "mobile_money", label: "Mobile Money", sub: "Mobile wallet payouts", Icon: Phone },
                    { value: "manual", label: "Manual", sub: "No stored payout details", Icon: Wallet },
                  ] as const).map(({ value, label, sub, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setPayoutMethod(value);
                        setMobileMoneyError(null);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                        payoutMethod === value ? "border-emerald-200 bg-emerald-50 shadow-sm" : "border-slate-100 bg-white hover:bg-slate-50",
                      )}
                    >
                      <Icon className={cn("h-5 w-5", payoutMethod === value ? "text-emerald-700" : "text-slate-400")} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{label}</p>
                        <p className="text-[10px] text-slate-400">{sub}</p>
                      </div>
                      {payoutMethod === value && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-600" />}
                    </button>
                  ))}
                </div>
              </Card>

              {showStripeSection && (
                <div className="space-y-4">
                  <SectionNotice
                    title="Stripe Connect"
                    message="Connect Stripe to continue onboarding, or refresh the link if the original onboarding page expired."
                    tone="bg-slate-50 border-slate-100 text-slate-700"
                  />

                  {profile?.stripeConnectAccountId ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge label={stripeConnectState.label} variant={stripeBadgeVariant} />
                        {stripeStatus?.chargesEnabled && <Badge label="Charges Enabled" variant="success" />}
                        {stripeStatus?.payoutsEnabled && <Badge label="Payouts Enabled" variant="success" />}
                        {typeof stripeStatus?.detailsSubmitted === "boolean" && (
                          <Badge label={stripeStatus.detailsSubmitted ? "Details Submitted" : "Details Missing"} variant={stripeStatus.detailsSubmitted ? "success" : "warning"} />
                        )}
                      </div>
                      <p className="font-mono text-sm text-emerald-900">{maskStripeAccountId(profile.stripeConnectAccountId)}</p>
                    </div>
                  ) : (
                    <SectionNotice
                      title="Stripe account not connected"
                      message="Start Stripe onboarding to create the express account and generate the first onboarding link."
                      tone="bg-amber-50 border-amber-100 text-amber-800"
                    />
                  )}

                  <div className="flex flex-wrap gap-3">
                    {showStripeConnectAction && (
                      <Button
                        type="button"
                        variant="primary"
                        icon={stripeConnecting ? <Loader2 className="animate-spin" /> : stripeAccountConnected ? <ExternalLink /> : <CreditCard />}
                        loading={stripeConnecting}
                        onClick={handleConnectStripe}
                      >
                        {stripeActionLabel}
                      </Button>
                    )}

                    {showStripeRefresh && (
                      <Button
                        type="button"
                        variant="outline"
                        icon={stripeRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                        loading={stripeRefreshing}
                        onClick={handleRefreshStripeLink}
                      >
                        Refresh Onboarding Link
                      </Button>
                    )}

                    {profile?.stripeConnectAccountId && (
                      <Button
                        type="button"
                        variant="ghost"
                        icon={stripeChecking ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                        loading={stripeChecking}
                        onClick={handleCheckStripeStatus}
                      >
                        Check Stripe Status
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {payoutMethod === "bank_transfer" && (
                <div className="space-y-4">
                  <SectionNotice
                    title="Bank Transfer"
                    message="The stored bank account number is hidden in the input field for safety. Re-enter it if you need to change the value."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Input
                        label="Account Holder Name"
                        placeholder="Jane Doe"
                        required
                        value={bankAccountName}
                        onChange={(event) => setBankAccountName(event.target.value)}
                        leftIcon={<User />}
                      />
                    </div>
                    <Input
                      label="Bank Name"
                      placeholder="Emerald Trust Bank"
                      required
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                      leftIcon={<Building />}
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Account Number / IBAN"
                        placeholder="Enter or update your account number"
                        type="password"
                        autoComplete="off"
                        required
                        value={bankAccountNumber}
                        onChange={(event) => setBankAccountNumber(event.target.value)}
                        hint="Stored in masked form on screen."
                      />
                    </div>
                  </div>
                </div>
              )}

              {payoutMethod === "mobile_money" && (
                <div className="space-y-4">
                  <SectionNotice
                    title="Mobile Money"
                    message="Enter your mobile money phone number in international format (e.g. +233501234567)."
                  />
                  <Input
                    label="Mobile Money Phone Number"
                    placeholder="+233 50 123 4567"
                    type="tel"
                    autoComplete="off"
                    required
                    value={mobileMoneyNumber}
                    onChange={(event) => {
                      const cleaned = event.target.value.replace(/[^+\d\s-]/g, "");
                      setMobileMoneyNumber(cleaned);
                      setMobileMoneyError(null);
                    }}
                    leftIcon={<Phone />}
                    error={mobileMoneyError ?? undefined}
                  />
                </div>
              )}

              {payoutMethod === "manual" && (
                <SectionNotice
                  title="Manual Payouts"
                  message="No payout account fields are required for manual payouts."
                  tone="bg-slate-50 border-slate-100 text-slate-700"
                />
              )}

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit" variant="primary" loading={saving} icon={<Save />}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
