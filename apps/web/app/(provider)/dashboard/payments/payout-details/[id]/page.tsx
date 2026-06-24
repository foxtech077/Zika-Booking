"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft,
  Banknote,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Hash,
  RefreshCw,
  User,
} from "lucide-react";
import { getPayoutDetail } from "@/lib/payment-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PayoutDetail {
  id: string;
  bookingReference: string;
  guestName: string;
  listingName: string;
  checkIn: string;
  checkOut: string;
  // Financial breakdown
  grossAmount: number;
  platformCommission: number;
  commissionRate: number;
  netEarnings: number;
  taxes: number;
  adjustments: number;
  adjustmentNote: string;
  // Transaction info
  transactionReference: string;
  payoutDate: string;
  payoutMethod: string;
  status: string;
  currency: string;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function readNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function readString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}



function normalizeDetail(payload: unknown): PayoutDetail {
  // Backend Payout response shape:
  // { id, merchantId, bookingId, providerId, amount (Decimal), currency,
  //   status, scheduledAt, processedAt, providerPayoutId, failureReason,
  //   createdAt, updatedAt, merchant: { payoutMethod, isVerified } }
  const m = (payload as Record<string, unknown>);
  const merchant = (m.merchant ?? {}) as Record<string, unknown>;

  const gross = readNumber(m.amount);
  const commission = 0; // platform commission not stored on payout row
  const net = gross - commission;

  return {
    id: readString(m.id, ""),
    bookingReference: readString(m.bookingId, "N/A"),
    guestName: readString(undefined, "Guest"),
    listingName: readString(undefined, "Booking"),
    checkIn: "",
    checkOut: "",
    grossAmount: gross,
    platformCommission: commission,
    commissionRate: 0,
    netEarnings: net,
    taxes: 0,
    adjustments: 0,
    adjustmentNote: readString(m.failureReason, ""),
    transactionReference: readString(m.providerPayoutId, "—"),
    payoutDate: readString(m.processedAt ?? m.scheduledAt ?? m.createdAt, ""),
    payoutMethod: readString(merchant.payoutMethod, "Platform Wallet"),
    status: readString(m.status, "scheduled"),
    currency: readString(m.currency, "USD"),
  };
}

