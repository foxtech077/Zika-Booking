"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  ReceiptText,
  RefreshCw,
  Search,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BookingRevenue {
  id: string;
  bookingReference: string;
  listingName: string;
  guestName: string;
  bookingDate: string;
  checkIn: string;
  checkOut: string;
  bookingAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  netProviderEarnings: number;
  payoutStatus: string;
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

function unwrap(payload: unknown): Record<string, unknown> {
  const root = payload as Record<string, unknown>;
  return (root?.data as Record<string, unknown>) ?? root ?? {};
}

function normalizeRevenue(raw: unknown): BookingRevenue {
  const m = raw as Record<string, unknown>;
  const booking = (m.booking ?? {}) as Record<string, unknown>;
  const listing = (m.listing ?? m.property ?? {}) as Record<string, unknown>;
  const guest = (m.guest ?? m.customer ?? {}) as Record<string, unknown>;
  const id = readString(m.id ?? m._id ?? m.bookingId, crypto.randomUUID());
  const amount = readNumber(m.bookingAmount ?? m.totalAmount ?? m.amount ?? booking.totalAmount);
  const commissionPct = readNumber(m.commissionPercentage ?? m.platformCommissionRate, 15);
  const commission = readNumber(m.commissionAmount ?? m.platformCommission ?? m.commission, (amount * commissionPct) / 100);
  const net = readNumber(m.netProviderEarnings ?? m.netEarnings ?? m.providerPayout, amount - commission);

  return {
    id,
    bookingReference: readString(m.bookingReference ?? m.bookingId ?? booking.reference, id.slice(0, 8).toUpperCase()),
    listingName: readString(m.listingName ?? listing.name ?? listing.title ?? m.propertyName, "Listing"),
    guestName: readString(m.guestName ?? guest.name ?? guest.fullName ?? booking.guestName, "Guest"),
    bookingDate: readString(m.bookingDate ?? booking.createdAt ?? m.createdAt, new Date().toISOString()),
    checkIn: readString(m.checkIn ?? booking.checkIn ?? booking.checkInDate, ""),
    checkOut: readString(m.checkOut ?? booking.checkOut ?? booking.checkOutDate, ""),
    bookingAmount: amount,
    commissionPercentage: commissionPct,
    commissionAmount: commission,
    netProviderEarnings: net,
    payoutStatus: readString(m.payoutStatus ?? m.status, "pending"),
    currency: readString(m.currency, "USD"),
  };
}

async function fetchBookingRevenue(): Promise<BookingRevenue[]> {
  try {
    const res = await listingApi.get("/provider/payments/booking-revenue");
    const data = unwrap(res.data);
    const list = Array.isArray(data.bookings)
      ? data.bookings
      : Array.isArray(data.revenue)
        ? data.revenue
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(res.data)
            ? res.data
            : [];
    return list.map(normalizeRevenue);
  } catch {
    return [];
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RevenueSummary({ items }: { items: BookingRevenue[] }) {
  const currency = items[0]?.currency ?? "USD";
  const totalGross = items.reduce((s, i) => s + i.bookingAmount, 0);
  const totalCommission = items.reduce((s, i) => s + i.commissionAmount, 0);
  const totalNet = items.reduce((s, i) => s + i.netProviderEarnings, 0);
  const avgCommissionRate =
    items.length > 0
      ? items.reduce((s, i) => s + i.commissionPercentage, 0) / items.length
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Total Booking Revenue", value: formatCurrency(totalGross, currency), tone: "bg-indigo-50 border-indigo-100 text-indigo-700" },
        { label: "Total Commission Deducted", value: formatCurrency(totalCommission, currency), tone: "bg-red-50 border-red-100 text-red-600" },
        { label: "Total Net Provider Earnings", value: formatCurrency(totalNet, currency), tone: "bg-emerald-50 border-emerald-100 text-emerald-700" },
        { label: "Avg. Commission Rate", value: `${avgCommissionRate.toFixed(1)}%`, tone: "bg-amber-50 border-amber-100 text-amber-700" },
      ].map((c) => (
        <div key={c.label} className={`rounded-2xl border p-5 ${c.tone}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
          <p className="mt-2 text-2xl font-bold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
      <ReceiptText className="h-12 w-12 text-slate-200" />
      <p className="mt-4 font-semibold text-slate-700">
        {filtered ? "No results match your filters" : "No booking revenue yet"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        {filtered
          ? "Try adjusting your search or status filter."
          : "Booking revenue details will appear here after your first confirmed booking."}
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

export default function BookingRevenuePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-booking-revenue"],
    queryFn: fetchBookingRevenue,
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return data
      .filter((item) =>
        !text ||
        [item.bookingReference, item.listingName, item.guestName].join(" ").toLowerCase().includes(text)
      )
      .filter((item) => statusFilter === "all" || item.payoutStatus === statusFilter);
  }, [data, search, statusFilter]);

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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Booking Revenue Details</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Per-booking revenue breakdown with commission and net provider earnings.
            </p>
          </div>
        </div>
        <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* ── Summary ── */}
      {!isLoading && data.length > 0 && <RevenueSummary items={filtered.length > 0 ? filtered : data} />}

      {/* ── Filters ── */}
      <Card>
        <SectionHeader title="Filter Bookings" subtitle="Search or filter by status" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px]">
          <Input
            label="Search"
            placeholder="Booking ref, listing name, guest…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            leftIcon={<Search />}
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
            <h3 className="font-semibold text-slate-900">Booking Revenue</h3>
            <p className="text-xs text-slate-500">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""} · Page {page} of {totalPages}
            </p>
          </div>
          <Badge label={`${filtered.length} bookings`} variant="info" />
        </div>

        {isLoading ? (
          <SkeletonRows />
        ) : pageItems.length === 0 ? (
          <EmptyState filtered={filtered.length !== data.length} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  {[
                    "Booking Ref",
                    "Listing",
                    "Guest",
                    "Booking Date",
                    "Check-in",
                    "Check-out",
                    "Booking Amount",
                    "Commission %",
                    "Commission Amount",
                    "Net Provider Earnings",
                    "Payout Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {item.bookingReference}
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[160px] truncate font-semibold text-slate-900">{item.listingName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.guestName}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(item.bookingDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {item.checkIn ? formatDate(item.checkIn) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {item.checkOut ? formatDate(item.checkOut) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(item.bookingAmount, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {item.commissionPercentage.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-red-600 font-medium whitespace-nowrap">
                      −{formatCurrency(item.commissionAmount, item.currency)}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(item.netProviderEarnings, item.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={item.payoutStatus} status={item.payoutStatus} dot />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/bookings?ref=${item.bookingReference}`}>
                        <Button variant="ghost" size="xs" icon={<Eye />}>View</Button>
                      </Link>
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
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, Math.max(1, filtered.length))}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
