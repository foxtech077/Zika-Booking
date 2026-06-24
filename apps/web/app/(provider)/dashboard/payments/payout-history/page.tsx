"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";
import { getPayouts } from "@/lib/payment-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

// Backend enum: scheduled | processing | paid | failed | cancelled
type PayoutStatus = "scheduled" | "processing" | "paid" | "failed" | "cancelled";
type SortDir = "asc" | "desc";

interface Payout {
  id: string;
  bookingReference: string;
  listingName: string;
  grossAmount: number;
  platformCommission: number;
  netPayout: number;
  paymentMethod: string;
  payoutDate: string;
  transactionReference: string;
  status: PayoutStatus;
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



function normalizeStatus(v: unknown): PayoutStatus {
  const s = readString(v, "scheduled").toLowerCase();
  // Backend enum values: scheduled | processing | paid | failed | cancelled
  if (s === "scheduled" || s === "processing" || s === "paid" || s === "failed" || s === "cancelled") return s;
  return "scheduled";
}

function normalizePayout(raw: unknown): Payout {
  const m = raw as Record<string, unknown>;
  const id = readString(m.id ?? m._id ?? m.payoutId, crypto.randomUUID());
  // Backend Payout model: amount (Decimal), currency, bookingId, providerPayoutId, merchant.payoutMethod
  const gross = readNumber(m.amount);
  const commission = 0; // commission not stored on payout row; shown as 0
  const net = gross - commission;

  return {
    id,
    bookingReference: readString(m.bookingId, id.slice(0, 8).toUpperCase()),
    listingName: readString(undefined, "Booking"),
    grossAmount: gross,
    platformCommission: commission,
    netPayout: net,
    paymentMethod: readString(
      (m.merchant as Record<string, unknown> | undefined)?.payoutMethod,
      "Platform Wallet"
    ),
    payoutDate: readString(m.processedAt ?? m.scheduledAt ?? m.createdAt, new Date().toISOString()),
    transactionReference: readString(m.providerPayoutId, "—"),
    status: normalizeStatus(m.status),
    currency: readString(m.currency, "USD"),
  };
}

async function fetchPayoutHistory(statusFilter?: string): Promise<Payout[]> {
  // GET /provider/me/payouts — correct endpoint via paymentApi
  const params: Record<string, string | number> = { limit: 100 };
  if (statusFilter && statusFilter !== "all") params.status = statusFilter;
  const res = await getPayouts(params as Parameters<typeof getPayouts>[0]);
  return (res.data ?? []).map(normalizePayout);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

// Status options match backend PayoutStatus enum exactly
const statusOptions = [
  { value: "all",        label: "All Statuses" },
  { value: "scheduled",  label: "Scheduled" },
  { value: "processing", label: "Processing" },
  { value: "paid",       label: "Paid" },
  { value: "failed",     label: "Failed" },
  { value: "cancelled",  label: "Cancelled" },
];

const dateRangeOptions = [
  { value: "all", label: "All Time" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "year", label: "This Year" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWithinRange(dateStr: string, range: string): boolean {
  if (range === "all") return true;
  const date = new Date(dateStr).getTime();
  const now = Date.now();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  return date >= now - days * 24 * 60 * 60 * 1000;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusSummary({ payouts }: { payouts: Payout[] }) {
  const currency = payouts[0]?.currency ?? "USD";
  const completed = payouts.filter((p) => p.status === "paid");
  const pending = payouts.filter((p) => p.status === "scheduled" || p.status === "processing");
  const failed = payouts.filter((p) => p.status === "failed" || p.status === "cancelled");

  const cards = [
    {
      label: "Completed Payouts",
      count: completed.length,
      total: formatCurrency(completed.reduce((s, p) => s + p.netPayout, 0), currency),
      tone: "bg-emerald-50 border-emerald-100 text-emerald-700",
    },
    {
      label: "Pending / Scheduled",
      count: pending.length,
      total: formatCurrency(pending.reduce((s, p) => s + p.netPayout, 0), currency),
      tone: "bg-amber-50 border-amber-100 text-amber-700",
    },
    {
      label: "Failed Payouts",
      count: failed.length,
      total: formatCurrency(failed.reduce((s, p) => s + p.netPayout, 0), currency),
      tone: "bg-red-50 border-red-100 text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className={cn("rounded-2xl border p-5", c.tone)}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
          <p className="mt-1.5 text-2xl font-bold">{c.total}</p>
          <p className="mt-1 text-sm opacity-80">{c.count} payout{c.count !== 1 ? "s" : ""}</p>
        </div>
      ))}
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
  sortKey: string;
  currentSort: string;
  dir: SortDir;
  onSort: (key: string) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none whitespace-nowrap hover:text-slate-700"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3 transition-opacity", active ? "opacity-100 text-green-700" : "opacity-30")} />
        {active && <span className="text-[9px]">{dir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
      <Banknote className="h-12 w-12 text-slate-200" />
      <p className="mt-4 font-semibold text-slate-700">
        {filtered ? "No results match your filters" : "No payout history yet"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        {filtered
          ? "Try adjusting your search, date range, or status filter."
          : "Completed payout records will appear here after your first payout is processed."}
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayoutHistoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [sortKey, setSortKey] = useState("payoutDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const { data = [], isLoading, isFetching, refetch } = useQuery({
    // Include statusFilter in query key so a new request is made when filter changes
    queryKey: ["provider-payout-history", statusFilter],
    queryFn: () => fetchPayoutHistory(statusFilter),
    staleTime: 2 * 60_000,
  });

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return data
      .filter((p) => !text || [p.bookingReference, p.listingName, p.transactionReference].join(" ").toLowerCase().includes(text))
      // Status filter is applied server-side; client-side filter kept as a guard
      .filter((p) => statusFilter === "all" || p.status === statusFilter)
      .filter((p) => isWithinRange(p.payoutDate, dateRange))
      .sort((a, b) => {
        let av: string | number = a[sortKey as keyof Payout] as string | number;
        let bv: string | number = b[sortKey as keyof Payout] as string | number;
        if (typeof av === "string") av = av.toLowerCase();
        if (typeof bv === "string") bv = bv.toLowerCase();
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [data, search, statusFilter, dateRange, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/payments">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>Back</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payout History</h1>
            <p className="mt-0.5 text-sm text-slate-500">All processed and pending payouts from the platform.</p>
          </div>
        </div>
        <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* ── Status summary ── */}
      {!isLoading && data.length > 0 && <StatusSummary payouts={data} />}

      {/* ── Filters ── */}
      <Card>
        <SectionHeader title="Filter Payouts" subtitle="Narrow down by search, date, or status" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
          <Input
            label="Search"
            placeholder="Booking ref, listing, transaction…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            leftIcon={<Search />}
          />
          <Select
            label="Date Range"
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
            options={dateRangeOptions}
          />
          <Select
            label="Payout Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            options={statusOptions}
          />
        </div>
      </Card>

      {/* ── Table ── */}
      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Payout Records</h3>
            <p className="text-xs text-slate-500">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} · Page {page} of {totalPages}
            </p>
          </div>
          <Badge label={`${filtered.length} payouts`} variant="info" />
        </div>

        {isLoading ? (
          <SkeletonRows />
        ) : pageItems.length === 0 ? (
          <EmptyState filtered={filtered.length !== data.length} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <SortableHeader label="Booking Ref" sortKey="bookingReference" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Listing" sortKey="listingName" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Gross Amount" sortKey="grossAmount" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    Commission
                  </th>
                  <SortableHeader label="Net Payout" sortKey="netPayout" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    Payment Method
                  </th>
                  <SortableHeader label="Payout Date" sortKey="payoutDate" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    Transaction Ref
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map((payout) => (
                  <tr key={payout.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {payout.bookingReference}
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[180px] truncate font-medium text-slate-900">{payout.listingName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {formatCurrency(payout.grossAmount, payout.currency)}
                    </td>
                    <td className="px-4 py-3 text-red-600 whitespace-nowrap">
                      −{formatCurrency(payout.platformCommission, payout.currency)}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(payout.netPayout, payout.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {payout.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(payout.payoutDate)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {payout.transactionReference}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={payout.status} status={payout.status} dot />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/dashboard/payments/payout-details/${payout.id}`}>
                          <Button variant="ghost" size="xs" icon={<Eye />}>View Details</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<Download />}
                          onClick={() => {
                            const content = `RECEIPT - ZIKA BOOKING\n\nBooking Reference: ${payout.bookingReference}\nListing: ${payout.listingName}\nGross Amount: $${payout.grossAmount}\nPlatform Commission: $${payout.platformCommission}\nNet Payout: $${payout.netPayout}\nPayment Method: ${payout.paymentMethod}\nPayout Date: ${formatDate(payout.payoutDate)}\nTransaction Reference: ${payout.transactionReference}\nStatus: ${payout.status.toUpperCase()}\n\nThank you for partnering with Zika Booking.`;
                            const blob = new Blob([content], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `receipt_${payout.bookingReference}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                        >
                          Download Report
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Rows per page: {PAGE_SIZE} · Total: {filtered.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ChevronLeft />}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
