"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import { getAllPayouts, type Payout, type PayoutStatus } from "@/lib/payment-api";
import { useEurRates, toEur, type EurRates } from "@/lib/eurRates";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { cn, formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";

type StatusBucket = {
  amount: number;
  count: number;
};

interface DashboardSummary {
  currency: string;
  total: StatusBucket;
  paid: StatusBucket;
  pending: StatusBucket;
  upcoming: StatusBucket;
  processing: StatusBucket;
  failed: StatusBucket;
  cancelled: StatusBucket;
  monthlyTrend: { month: string; amount: number }[];
  recentPayouts: Payout[];
}

function readNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function payoutAmount(payout: Payout): number {
  return readNumber(payout.amount);
}

function payoutActivityDate(payout: Payout): string {
  return payout.processedAt ?? payout.scheduledAt ?? payout.createdAt;
}

function bucketFor(
  status: PayoutStatus
): keyof Omit<DashboardSummary, "currency" | "monthlyTrend" | "recentPayouts"> | undefined {
  switch (status) {
    case "paid":
      return "paid";
    case "pending":
      return "pending";
    case "scheduled":
      return "upcoming";
    case "processing":
      return "processing";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return undefined;
  }
}

function buildDashboardSummary(payouts: Payout[], rates: EurRates): DashboardSummary {
  const emptyBucket = (): StatusBucket => ({ amount: 0, count: 0 });

  const summary: DashboardSummary = {
    currency: "EUR",
    total: emptyBucket(),
    paid: emptyBucket(),
    pending: emptyBucket(),
    upcoming: emptyBucket(),
    processing: emptyBucket(),
    failed: emptyBucket(),
    cancelled: emptyBucket(),
    monthlyTrend: [],
    recentPayouts: payouts.slice(0, 6),
  };

  const monthly = new Map<string, number>();

  for (const payout of payouts) {
    // Convert each payout to EUR before summing — payouts may be recorded in
    // different currencies (paid Stripe payouts are EUR, pending ones are the
    // listing currency), so they must never be summed raw.
    const amount = toEur(payoutAmount(payout), payout.currency, rates) ?? 0;
    summary.total.amount += amount;
    summary.total.count += 1;

    const key = bucketFor(payout.status);
    if (key) {
      summary[key].amount += amount;
      summary[key].count += 1;
    }

    const month = new Date(payoutActivityDate(payout));
    if (!Number.isNaN(month.getTime())) {
      const monthKey = month.toISOString().slice(0, 7);
      monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + amount);
    }
  }

  summary.monthlyTrend = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  return summary;
}

function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
      {icon ?? <Banknote className="h-10 w-10 text-slate-300" />}
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="mt-3 font-semibold text-slate-800">Unable to load payout data</p>
        <p className="mt-1 max-w-lg text-sm text-slate-500">{message}</p>
        <Button className="mt-4" variant="outline" icon={<RefreshCw />} onClick={onRetry}>
          Retry
        </Button>
      </div>
    </Card>
  );
}

function LoadingCard() {
  return <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />;
}

