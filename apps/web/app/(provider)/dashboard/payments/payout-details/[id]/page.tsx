"use client";

import { use, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { getPayoutDetail, type Payout } from "@/lib/payment-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

function readNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function extractStatusCode(error: unknown): number | undefined {
  const err = error as { response?: { status?: number } };
  return err?.response?.status;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message ?? (error instanceof Error ? error.message : fallback);
}

function payoutAmount(payout: Payout): number {
  return readNumber(payout.amount);
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs text-right text-slate-700" : "text-sm font-semibold text-right text-slate-900"}>
        {value || "N/A"}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-green-700 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h3 className="font-bold text-slate-800">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </Card>
  );
}

function SkeletonPage() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 rounded-xl bg-slate-100 animate-pulse" />
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <Banknote className="h-14 w-14 text-slate-200" />
      <p className="mt-4 text-lg font-bold text-slate-700">Payout not found</p>
      <p className="mt-1 text-sm text-slate-400">This payout record may not exist or you may not have access to it.</p>
      <Link href="/dashboard/payments/payout-history" className="mt-6">
        <Button variant="outline" icon={<ArrowLeft />}>
          Back to Payout History
        </Button>
      </Link>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-center">
      <XCircle className="h-14 w-14 text-red-400" />
      <p className="mt-4 text-lg font-bold text-red-800">Unable to load payout details</p>
      <p className="mt-1 max-w-lg text-sm text-red-700">{message}</p>
      <Button className="mt-6" variant="outline" icon={<RefreshCw />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default function PayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const payoutId = id?.trim() ?? "";

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["provider-payout-detail", payoutId],
    queryFn: () => getPayoutDetail(payoutId),
    enabled: Boolean(payoutId),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!payoutId) return <NotFoundState />;
  if (isLoading) return <SkeletonPage />;

  const statusCode = extractStatusCode(error);
  if (isError) {
    if (statusCode === 404) return <NotFoundState />;
    return <ErrorState message={extractErrorMessage(error, "The payout detail request failed.")} onRetry={() => refetch()} />;
  }

  if (!data) return <NotFoundState />;

  const payout = data.data;
  const amount = payoutAmount(payout);
  const method = payout.merchant?.payoutMethod ?? "N/A";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/payments/payout-history">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payout Details</h1>
              <Badge label={payout.status} status={payout.status} dot />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Payout ID: <span className="font-mono">{payout.id}</span>
            </p>
          </div>
        </div>
        <Button variant="outline" icon={<RefreshCw />} loading={isFetching} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-emerald-100">Payout Amount</p>
        <p className="mt-2 text-4xl font-bold">{formatCurrency(amount, payout.currency)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-emerald-100">
          <span>Status: {payout.status}</span>
          <span>Booking ID: {payout.bookingId}</span>
          <span>Method: {method}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Payout Information" icon={<BookOpen />}>
          <InfoRow label="Payout ID" value={payout.id} mono />
          <InfoRow label="Booking ID" value={payout.bookingId} mono />
          <InfoRow label="Provider ID" value={payout.providerId} mono />
          <InfoRow label="Merchant ID" value={payout.merchantId} mono />
          <InfoRow label="Provider Payout ID" value={payout.providerPayoutId ?? "N/A"} mono />
        </SectionCard>

        <SectionCard title="Timing" icon={<CalendarDays />}>
          <InfoRow label="Scheduled Date" value={formatDate(payout.scheduledAt)} />
          <InfoRow label="Paid Date" value={payout.processedAt ? formatDate(payout.processedAt) : "N/A"} />
          <InfoRow label="Created Date" value={formatDateTime(payout.createdAt)} />
          <InfoRow label="Updated Date" value={formatDateTime(payout.updatedAt)} />
          <InfoRow label="Current Status" value={payout.status} />
        </SectionCard>

        <SectionCard title="Merchant Setup" icon={<CreditCard />}>
          <InfoRow label="Payout Method" value={method} />
          <InfoRow label="Merchant Verified" value={payout.merchant?.isVerified ? "Verified" : "Not verified"} />
          <InfoRow label="Currency" value={payout.currency} />
          <InfoRow label="Amount" value={formatCurrency(amount, payout.currency)} />
        </SectionCard>

        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 [&>svg]:h-4 [&>svg]:w-4">
              <CheckCircle2 />
            </span>
            <h3 className="font-bold text-slate-800">Audit Fields</h3>
          </div>
          <div className="divide-y divide-slate-100">
            <InfoRow label="Failure Reason" value={payout.failureReason ?? "N/A"} />
            <InfoRow label="Merchant Status" value={payout.merchant?.isVerified ? "Ready for payouts" : "Verification pending"} />
            <InfoRow label="Last Updated" value={formatDateTime(payout.updatedAt)} />
            <InfoRow label="First Recorded" value={formatDateTime(payout.createdAt)} />
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/payments/payout-history">
          <Button variant="outline" icon={<ArrowLeft />}>
            Back to Payout History
          </Button>
        </Link>
        <Link href="/dashboard/bookings">
          <Button variant="ghost" icon={<BookOpen />}>
            View Bookings
          </Button>
        </Link>
        <Button variant="ghost" icon={<RefreshCw />} loading={isFetching} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