async function fetchPayoutDetail(id: string): Promise<PayoutDetail | null> {
  try {
    // GET /provider/me/payouts/:id — correct endpoint via paymentApi
    const res = await getPayoutDetail(id);
    return normalizeDetail(res.data);
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs text-right text-slate-700" : "text-sm font-semibold text-right text-slate-900"}>
        {value || "—"}
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
  icon: React.ReactNode;
  children: React.ReactNode;
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

function FinancialRow({
  label,
  value,
  tone,
  large,
  note,
}: {
  label: string;
  value: string;
  tone?: string;
  large?: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div>
        <span className="text-sm text-slate-600">{label}</span>
        {note && <p className="mt-0.5 text-xs text-slate-400">{note}</p>}
      </div>
      <span className={large ? "text-lg font-bold text-emerald-700" : tone ?? "text-sm font-semibold text-slate-900"}>
        {value}
      </span>
    </div>
  );
}

function SkeletonPage() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 rounded-xl bg-slate-100 animate-pulse" />
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <Banknote className="h-14 w-14 text-slate-200" />
      <p className="mt-4 text-lg font-bold text-slate-700">Payout not found</p>
      <p className="mt-1 text-sm text-slate-400">
        This payout record may have been removed or does not exist.
      </p>
      <Link href="/dashboard/payments/payout-history" className="mt-6">
        <Button variant="outline" icon={<ArrowLeft />}>Back to Payout History</Button>
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-payout-detail", id],
    queryFn: () => fetchPayoutDetail(id),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <SkeletonPage />;
  if (!data) return <NotFound />;

  const finalNet = data.netEarnings;
  const hasAdjustments = data.adjustments !== 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/payments/payout-history">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>Back</Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payout Details</h1>
              <Badge label={data.status} status={data.status} dot />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Transaction ref: <span className="font-mono">{data.transactionReference}</span>
            </p>
          </div>
        </div>
        <Button variant="outline" icon={<RefreshCw />} loading={isFetching} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* ── Net payout hero ── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-emerald-100">Net Payout Amount</p>
        <p className="mt-2 text-4xl font-bold">{formatCurrency(finalNet, data.currency)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-emerald-100">
          <span>Gross: {formatCurrency(data.grossAmount, data.currency)}</span>
          <span>Commission: −{formatCurrency(data.platformCommission, data.currency)}</span>
          {hasAdjustments && (
            <span>Adjustments: {data.adjustments > 0 ? "+" : "−"}{formatCurrency(Math.abs(data.adjustments), data.currency)}</span>
          )}
        </div>
      </div>

      {/* ── 4 detail cards ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Booking Information */}
        <SectionCard title="Booking Information" icon={<BookOpen />}>
          <InfoRow label="Booking Reference" value={data.bookingReference} mono />
          <InfoRow label="Guest Name" value={data.guestName} />
          <InfoRow label="Listing Name" value={data.listingName} />
          <InfoRow label="Check-in Date" value={data.checkIn ? formatDate(data.checkIn) : "—"} />
          <InfoRow label="Check-out Date" value={data.checkOut ? formatDate(data.checkOut) : "—"} />
        </SectionCard>

        {/* Financial Breakdown */}
        <SectionCard title="Financial Breakdown" icon={<Banknote />}>
          <FinancialRow
            label="Gross Booking Amount"
            value={formatCurrency(data.grossAmount, data.currency)}
          />
          <FinancialRow
            label={`Platform Commission (${data.commissionRate}%)`}
            value={`−${formatCurrency(data.platformCommission, data.currency)}`}
            tone="text-red-600 text-sm font-semibold"
          />
          {data.taxes > 0 && (
            <FinancialRow
              label="Taxes"
              value={`−${formatCurrency(data.taxes, data.currency)}`}
              tone="text-red-500 text-sm font-semibold"
            />
          )}
          {hasAdjustments && (
            <FinancialRow
              label="Adjustments"
              value={`${data.adjustments > 0 ? "+" : "−"}${formatCurrency(Math.abs(data.adjustments), data.currency)}`}
              tone={data.adjustments > 0 ? "text-emerald-600 text-sm font-semibold" : "text-red-500 text-sm font-semibold"}
              note={data.adjustmentNote || undefined}
            />
          )}
          <FinancialRow
            label="Net Earnings"
            value={formatCurrency(finalNet, data.currency)}
            large
          />
        </SectionCard>

        {/* Transaction Information */}
        <SectionCard title="Transaction Information" icon={<CreditCard />}>
          <InfoRow label="Transaction Reference" value={data.transactionReference} mono />
          <InfoRow label="Payout Date" value={data.payoutDate ? formatDate(data.payoutDate) : "Pending"} />
          <InfoRow label="Payout Method" value={data.payoutMethod} />
          <div className="flex items-start justify-between gap-4 py-3">
            <span className="text-sm text-slate-500">Payout Status</span>
            <Badge label={data.status} status={data.status} dot />
          </div>
        </SectionCard>

        {/* Platform Policy */}
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 [&>svg]:h-4 [&>svg]:w-4">
              <CheckCircle2 />
            </span>
            <h3 className="font-bold text-slate-800">Payout Policy</h3>
          </div>
          <div className="space-y-3">
            {[
              { icon: <User />, text: "Payments are collected from travellers by the platform." },
              { icon: <CheckCircle2 />, text: "Earnings are held until guest check-in is confirmed." },
              { icon: <CalendarDays />, text: "A T+24h holding period applies after check-in." },
              { icon: <Banknote />, text: "Commission is deducted before payout is released." },
              { icon: <Hash />, text: "Each payout is assigned a unique transaction reference." },
            ].map(({ icon, text }, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-green-700 shadow-sm [&>svg]:h-3.5 [&>svg]:w-3.5">
                  {icon}
                </span>
                <p className="text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/payments/payout-history">
          <Button variant="outline" icon={<ArrowLeft />}>Back to Payout History</Button>
        </Link>
        <Link href={`/dashboard/bookings?ref=${data.bookingReference}`}>
          <Button variant="ghost" icon={<BookOpen />}>View Booking</Button>
        </Link>
        <Button
          variant="ghost"
          icon={<RefreshCw />}
          loading={isFetching}
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