function SummaryCard({
  label,
  value,
  count,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  count: number;
  icon: ReactNode;
  tone: string;
  loading: boolean;
}) {
  return (
    <Card>
      {loading ? (
        <LoadingCard />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 leading-none">{value}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              {count} payout{count === 1 ? "" : "s"}
            </p>
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm [&>svg]:h-5 [&>svg]:w-5", tone)}>
            {icon}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function PaymentDashboardPage() {
  const {
    data: payouts = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["provider-payment-dashboard-payouts"],
    queryFn: () => getAllPayouts(),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const eurRates = useEurRates(payouts.map((p) => p.currency));
  const summary = useMemo(() => buildDashboardSummary(payouts, eurRates), [payouts, eurRates]);

  const chartData = useMemo(
    () =>
      summary.monthlyTrend
        .slice(-12)
        .map((point) => ({
          label: formatMonthLabel(point.month),
          amount: point.amount,
        })),
    [summary.monthlyTrend],
  );

  const hasTrendData = chartData.length >= 2;
  const currency = summary.currency;
  const errorMessage = error instanceof Error ? error.message : "The payout API returned an unexpected error.";
  const showLoading = isLoading || (isFetching && payouts.length === 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Provider Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track real provider payout records, payout history, and payout account setup.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<RefreshCw />}
          loading={isFetching && !showLoading}
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </div>

      {isError ? (
        <ErrorState message={errorMessage} onRetry={() => refetch()} />
      ) : showLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingCard key={index} />
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <Card>
          <EmptyState
            title="No payout data available yet"
            message="Payout records will appear here once the backend returns provider payout activity."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              label="Total Payouts"
              value={formatCurrency(summary.total.amount, currency)}
              count={summary.total.count}
              icon={<Banknote />}
              tone="bg-emerald-600 text-white"
              loading={false}
            />
            <SummaryCard
              label="Paid Payouts"
              value={formatCurrency(summary.paid.amount, currency)}
              count={summary.paid.count}
              icon={<CheckCircle2 />}
              tone="bg-green-700 text-white"
              loading={false}
            />
            <SummaryCard
              label="Pending Payouts"
              value={formatCurrency(summary.pending.amount, currency)}
              count={summary.pending.count}
              icon={<Clock3 />}
              tone="bg-amber-500 text-white"
              loading={false}
            />
            <SummaryCard
              label="Upcoming Payouts"
              value={formatCurrency(summary.upcoming.amount, currency)}
              count={summary.upcoming.count}
              icon={<Clock3 />}
              tone="bg-amber-500 text-white"
              loading={false}
            />
            <SummaryCard
              label="Processing Payouts"
              value={formatCurrency(summary.processing.amount, currency)}
              count={summary.processing.count}
              icon={<RefreshCw />}
              tone="bg-sky-600 text-white"
              loading={false}
            />
            <SummaryCard
              label="Failed Payouts"
              value={formatCurrency(summary.failed.amount, currency)}
              count={summary.failed.count}
              icon={<XCircle />}
              tone="bg-red-500 text-white"
              loading={false}
            />
            <SummaryCard
              label="Cancelled Payouts"
              value={formatCurrency(summary.cancelled.amount, currency)}
              count={summary.cancelled.count}
              icon={<XCircle />}
              tone="bg-slate-600 text-white"
              loading={false}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
            <Card>
              <SectionHeader
                title="Monthly Payout Trend"
                subtitle="Actual payout amounts grouped by payout activity month"
              />
              {hasTrendData ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="payoutTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(Number(value), currency)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#16a34a"
                        fill="url(#payoutTrend)"
                        strokeWidth={2}
                        name="Payout Amount"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="No payout trend data available yet"
                  message="We need at least two payout months before the monthly trend chart can be shown."
                />
              )}
            </Card>

            <Card>
              <SectionHeader title="Available Actions" subtitle="Primary provider payment actions" />
              <div className="grid gap-2">
                {[
                  { label: "View Payout History", href: "/dashboard/payments/payout-history", icon: <History /> },
                  { label: "Payment Settings", href: "/dashboard/payments/settings", icon: <Settings /> },
                  { label: "View Bookings", href: "/dashboard/bookings", icon: <BookOpen /> },
                  { label: "Booking Revenue Details", href: "/dashboard/payments/booking-revenue", icon: <CalendarDays /> },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-emerald-100 hover:bg-emerald-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700 transition-colors group-hover:bg-green-100 [&>svg]:h-4 [&>svg]:w-4">
                      {action.icon}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 transition-colors group-hover:text-green-800">
                      {action.label}
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 text-slate-400 transition-colors group-hover:text-green-600" />
                  </Link>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Payout Policy</p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                      Payouts are released 24 hours after guest check-in.
                      <br />
                      Platform commission is deducted before payout.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card padding="none">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Recent Payout Activity</h3>
                <p className="text-xs text-slate-500">Most recent payout records returned by the backend</p>
              </div>
              <Link href="/dashboard/payments/payout-history">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {summary.recentPayouts.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No payout data available yet"
                  message="Payout history will appear here once the backend returns payout records."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      {[
                        "Payout ID",
                        "Booking ID",
                        "Amount",
                        "Status",
                        "Scheduled Date",
                        "Paid Date",
                        "Method",
                        "Failure Reason",
                        "Action",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.recentPayouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{payout.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{payout.bookingId}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatCurrency(payoutAmount(payout), payout.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={payout.status} status={payout.status} dot />
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(payout.scheduledAt)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {payout.processedAt ? formatDate(payout.processedAt) : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {payout.merchant?.payoutMethod ?? "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <p className="max-w-[220px] truncate" title={payout.failureReason ?? "N/A"}>
                            {payout.failureReason ?? "N/A"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/payments/payout-details/${payout.id}`}>
                            <Button variant="ghost" size="xs">
                              View Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
