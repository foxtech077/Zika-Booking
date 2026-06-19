"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  MessageSquare,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type PayoutStatus = "pending" | "scheduled" | "processing" | "completed" | "failed";
type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed";

interface UpcomingEarning {
  id: string;
  bookingReference: string;
  guestName: string;
  listingName: string;
  listingType: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  bookingStatus: BookingStatus;
  grossAmount: number;
  platformCommission: number;
  commissionRate: number;
  netEarnings: number;
  expectedPayoutDate: string;
  payoutStatus: PayoutStatus;
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

function normalizePayoutStatus(v: unknown): PayoutStatus {
  const s = readString(v, "pending").toLowerCase();
  if (s === "scheduled" || s === "processing" || s === "completed" || s === "failed") return s;
  return "pending";
}

function normalizeBookingStatus(v: unknown): BookingStatus {
  const s = readString(v, "confirmed").toLowerCase();
  if (s === "pending" || s === "cancelled" || s === "completed") return s;
  return "confirmed";
}

function normalizeEarning(raw: unknown): UpcomingEarning {
  const m = raw as Record<string, unknown>;
  const booking = (m.booking ?? {}) as Record<string, unknown>;
  const listing = (m.listing ?? m.property ?? {}) as Record<string, unknown>;
  const guest = (m.guest ?? m.customer ?? {}) as Record<string, unknown>;
  const id = readString(m.id ?? m._id ?? m.bookingId, crypto.randomUUID());
  const gross = readNumber(m.grossAmount ?? m.totalAmount ?? m.amount ?? booking.totalAmount);
  const commissionRate = readNumber(m.commissionRate ?? m.platformCommissionRate, 15);
  const commission = readNumber(m.platformCommission ?? m.commission ?? m.fees, (gross * commissionRate) / 100);
  const net = readNumber(m.netEarnings ?? m.providerPayout ?? m.netPayout, gross - commission);

  return {
    id,
    bookingReference: readString(m.bookingReference ?? m.bookingId ?? booking.reference ?? booking.id, id.slice(0, 8).toUpperCase()),
    guestName: readString(m.guestName ?? m.customerName ?? guest.name ?? guest.fullName, "Guest"),
    listingName: readString(m.listingName ?? m.propertyName ?? listing.name ?? listing.title, "Listing"),
    listingType: readString(m.listingType ?? m.propertyType ?? listing.type ?? listing.category, "Property"),
    checkIn: readString(m.checkIn ?? m.checkInDate ?? booking.checkIn, new Date().toISOString()),
    checkOut: readString(m.checkOut ?? m.checkOutDate ?? booking.checkOut, new Date().toISOString()),
    guestCount: readNumber(m.guestCount ?? m.guests ?? booking.guestCount, 1),
    bookingStatus: normalizeBookingStatus(m.bookingStatus ?? m.status ?? booking.status),
    grossAmount: gross,
    platformCommission: commission,
    commissionRate,
    netEarnings: net,
    expectedPayoutDate: readString(m.expectedPayoutDate ?? m.payoutDate ?? m.estimatedPayoutDate, ""),
    payoutStatus: normalizePayoutStatus(m.payoutStatus ?? m.earningStatus),
    currency: readString(m.currency, "USD"),
  };
}

async function fetchUpcomingEarnings(): Promise<UpcomingEarning[]> {
  try {
    const res = await listingApi.get("/provider/payments/upcoming-earnings");
    const data = unwrap(res.data);
    const list = Array.isArray(data.earnings)
      ? data.earnings
      : Array.isArray(data.upcomingEarnings)
        ? data.upcomingEarnings
        : Array.isArray(data.bookings)
          ? data.bookings
          : Array.isArray(res.data)
            ? res.data
            : [];
    return list.map(normalizeEarning);
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

function SummaryBar({
  items,
  loading,
}: {
  items: UpcomingEarning[];
  loading: boolean;
}) {
  const gross = items.reduce((s, i) => s + i.grossAmount, 0);
  const commission = items.reduce((s, i) => s + i.platformCommission, 0);
  const net = items.reduce((s, i) => s + i.netEarnings, 0);
  const currency = items[0]?.currency ?? "USD";

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { label: "Total Gross Amount", value: formatCurrency(gross, currency), tone: "bg-indigo-50 text-indigo-700 border-indigo-100" },
        { label: "Total Commission", value: formatCurrency(commission, currency), tone: "bg-red-50 text-red-600 border-red-100" },
        { label: "Expected Net Earnings", value: formatCurrency(net, currency), tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
      ].map((card) => (
        <div key={card.label} className={cn("rounded-2xl border p-5", card.tone)}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
          <p className="mt-2 text-2xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
      <CalendarDays className="h-12 w-12 text-slate-200" />
      <p className="mt-4 font-semibold text-slate-700">
        {filtered ? "No results match your filters" : "No upcoming earnings"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        {filtered
          ? "Try adjusting your search or status filter."
          : "Upcoming earning records will appear here once bookings are confirmed."}
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-4">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UpcomingEarningsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-upcoming-earnings"],
    queryFn: fetchUpcomingEarnings,
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchSearch = !text || [item.bookingReference, item.guestName, item.listingName].join(" ").toLowerCase().includes(text);
      const matchStatus = statusFilter === "all" || item.payoutStatus === statusFilter;
      return matchSearch && matchStatus;
    });
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upcoming Booking Earnings</h1>
            <p className="mt-0.5 text-sm text-slate-500">Expected provider earnings from confirmed upcoming bookings.</p>
          </div>
        </div>
        <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* ── Payout info banner ── */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <span>
          Earnings become eligible for payout after guest check-in is completed and the T+24h holding period passes.
          Platform commission is automatically deducted before release.
        </span>
      </div>

      {/* ── Summary totals ── */}
      <SummaryBar items={filtered} loading={isLoading} />

      {/* ── Filters ── */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px]">
          <Input
            label="Search"
            placeholder="Booking ref, guest name, or listing…"
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
            <h3 className="font-semibold text-slate-900">Upcoming Earnings</h3>
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
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  {[
                    "Booking Ref",
                    "Guest",
                    "Listing",
                    "Check-in / Check-out",
                    "Guests",
                    "Status",
                    "Gross Amount",
                    "Commission",
                    "Net Earnings",
                    "Expected Payout",
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
                      <p className="font-medium text-slate-900 whitespace-nowrap">{item.guestName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[160px] truncate font-semibold text-slate-900">{item.listingName}</p>
                      <p className="text-xs capitalize text-slate-400">{item.listingType}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <p className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(item.checkIn)}
                      </p>
                      <p className="flex items-center gap-1 mt-0.5">
                        <CalendarDays className="h-3 w-3 opacity-0" />
                        {formatDate(item.checkOut)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Users className="h-3.5 w-3.5" />
                        {item.guestCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={item.bookingStatus} status={item.bookingStatus} dot />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(item.grossAmount, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-red-600 whitespace-nowrap">
                      <span className="font-medium">−{formatCurrency(item.platformCommission, item.currency)}</span>
                      <p className="text-[10px] text-slate-400">{item.commissionRate}%</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(item.netEarnings, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {item.expectedPayoutDate ? (
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          {formatDate(item.expectedPayoutDate)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={item.payoutStatus} status={item.payoutStatus} dot />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/dashboard/bookings?ref=${item.bookingReference}`}>
                          <Button variant="ghost" size="xs">View Booking</Button>
                        </Link>
                        <Link href={`/dashboard/messaging`}>
                          <Button variant="ghost" size="xs" icon={<MessageSquare />} />
                        </Link>
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
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
