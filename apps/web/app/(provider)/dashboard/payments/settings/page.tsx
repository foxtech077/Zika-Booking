"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building,
  CreditCard,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type PayoutMethod = "stripe" | "bank_transfer" | "mobile_money";
type VerificationStatus = "unverified" | "pending" | "verified";

interface AccountDetails {
  // Stripe
  stripeEmail: string;
  stripeAccountId: string;
  // Bank Transfer
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
  // Mobile Money
  mobileCarrier: string;
  mobileNumber: string;
  mobileAccountName: string;
}

const CARRIER_OPTIONS = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "orange", label: "Orange Money" },
  { value: "vodafone", label: "Vodafone Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "airtel", label: "AirtelTigo Money" },
];

export default function PaymentSettingsPage() {
  const [preferredMethod, setPreferredMethod] = useState<PayoutMethod>("bank_transfer");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [details, setDetails] = useState<AccountDetails>({
    stripeEmail: "",
    stripeAccountId: "",
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    routingNumber: "",
    mobileCarrier: "mtn",
    mobileNumber: "",
    mobileAccountName: "",
  });

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const storedMethod = localStorage.getItem("provider_preferred_payout_method") as PayoutMethod;
    const storedStatus = localStorage.getItem("provider_verification_status") as VerificationStatus;
    const storedDetails = localStorage.getItem("provider_account_details");

    if (storedMethod) setPreferredMethod(storedMethod);
    if (storedStatus) setVerificationStatus(storedStatus);
    if (storedDetails) {
      try {
        setDetails(JSON.parse(storedDetails));
      } catch (e) {
        console.error("Error parsing stored account details", e);
      }
    }
  }, []);

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate details briefly
    if (preferredMethod === "bank_transfer") {
      if (!details.bankName || !details.accountHolderName || !details.accountNumber) {
        setLoading(false);
        triggerToast("Please fill in all required bank fields.", "error");
        return;
      }
    } else if (preferredMethod === "mobile_money") {
      if (!details.mobileNumber || !details.mobileAccountName) {
        setLoading(false);
        triggerToast("Please fill in all required mobile money fields.", "error");
        return;
      }
    } else if (preferredMethod === "stripe") {
      if (!details.stripeEmail) {
        setLoading(false);
        triggerToast("Please enter your Stripe email.", "error");
        return;
      }
    }

    setTimeout(() => {
      localStorage.setItem("provider_preferred_payout_method", preferredMethod);
      localStorage.setItem("provider_account_details", JSON.stringify(details));
      setLoading(false);
      triggerToast("Payment details updated successfully!");
    }, 1200);
  };

  const handleVerifyAccount = () => {
    setVerifying(true);
    setTimeout(() => {
      localStorage.setItem("provider_verification_status", "verified");
      setVerificationStatus("verified");
      setVerifying(false);
      triggerToast("Your account has been successfully verified!");
    }, 1800);
  };

  const handleChangeMethod = (method: PayoutMethod) => {
    setPreferredMethod(method);
    localStorage.setItem("provider_preferred_payout_method", method);
    triggerToast(`Preferred payout method changed to ${method.replace("_", " ")}.`);
  };

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
          <p className="mt-0.5 text-sm text-slate-500">Configure your payout methods and verify credentials.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Verification & Method Selection Card */}
        <div className="space-y-6 md:col-span-1">
          {/* Verification Status */}
          <Card>
            <CardHeader title="Verification Status" />
            <div className="mt-2 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 font-medium">Status</span>
                <Badge
                  label={verificationStatus === "verified" ? "Verified" : "Unverified"}
                  status={verificationStatus === "verified" ? "success" : "danger"}
                  dot
                />
              </div>

              {verificationStatus !== "verified" ? (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 text-xs text-amber-800">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Verification Required</p>
                      <p className="mt-1 leading-relaxed text-amber-700">
                        Please verify your account to allow the platform to release pending payouts.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white border-none focus:ring-amber-500"
                    size="sm"
                    onClick={handleVerifyAccount}
                    loading={verifying}
                    icon={<ShieldCheck />}
                  >
                    Verify Account
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs text-emerald-800">
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Account Verified</p>
                      <p className="mt-1 leading-relaxed text-emerald-700">
                        Your account status is active. Payouts are scheduled automatically after check-in.
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
              <button
                onClick={() => handleChangeMethod("stripe")}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                  preferredMethod === "stripe"
                    ? "bg-emerald-50 border-emerald-200 shadow-sm"
                    : "border-slate-100 hover:bg-slate-50"
                )}
              >
                <CreditCard className={cn("h-5 w-5", preferredMethod === "stripe" ? "text-emerald-700" : "text-slate-400")} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Stripe Connect</p>
                  <p className="text-[10px] text-slate-400">Direct instant payouts</p>
                </div>
                {preferredMethod === "stripe" && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-600" />
                )}
              </button>

              <button
                onClick={() => handleChangeMethod("bank_transfer")}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                  preferredMethod === "bank_transfer"
                    ? "bg-emerald-50 border-emerald-200 shadow-sm"
                    : "border-slate-100 hover:bg-slate-50"
                )}
              >
                <Building className={cn("h-5 w-5", preferredMethod === "bank_transfer" ? "text-emerald-700" : "text-slate-400")} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Bank Transfer</p>
                  <p className="text-[10px] text-slate-400">Standard checking account</p>
                </div>
                {preferredMethod === "bank_transfer" && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-600" />
                )}
              </button>

              <button
                onClick={() => handleChangeMethod("mobile_money")}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                  preferredMethod === "mobile_money"
                    ? "bg-emerald-50 border-emerald-200 shadow-sm"
                    : "border-slate-100 hover:bg-slate-50"
                )}
              >
                <Phone className={cn("h-5 w-5", preferredMethod === "mobile_money" ? "text-emerald-700" : "text-slate-400")} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Mobile Money</p>
                  <p className="text-[10px] text-slate-400">Orange, MTN, M-Pesa</p>
                </div>
                {preferredMethod === "mobile_money" && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-600" />
                )}
              </button>
            </div>
          </Card>
        </div>

        {/* Details Form Card */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader
              title={
                preferredMethod === "stripe"
                  ? "Stripe Connect Integration"
                  : preferredMethod === "bank_transfer"
                  ? "Bank Account Information"
                  : "Mobile Money Configuration"
              }
              subtitle="Enter details for the preferred payout method"
            />
            <form onSubmit={handleSaveDetails} className="space-y-4 mt-4">
              {preferredMethod === "stripe" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed">
                    <p className="font-semibold text-slate-800">Why Stripe Connect?</p>
                    <p className="mt-1 text-xs">
                      Stripe Connect processes payments instantly to your regional account once payouts are approved. Connecting is fast and secure.
                    </p>
                  </div>
                  <Input
                    label="Stripe Registered Email"
                    placeholder="name@example.com"
                    type="email"
                    required
                    value={details.stripeEmail}
                    onChange={(e) => setDetails({ ...details, stripeEmail: e.target.value })}
                  />
                  {details.stripeAccountId ? (
                    <Input
                      label="Stripe Connected Account ID"
                      disabled
                      value={details.stripeAccountId}
                    />
                  ) : (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="primary"
                        icon={<CreditCard />}
                        onClick={() => {
                          setDetails({ ...details, stripeAccountId: "acct_1nZ89xK23LkmP9" });
                          triggerToast("Connected dummy Stripe Account: acct_1nZ89xK23LkmP9");
                        }}
                      >
                        Connect with Stripe
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {preferredMethod === "bank_transfer" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Input
                      label="Account Holder Name"
                      placeholder="Jane Doe"
                      required
                      value={details.accountHolderName}
                      onChange={(e) => setDetails({ ...details, accountHolderName: e.target.value })}
                      leftIcon={<User />}
                    />
                  </div>
                  <Input
                    label="Bank Name"
                    placeholder="Emerald Trust Bank"
                    required
                    value={details.bankName}
                    onChange={(e) => setDetails({ ...details, bankName: e.target.value })}
                    leftIcon={<Building />}
                  />
                  <Input
                    label="Routing Number / SWIFT"
                    placeholder="021000021"
                    value={details.routingNumber}
                    onChange={(e) => setDetails({ ...details, routingNumber: e.target.value })}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Account Number / IBAN"
                      placeholder="1234567890"
                      required
                      value={details.accountNumber}
                      onChange={(e) => setDetails({ ...details, accountNumber: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {preferredMethod === "mobile_money" && (
                <div className="space-y-4">
                  <Select
                    label="Mobile Money Carrier"
                    value={details.mobileCarrier}
                    onChange={(e) => setDetails({ ...details, mobileCarrier: e.target.value })}
                    options={CARRIER_OPTIONS}
                  />
                  <Input
                    label="Mobile Money Phone Number"
                    placeholder="+1 555 123 4567"
                    required
                    value={details.mobileNumber}
                    onChange={(e) => setDetails({ ...details, mobileNumber: e.target.value })}
                    leftIcon={<Phone />}
                  />
                  <Input
                    label="Mobile Money Account Holder Name"
                    placeholder="Jane Doe"
                    required
                    value={details.mobileAccountName}
                    onChange={(e) => setDetails({ ...details, mobileAccountName: e.target.value })}
                    leftIcon={<User />}
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  icon={<Save />}
                >
                  Update Details
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
