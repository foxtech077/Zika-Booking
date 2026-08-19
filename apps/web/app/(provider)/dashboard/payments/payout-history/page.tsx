"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  Clock3,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getAllPayouts, type Payout, type PayoutStatus } from "@/lib/payment-api";
import { useEurRates, toEur, type EurRates } from "@/lib/eurRates";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type SortDir = "asc" | "desc";
type SortKey = "id" | "bookingId" | "amount" | "status" | "scheduledAt" | "processedAt" | "payoutMethod" | "providerPayoutId" | "failureReason";

interface PayoutSummaryBucket {
  amount: number;
  count: number;
}

interface PayoutHistorySummary {
  currency: string;
  total: PayoutSummaryBucket;
  paid: PayoutSummaryBucket;
  upcoming: PayoutSummaryBucket;
  processing: PayoutSummaryBucket;
  failed: PayoutSummaryBucket;
  cancelled: PayoutSummaryBucket;
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

function extractErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message ?? (error instanceof Error ? error.message : fallback);
}

function buildSummary(payouts: Payout[], rates: EurRates): PayoutHistorySummary {
  const emptyBucket = (): PayoutSummaryBucket => ({ amount: 0, count: 0 });
  const summary: PayoutHistorySummary = {
    currency: "EUR",
    total: emptyBucket(),
    paid: emptyBucket(),
    upcoming: emptyBucket(),
    processing: emptyBucket(),
    failed: emptyBucket(),
    cancelled: emptyBucket(),
  };

  for (const payout of payouts) {
    // Convert each payout to EUR before summing — never mix currencies.
    const amount = toEur(payoutAmount(payout), payout.currency, rates) ?? 0;
    summary.total.amount += amount;
    summary.total.count += 1;

    switch (payout.status) {
      case "paid":
        summary.paid.amount += amount;
        summary.paid.count += 1;
        break;
      case "scheduled":
        summary.upcoming.amount += amount;
        summary.upcoming.count += 1;
        break;
      case "processing":
        summary.processing.amount += amount;
        summary.processing.count += 1;
        break;
      case "failed":
        summary.failed.amount += amount;
        summary.failed.count += 1;
        break;
      case "cancelled":
        summary.cancelled.amount += amount;
        summary.cancelled.count += 1;
        break;
    }
  }

  return summary;
}

function bucketTone(status: string): string {
  switch (status) {
    case "total":
      return "bg-emerald-50 border-emerald-100 text-emerald-700";
    case "paid":
      return "bg-emerald-50 border-emerald-100 text-emerald-700";
    case "scheduled":
      return "bg-amber-50 border-amber-100 text-amber-700";
    case "processing":
      return "bg-sky-50 border-sky-100 text-sky-700";
    case "failed":
      return "bg-red-50 border-red-100 text-red-600";
    case "cancelled":
      return "bg-slate-50 border-slate-100 text-slate-600";
    default:
      return "bg-slate-50 border-slate-100 text-slate-600";
  }
}

