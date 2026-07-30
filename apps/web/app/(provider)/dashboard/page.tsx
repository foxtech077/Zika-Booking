"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Banknote, CalendarDays, RefreshCw, Star } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const NET_TOOLTIP = "This is your earnings after ZikaBooking's 5% service fee. ZikaBooking retains the remainder.";

type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "cancelled_by_guest"
  | "cancelled_by_provider"
  | "cancelled_by_system";

interface Booking {
  id: string;
  reference: string;
  listingId: string;
  listingName: string;
  listingCategory: "hotel" | "apartment" | "car";
  guestName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rentalDays: number;
  netPayout: number;
  currency: string;
  status: BookingStatus;
  createdAt: string;
  confirmedAt: string | null;
}

interface ListingSummary {
  id: string;
  name: string;
  category: "hotel" | "apartment" | "car";
  status: string;
  currency: string;
  unitCount: number | null;
  licencePlate: string | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
}

interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
}

interface DashboardData {
  bookings: Booking[];
  listings: ListingSummary[];
  reviews: ReviewSummary;
  hasError: boolean;
}

type SortKey = "checkIn" | "listingName" | "netPayout";

function unwrap(payload: unknown) {
  const root = payload as Record<string, unknown>;
  return (root?.data as Record<string, unknown>) ?? root ?? {};
}

function unwrapList(payload: unknown, keys: string[]) {
  const data = unwrap(payload);
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  return Array.isArray(payload) ? payload : [];
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toDateOnly(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isWithin(value: string | null, from: Date, to: Date) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= from && date <= to;
}

function overlapsToday(booking: Booking) {
  const today = toDateOnly(new Date().toISOString());
  return booking.checkIn <= today && booking.checkOut >= today;
}

function activeLock(booking: Booking) {
  const created = new Date(booking.createdAt).getTime();
  return booking.status === "pending_payment" && Number.isFinite(created) && Date.now() - created < 5 * 60 * 1000;
}

function formatGuestName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Guest";
  const first = parts[0] ?? "Guest";
  const last = parts[parts.length - 1] ?? "";
  return `${first} ${last.charAt(0)}.`;
}

function normalizeBooking(raw: unknown): Booking {
  const item = raw as Record<string, unknown>;
  const first = readString(item.guestFirstName);
  const last = readString(item.guestLastName);
  const listingId = readString(item.listingId);
  const category = readString(item.listingCategory, "apartment") as Booking["listingCategory"];
  const start = category === "car" ? item.pickupDatetime : item.checkIn;
  const end = category === "car" ? item.returnDatetime : item.checkOut;

  return {
    id: readString(item.id, crypto.randomUUID()),
    reference: readString(item.reference ?? item.bookingId, "KAIN-XXXX-CC"),
    listingId,
    listingName: readString(item.listingTitle ?? item.listingName, "Listing"),
    listingCategory: category,
    guestName: formatGuestName(`${first} ${last}`.trim() || readString(item.guestName, "Guest")),
    checkIn: toDateOnly(readString(start, new Date().toISOString())),
    checkOut: toDateOnly(readString(end, new Date().toISOString())),
    guests: readNumber(item.adults) + readNumber(item.children),
    rentalDays: Math.max(1, readNumber(item.nightsOrDays, 1)),
    netPayout: readNumber(item.providerPayout),
    currency: readString(item.currency, "USD"),
    status: readString(item.status, "pending_payment") as BookingStatus,
    createdAt: readString(item.createdAt, new Date().toISOString()),
    confirmedAt: readString(item.confirmedAt) || null,
  };
}