function SummaryCard({
  label,
  value,
  count,
  icon,
  tone,
}: {
  label: string;
  value: string;
  count: number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-5 shadow-sm", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-1.5 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-xs opacity-80">
            {count} payout{count === 1 ? "" : "s"}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3 transition-opacity", active ? "opacity-100 text-green-700" : "opacity-30")} />
        {active && <span className="text-[9px]">{dir === "asc" ? "^" : "v"}</span>}
      </span>
    </th>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
      <Banknote className="h-12 w-12 text-slate-200" />
      <p className="mt-4 font-semibold text-slate-700">
        {filtered ? "No results match your filters" : "No payout data available yet"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        {filtered
          ? "Try adjusting your search, date range, or status filter."
          : "Payout records will appear here after the backend returns provider payout activity."}
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
        <XCircle className="h-12 w-12 text-red-400" />
        <p className="mt-4 font-semibold text-slate-800">Unable to load payout history</p>
        <p className="mt-1 max-w-lg text-sm text-slate-500">{message}</p>
        <Button className="mt-4" variant="outline" icon={<RefreshCw />} onClick={onRetry}>
          Retry
        </Button>
      </div>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

const PAGE_SIZE = 10;

const statusOptions: Array<{ value: "all" | PayoutStatus; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const dateRangeOptions = [
  { value: "all", label: "All Time" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "year", label: "This Year" },
];

function isWithinRange(dateStr: string, range: string): boolean {
  if (range === "all") return true;
  const timestamp = new Date(dateStr).getTime();
  const now = Date.now();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  return timestamp >= now - days * 24 * 60 * 60 * 1000;
}

export default function PayoutHistoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PayoutStatus>("all");
  const [dateRange, setDateRange] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("scheduledAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const {
    data: payouts = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["provider-payout-history", statusFilter],
    queryFn: () => getAllPayouts(statusFilter === "all" ? undefined : { status: statusFilter }),
    staleTime: 2 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const eurRates = useEurRates(payouts.map((p) => p.currency));

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();

    return payouts
      .filter((payout) => {
        if (statusFilter !== "all" && payout.status !== statusFilter) return false;
        if (!text) return true;

        return [
          payout.id,
          payout.bookingId,
          payout.providerPayoutId ?? "",
          payout.failureReason ?? "",
          payout.merchant?.payoutMethod ?? "",
          payout.status,
          payout.currency,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text);
      })
      .filter((payout) => isWithinRange(payoutActivityDate(payout), dateRange))
      .sort((a, b) => {
        const getValue = (payout: Payout): string | number | null => {
          switch (sortKey) {
            case "id":
              return payout.id;
            case "bookingId":
              return payout.bookingId;
            case "amount":
              return payoutAmount(payout);
            case "status":
              return payout.status;
            case "scheduledAt":
              return payout.scheduledAt;
            case "processedAt":
              return payout.processedAt ?? "";
            case "payoutMethod":
              return payout.merchant?.payoutMethod ?? "";
            case "providerPayoutId":
              return payout.providerPayoutId ?? "";
            case "failureReason":
              return payout.failureReason ?? "";
          }
        };

        const av = getValue(a);
        const bv = getValue(b);

        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }

        const aValue = String(av ?? "").toLowerCase();
        const bValue = String(bv ?? "").toLowerCase();

        if (aValue < bValue) return sortDir === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [payouts, search, statusFilter, dateRange, sortKey, sortDir]);

  const summary = useMemo(() => buildSummary(filtered, eurRates), [filtered, eurRates]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const errorMessage = extractErrorMessage(error, "The payout history request failed.");
  const showLoading = isLoading || (isFetching && payouts.length === 0);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/payments">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payout History</h1>
            <p className="mt-0.5 text-sm text-slate-500">All provider payout records returned by the backend.</p>
          </div>
        </div>
        <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !showLoading} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {isError ? (
        <ErrorState message={errorMessage} onRetry={() => refetch()} />
      ) : (
        <>
          {!showLoading && payouts.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                label="Total Payouts"
                value={formatCurrency(summary.total.amount, summary.currency)}
                count={summary.total.count}
                icon={<Banknote />}
                tone={bucketTone("total")}
              />
              <SummaryCard
                label="Paid Payouts"
                value={formatCurrency(summary.paid.amount, summary.currency)}
                count={summary.paid.count}
                icon={<CheckCircle2 />}
                tone={bucketTone("paid")}
              />
              <SummaryCard
                label="Upcoming Payouts"
                value={formatCurrency(summary.upcoming.amount, summary.currency)}
                count={summary.upcoming.count}
                icon={<Clock3 />}
                tone={bucketTone("scheduled")}
              />
              <SummaryCard
                label="Processing Payouts"
                value={formatCurrency(summary.processing.amount, summary.currency)}
                count={summary.processing.count}
                icon={<RefreshCw />}
                tone={bucketTone("processing")}
              />
              <SummaryCard
                label="Failed Payouts"
                value={formatCurrency(summary.failed.amount, summary.currency)}
                count={summary.failed.count}
                icon={<XCircle />}
                tone={bucketTone("failed")}
              />
              <SummaryCard
                label="Cancelled Payouts"
                value={formatCurrency(summary.cancelled.amount, summary.currency)}
                count={summary.cancelled.count}
                icon={<XCircle />}
                tone={bucketTone("cancelled")}
              />
            </div>
          )}

          <Card>
            <SectionHeader title="Filter Payouts" subtitle="Search and narrow down the records you need" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
              <Input
                label="Search"
                placeholder="Payout ID, booking ID, reference, method..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                leftIcon={<Search />}
              />
              <Select
                label="Date Range"
                value={dateRange}
                onChange={(event) => {
                  setDateRange(event.target.value);
                  setPage(1);
                }}
                options={dateRangeOptions}
              />
              <Select
                label="Payout Status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as "all" | PayoutStatus);
                  setPage(1);
                }}
                options={statusOptions}
              />
            </div>
          </Card>

          <Card padding="none">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Payout Records</h3>
                <p className="text-xs text-slate-500">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"} - Page {page} of {totalPages}
                </p>
              </div>
              <Badge label={`${filtered.length} payouts`} variant="info" />
            </div>

            {showLoading ? (
              <SkeletonRows />
            ) : pageItems.length === 0 ? (
              <EmptyState filtered={filtered.length !== payouts.length} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1260px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <SortableHeader label="Payout ID" sortKey="id" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Booking ID" sortKey="bookingId" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Amount" sortKey="amount" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Status" sortKey="status" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Scheduled Date" sortKey="scheduledAt" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Paid Date" sortKey="processedAt" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Payout Method" sortKey="payoutMethod" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Provider Payout ID" sortKey="providerPayoutId" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortableHeader label="Failure Reason" sortKey="failureReason" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageItems.map((payout) => (
                      <tr key={payout.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{payout.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{payout.bookingId}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                          {formatCurrency(payoutAmount(payout), payout.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={payout.status} status={payout.status} dot />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(payout.scheduledAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {payout.processedAt ? formatDate(payout.processedAt) : "N/A"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {payout.merchant?.payoutMethod ?? "N/A"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-500">
                          {payout.providerPayoutId ?? "N/A"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <p className="max-w-[240px] truncate" title={payout.failureReason ?? "N/A"}>
                            {payout.failureReason ?? "N/A"}
                          </p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/dashboard/payments/payout-details/${payout.id}`}>
                            <Button variant="ghost" size="xs" icon={<Eye />}>
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

            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Rows per page: {PAGE_SIZE} - Total: {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ChevronLeft />}
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