function normalizeListing(raw: unknown): ListingSummary {
  const item = raw as Record<string, unknown>;
  return {
    id: readString(item.id, crypto.randomUUID()),
    name: readString(item.name, "Untitled listing"),
    category: readString(item.category, "apartment") as ListingSummary["category"],
    status: readString(item.status, "draft"),
    currency: readString(item.currency, "USD"),
    unitCount: item.unitCount === null || item.unitCount === undefined ? null : readNumber(item.unitCount),
    licencePlate: item.licencePlate === null || item.licencePlate === undefined ? null : readString(item.licencePlate),
    carMake: item.carMake === null || item.carMake === undefined ? null : readString(item.carMake),
    carModel: item.carModel === null || item.carModel === undefined ? null : readString(item.carModel),
    carYear: item.carYear === null || item.carYear === undefined ? null : readNumber(item.carYear),
  };
}

async function safeGet(path: string, params?: Record<string, unknown>) {
  try {
    const response = await listingApi.get(path, params ? { params } : undefined);
    return { data: response.data, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}

async function fetchAllBookings() {
  const first = await listingApi.get("/provider/bookings", { params: { offset: 0, limit: 50 } });
  const data = unwrap(first.data);
  const total = readNumber(data.total, 0);
  const bookings = unwrapList(first.data, ["bookings", "items", "results"]).map(normalizeBooking);

  for (let offset = 50; offset < total; offset += 50) {
    const page = await listingApi.get("/provider/bookings", { params: { offset, limit: 50 } });
    bookings.push(...unwrapList(page.data, ["bookings", "items", "results"]).map(normalizeBooking));
  }
  return bookings;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [listingsRes, reviewsRes, bookingsResult] = await Promise.all([
    safeGet("/provider/listings/summary"),
    safeGet("/provider/reviews", { limit: 1 }),
    fetchAllBookings().then((data) => ({ data, failed: false })).catch(() => ({ data: [] as Booking[], failed: true })),
  ]);

  const listingRows = unwrapList(listingsRes.data, ["listings", "items", "results"]);
  const listings = await Promise.all(
    listingRows.map(async (row) => {
      const base = normalizeListing(row);
      const detail = await safeGet(`/listings/${base.id}`);
      const detailData = unwrap(detail.data);
      return normalizeListing({ ...base, ...detailData });
    })
  );

  const reviewData = unwrap(reviewsRes.data);
  return {
    bookings: bookingsResult.data,
    listings,
    reviews: {
      averageRating: readNumber(reviewData.averageRating),
      totalReviews: readNumber(reviewData.totalReviews ?? reviewData.total),
    },
    hasError: listingsRes.failed || reviewsRes.failed || bookingsResult.failed,
  };
}

function NetCurrency({ amount, currency = "USD", className }: { amount: number; currency?: string; className?: string }) {
  return (
    <span className={cn("group relative inline-flex cursor-help font-semibold", className)} title={NET_TOOLTIP}>
      {formatCurrency(amount, currency)}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 scale-0 rounded-lg bg-slate-950 px-2 py-1.5 text-center text-[11px] font-normal text-white shadow-xl transition-all group-hover:scale-100">
        {NET_TOOLTIP}
      </span>
    </span>
  );
}

function MetricCard({ label, value, hint, financial }: { label: string; value: ReactNode; hint: string; financial?: boolean }) {
  return (
    <Card className="min-h-[132px]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3 text-2xl font-bold text-slate-950">{financial ? <span title={NET_TOOLTIP}>{value}</span> : value}</div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{hint}</p>
    </Card>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default function ProviderDashboardPage() {
  const [sortKey, setSortKey] = useState<SortKey>("checkIn");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [listingFilter, setListingFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data = { bookings: [], listings: [], reviews: { averageRating: 0, totalReviews: 0 }, hasError: false }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-dashboard-prd"],
    queryFn: fetchDashboardData,
  });

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const lastMonth = addMonths(now, -1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const confirmedStatuses = new Set<BookingStatus>(["confirmed", "completed"]);
  const cancelledStatuses = new Set<BookingStatus>(["cancelled_by_guest", "cancelled_by_provider", "cancelled_by_system"]);
  const completedBookings = data.bookings.filter((booking) => booking.status === "completed");
  const confirmedBookings = data.bookings.filter((booking) => confirmedStatuses.has(booking.status));

  const primaryCurrency = data.bookings.find((booking) => booking.currency)?.currency ?? data.listings.find((listing) => listing.currency)?.currency ?? "USD";
  const metrics = {
    netAllTime: completedBookings.reduce((sum, booking) => sum + booking.netPayout, 0),
    netThisMonth: completedBookings.filter((booking) => isWithin(booking.confirmedAt ?? booking.createdAt, currentMonthStart, currentMonthEnd)).reduce((sum, booking) => sum + booking.netPayout, 0),
    netLastMonth: completedBookings.filter((booking) => isWithin(booking.confirmedAt ?? booking.createdAt, lastMonthStart, lastMonthEnd)).reduce((sum, booking) => sum + booking.netPayout, 0),
    pendingPayout: data.bookings.filter((booking) => booking.status === "confirmed" && new Date(booking.checkIn) <= now).reduce((sum, booking) => sum + booking.netPayout, 0),
    totalBookings: confirmedBookings.length,
    bookingsThisMonth: confirmedBookings.filter((booking) => isWithin(booking.confirmedAt ?? booking.createdAt, currentMonthStart, currentMonthEnd)).length,
    cancellationRate: (() => {
      const recent = data.bookings.filter((booking) => new Date(booking.createdAt) >= ninetyDaysAgo);
      if (!recent.length) return 0;
      return (recent.filter((booking) => cancelledStatuses.has(booking.status)).length / recent.length) * 100;
    })(),
    averageRating: data.reviews.averageRating,
  };

  const upcomingBookings = useMemo(() => {
    const today = toDateOnly(new Date().toISOString());
    const filtered = data.bookings.filter((booking) => {
      if (!["confirmed"].includes(booking.status)) return false;
      if (booking.checkIn < today) return false;
      if (listingFilter !== "all" && booking.listingId !== listingFilter) return false;
      if (fromDate && booking.checkIn < fromDate) return false;
      if (toDate && booking.checkIn > toDate) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const direction = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "listingName") return a.listingName.localeCompare(b.listingName) * direction;
      if (sortKey === "netPayout") return (a.netPayout - b.netPayout) * direction;
      return a.checkIn.localeCompare(b.checkIn) * direction;
    });
  }, [data.bookings, fromDate, listingFilter, sortKey, sortOrder, toDate]);

  const availableUnits = useMemo(() => {
    return data.listings.map((listing) => {
      const listingBookings = data.bookings.filter((booking) => booking.listingId === listing.id);
      const booked = listingBookings.filter((booking) => booking.status === "confirmed" && overlapsToday(booking)).length;
      const held = listingBookings.filter((booking) => activeLock(booking) && overlapsToday(booking)).length;
      const total = listing.category === "hotel" ? listing.unitCount ?? 1 : 1;
      return {
        ...listing,
        totalUnits: total,
        booked,
        held,
        available: Math.max(0, total - booked - held),
      };
    });
  }, [data.bookings, data.listings]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Provider Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">All financial figures are net amounts after ZikaBooking&apos;s 5% service fee.</p>
        </div>
        <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {data.hasError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some provider data could not be loaded. The dashboard is showing the available scoped records only.
        </div>
      )}

      <section className="space-y-4">
        <SectionHeader title="Financial Summary" subtitle="Provider-scoped earnings and booking performance." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Net revenue - all time" financial value={<NetCurrency amount={metrics.netAllTime} currency={primaryCurrency} />} hint="Sum of completed payouts received, after commission and taxes." />
          <MetricCard label="Net revenue - this month" financial value={<NetCurrency amount={metrics.netThisMonth} currency={primaryCurrency} />} hint="Current calendar month earnings, net of commission." />
          <MetricCard label="Net revenue - last month" financial value={<NetCurrency amount={metrics.netLastMonth} currency={primaryCurrency} />} hint="Prior calendar month earnings for comparison." />
          <MetricCard label="Pending payout" financial value={<NetCurrency amount={metrics.pendingPayout} currency={primaryCurrency} />} hint="Check-in has occurred, but payout has not yet been disbursed." />
          <MetricCard label="Total bookings - all time" value={metrics.totalBookings.toLocaleString()} hint="All confirmed bookings across your listings." />
          <MetricCard label="Bookings - this month" value={metrics.bookingsThisMonth.toLocaleString()} hint="Confirmed bookings in the current calendar month." />
          <MetricCard label="Cancellation rate" value={`${metrics.cancellationRate.toFixed(1)}%`} hint="Cancelled bookings as a percentage of bookings in the last 90 days." />
          <MetricCard label="Average rating" value={<span className="inline-flex items-center gap-2"><Star className="h-5 w-5 fill-amber-400 text-amber-400" />{metrics.averageRating.toFixed(1)}</span>} hint="Mean star rating across listings, weighted by review count." />
        </div>
      </section>

      <Card>
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader title="Upcoming Bookings" subtitle="Future confirmed or active bookings across your listings." />
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[620px]">
            <Select
              label="Listing"
              value={listingFilter}
              onChange={(event) => setListingFilter(event.target.value)}
              options={[{ value: "all", label: "All listings" }, ...data.listings.map((listing) => ({ value: listing.id, label: listing.name }))]}
            />
            <Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        ) : upcomingBookings.length === 0 ? (
          <EmptyState title="No upcoming bookings" message="Future confirmed bookings will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Booking Reference</th>
                  <th className="px-3 py-3"><button onClick={() => toggleSort("listingName")}>Listing Name</button></th>
                  <th className="px-3 py-3">Guest Display Name</th>
                  <th className="px-3 py-3"><button onClick={() => toggleSort("checkIn")}>Check-in Date</button></th>
                  <th className="px-3 py-3">Check-out Date</th>
                  <th className="px-3 py-3">Guests / Rental Days</th>
                  <th className="px-3 py-3"><button onClick={() => toggleSort("netPayout")}>Net Payout Amount</button></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{booking.reference}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{booking.listingName}</td>
                    <td className="px-3 py-3 text-slate-700">{booking.guestName}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(booking.checkIn)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(booking.checkOut)}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {booking.listingCategory === "car" ? `${booking.rentalDays} rental day${booking.rentalDays === 1 ? "" : "s"}` : `${Math.max(1, booking.guests)} guest${Math.max(1, booking.guests) === 1 ? "" : "s"}`}
                    </td>
                    <td className="px-3 py-3"><NetCurrency amount={booking.netPayout} currency={booking.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Available Units" subtitle="Per-listing availability right now. Click a listing to open its calendar." />
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
        ) : availableUnits.length === 0 ? (
          <EmptyState title="No listings" message="Create a listing to track availability." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Listing Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3 text-center">Total Units</th>
                  <th className="px-3 py-3 text-center">Units Currently Booked</th>
                  <th className="px-3 py-3 text-center">Units Held</th>
                  <th className="px-3 py-3 text-center">Units Available Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {availableUnits.map((listing) => (
                  <tr key={listing.id} className="group hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <Link href={`/dashboard/calendar?listing=${listing.id}`} className="inline-flex items-center gap-2 font-semibold text-slate-900 group-hover:text-green-800">
                        {listing.name}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      {listing.category === "car" && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{[listing.carYear, listing.carMake, listing.carModel].filter(Boolean).join(" ") || "Vehicle"}</span>
                          {listing.licencePlate && <span className="font-mono uppercase">{listing.licencePlate}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3"><Badge label={listing.category} /></td>
                    <td className="px-3 py-3 text-center font-semibold">{listing.totalUnits}</td>
                    <td className="px-3 py-3 text-center font-semibold text-emerald-700">{listing.booked}</td>
                    <td className="px-3 py-3 text-center font-semibold text-amber-700">{listing.held}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", listing.available > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>
                        {listing.available}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Guest contact details are not shown. Provider communication must happen through in-app messaging only.
      </div>
    </div>
  );
}
