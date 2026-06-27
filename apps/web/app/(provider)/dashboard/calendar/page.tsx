"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Link2,
  Lock,
  Search,
  User,
  X,
  XCircle,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import type { Listing } from "@/types/provider";

type CalendarView = "month" | "week" | "day";
type BookingStatus = "pending" | "confirmed" | "cancelled" | "failed" | "completed";
type PaymentStatus = "paid" | "pending" | "failed" | "refunded";
type DateRangeFilter = "today" | "week" | "month" | "custom";

interface Booking {
  id: string;
  bookingId: string;
  customerName: string;
  phone: string;
  email: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  bookingDate: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  guestCount: number;
  totalAmount: number;
  paymentMethod: string;
  transactionId: string;
  notes: string;
  specialRequests: string;
  serviceDetails: string;
  currency: string;
}

interface BlockedDate {
  id: string;
  start: string;
  end: string;
  reason: string;
  type: "blocked" | "maintenance" | "unavailable" | "synced";
  platform?: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusStyles: Record<BookingStatus, string> = {
  pending: "border-yellow-200 bg-yellow-50 text-yellow-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-red-200 bg-red-50 text-red-800",
  failed: "border-orange-200 bg-orange-50 text-orange-800",
  completed: "border-green-200 bg-green-50 text-green-800",
};

const cancellationStatuses = new Set(["cancelled", "cancelled_by_guest", "cancelled_by_provider", "cancelled_by_system"]);

function unwrapList<T>(payload: unknown, keys: string[]): T[] {
  const root = payload as Record<string, unknown>;
  const data = root?.data as Record<string, unknown> | undefined;
  for (const source of [data, root]) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) return value as T[];
    }
    if (Array.isArray(source)) return source as T[];
  }
  return [];
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeStatus(value: unknown): BookingStatus {
  const status = safeString(value, "pending").toLowerCase();
  if (status === "pending_payment") return "pending";
  if (cancellationStatuses.has(status)) return "cancelled";
  if (["pending", "confirmed", "cancelled", "failed", "completed"].includes(status)) {
    return status as BookingStatus;
  }
  return "pending";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = safeString(value, "pending").toLowerCase();
  if (["paid", "pending", "failed", "refunded"].includes(status)) {
    return status as PaymentStatus;
  }
  return "pending";
}

function inferPaymentStatus(status: BookingStatus): PaymentStatus {
  if (status === "confirmed" || status === "completed") return "paid";
  if (status === "cancelled") return "refunded";
  if (status === "failed") return "failed";
  return "pending";
}

function getNestedString(source: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (typeof nested.name === "string") return nested.name;
      if (typeof nested.title === "string") return nested.title;
    }
  }
  return fallback;
}

function formatGuestName(fullName?: string) {
  if (!fullName) return "Guest";
  const name = fullName.trim();
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0] ?? fullName;
  const first = parts[0];
  const last = parts[parts.length - 1] ?? "";
  return `${first} ${last.charAt(0)}.`;
}

function NetCurrency({ amount, currency = "USD" }: { amount: number; currency?: string }) {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const tooltipText = "This is your earnings after ZikaBooking's 5% service fee. ZikaBooking retains the remainder.";
  return (
    <span
      className="inline-flex items-center gap-1 group relative cursor-help font-semibold text-green-600"
      title={tooltipText}
    >
      <span>{formatted}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 scale-0 rounded-lg bg-slate-950 px-2 py-1.5 text-center text-[11px] font-normal text-white shadow-xl transition-all group-hover:scale-100 origin-bottom">
        {tooltipText}
        <span className="absolute top-full left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-0.5 rotate-45 bg-slate-950" />
      </span>
    </span>
  );
}

function normalizeBooking(raw: unknown): Booking {
  const item = raw as Record<string, unknown>;
  const customer = (item.customer ?? item.guest ?? item.user ?? {}) as Record<string, unknown>;
  const payment = (item.payment ?? {}) as Record<string, unknown>;
  const listing = (item.listing ?? item.property ?? item.service ?? item.vehicle ?? {}) as Record<string, unknown>;
  const id = safeString(item.id ?? item._id ?? item.bookingId, "unknown-booking");
  const status = normalizeStatus(item.status);
  const firstName = safeString(item.guestFirstName ?? customer.firstName);
  const lastName = safeString(item.guestLastName ?? customer.lastName);
  const providerGuestName = [firstName, lastName].filter(Boolean).join(" ");
  const guestName = item.customerName ?? item.guestName ?? (providerGuestName || customer.name || customer.fullName);
  const checkIn = safeString(item.checkIn ?? item.checkInDate ?? item.startDate ?? item.start ?? item.pickupDatetime, new Date().toISOString());
  const checkOut = safeString(item.checkOut ?? item.checkOutDate ?? item.endDate ?? item.end ?? item.returnDatetime, checkIn);

  return {
    id,
    bookingId: safeString(item.bookingId ?? item.reference ?? item.code, id),
    customerName: formatGuestName(safeString(guestName, "Guest")),
    phone: safeString(item.guestPhone ?? customer.phone, "Hidden"),
    email: safeString(item.guestEmail ?? customer.email, "Hidden"),
    propertyName: getNestedString(item, ["listing", "property", "service", "vehicle", "listingTitle", "listingName", "propertyName"], "Listing"),
    checkIn,
    checkOut,
    bookingDate: safeString(item.bookingDate ?? item.createdAt ?? item.date, new Date().toISOString()),
    status,
    paymentStatus: normalizePaymentStatus(item.paymentStatus ?? payment.status ?? inferPaymentStatus(status)),
    guestCount: Number(item.guestCount ?? item.guests ?? item.adults ?? 1),
    totalAmount: Number(item.providerPayout ?? item.totalAmount ?? item.amount ?? payment.amount ?? 0),
    paymentMethod: safeString(item.paymentMethod ?? payment.method, "Not provided"),
    transactionId: safeString(item.transactionId ?? payment.transactionId ?? payment.id, "Not provided"),
    notes: safeString(item.notes, "No notes"),
    specialRequests: safeString(item.specialRequests ?? item.requests, "No special requests"),
    serviceDetails: safeString(
      item.serviceDetails ?? item.listingCategory ?? listing.name ?? listing.title,
      getNestedString(item, ["listing", "property", "service", "vehicle"], "Reservation")
    ),
    currency: safeString(item.currency, "USD"),
  };
}

function normalizeAvailabilityBooking(raw: unknown, listing?: Listing): Booking | null {
  const item = raw as Record<string, unknown>;
  const start = safeString(item.start);
  const end = safeString(item.end, start);
  if (!start) return null;
  const status = normalizeStatus(item.status);
  const id = safeString(item.id ?? item.reference, crypto.randomUUID());

  return {
    id,
    bookingId: safeString(item.reference, id),
    customerName: formatGuestName(safeString(item.guestName, "Guest")),
    phone: "Hidden",
    email: "Hidden",
    propertyName: listing?.name ?? "Selected listing",
    checkIn: start,
    checkOut: end,
    bookingDate: start,
    status,
    paymentStatus: inferPaymentStatus(status),
    guestCount: 1,
    totalAmount: 0,
    paymentMethod: "Not provided",
    transactionId: "Not provided",
    notes: "No notes",
    specialRequests: "No special requests",
    serviceDetails: listing?.category ?? "Reservation",
    currency: listing?.currency ?? "USD",
  };
}

function normalizeBlockedDate(raw: unknown): BlockedDate {
  const item = raw as Record<string, unknown>;
  return {
    id: safeString(item.id ?? item._id, crypto.randomUUID()),
    start: safeString(item.start ?? item.startDate ?? item.from, new Date().toISOString()),
    end: safeString(item.end ?? item.endDate ?? item.to ?? item.start, new Date().toISOString()),
    reason: safeString(item.reason ?? item.summary ?? item.notes, "Unavailable"),
    type: safeString(item.type ?? item.status, "blocked").toLowerCase() as BlockedDate["type"],
    platform: safeString(item.platform ?? item.source),
  };
}

function toISODate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, count: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

function getDateRange(date: Date, view: CalendarView, filter: DateRangeFilter, customFrom: string, customTo: string) {
  const base = startOfDay(date);
  if (filter === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  if (filter === "today" || view === "day") {
    const day = toISODate(base);
    return { from: day, to: day };
  }
  if (filter === "week" || view === "week") {
    const start = startOfWeek(base);
    return { from: toISODate(start), to: toISODate(addDays(start, 6)) };
  }
  const from = new Date(base.getFullYear(), base.getMonth(), 1);
  const to = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { from: toISODate(from), to: toISODate(to) };
}

function getVisibleDays(date: Date, view: CalendarView) {
  if (view === "day") return [startOfDay(date)];
  if (view === "week") {
    const start = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function dateInRange(day: string, start: string, end: string) {
  const from = toISODate(start);
  const to = toISODate(end);
  return day >= from && day <= to;
}

function bookingTouchesDay(booking: Booking, day: string) {
  return dateInRange(day, booking.checkIn, booking.checkOut);
}

function rangesOverlap(start: string, end: string, rangeStart: string, rangeEnd: string) {
  const from = toISODate(start);
  const to = toISODate(end);
  return from <= rangeEnd && to >= rangeStart;
}

function moveDate(date: Date, view: CalendarView, direction: -1 | 1) {
  const d = new Date(date);
  if (view === "day") d.setDate(d.getDate() + direction);
  if (view === "week") d.setDate(d.getDate() + direction * 7);
  if (view === "month") d.setMonth(d.getMonth() + direction);
  return d;
}

async function fetchListings() {
  const response = await listingApi.get("/listings", { params: { status: "active", limit: 50 } });
  return unwrapList<Listing>(response.data, ["listings", "items", "results"]);
}

async function fetchBookings(params: Record<string, string>) {
  try {
    const limit = 50;
    const { from, to, paymentStatus, status, search } = params;
    const apiParams: Record<string, string | number> = { offset: 0, limit };
    if (status && status !== "failed") apiParams.status = status === "pending" ? "pending_payment" : status;
    if (search) apiParams.search = search;

    const response = await listingApi.get("/provider/bookings", { params: apiParams });
    const data = response.data?.data ?? response.data;
    const total = Number(data?.total ?? 0);
    const bookings = unwrapList<unknown>(response.data, ["bookings", "items", "results"]).map(normalizeBooking);

    for (let offset = limit; offset < total; offset += limit) {
      const page = await listingApi.get("/provider/bookings", { params: { ...apiParams, offset, limit } });
      bookings.push(...unwrapList<unknown>(page.data, ["bookings", "items", "results"]).map(normalizeBooking));
    }

    return bookings.filter((booking) => {
      if (from && to && !rangesOverlap(booking.checkIn, booking.checkOut, from, to)) return false;
      if (status && booking.status !== status) return false;
      if (paymentStatus && booking.paymentStatus !== paymentStatus) return false;
      return true;
    });
  } catch {
    return [];
  }
}

async function fetchAvailability(listingId: string, from: string, to: string) {
  const response = await listingApi.get(`/provider/availability/${listingId}`, { params: { from, to } });
  const data = response.data?.data ?? response.data;
  return {
    bookedRanges: unwrapList<unknown>(data, ["bookedRanges"]),
    blockedRanges: unwrapList<unknown>(data, ["blockedRanges"]).map(normalizeBlockedDate),
  };
}

async function fetchBlockedDates(listingId: string) {
  const response = await listingApi.get(`/listings/${listingId}/blocked-dates`);
  return unwrapList<unknown>(response.data, ["blockedDates", "dates", "items", "results"]).map(normalizeBlockedDate);
}

function SummaryCard({
  label,
  count,
  icon,
  tone,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card className="min-h-[104px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{count}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", tone)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 35 }).map((_, index) => (
        <div key={index} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [selectedListing, setSelectedListing] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState<DateRangeFilter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const handleDateClick = (dayKey: string) => {
    setSelectedDate(dayKey);
  };

  const dateRange = useMemo(
    () => getDateRange(cursorDate, view, rangeFilter, customFrom, customTo),
    [cursorDate, customFrom, customTo, rangeFilter, view]
  );

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["calendar-listings"],
    queryFn: fetchListings,
  });

  const {
    data: bookings = [],
    isLoading: bookingsLoading,
  } = useQuery({
    queryKey: ["calendar-bookings", dateRange, statusFilter, paymentFilter, searchTerm],
    queryFn: () =>
      fetchBookings({
        from: dateRange.from,
        to: dateRange.to,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(paymentFilter !== "all" ? { paymentStatus: paymentFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
      }),
  });

  const selectedListingRecord = useMemo(
    () => listings.find((listing) => listing.id === selectedListing),
    [listings, selectedListing]
  );

  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ["calendar-availability", selectedListing, dateRange],
    queryFn: () => fetchAvailability(selectedListing, dateRange.from, dateRange.to),
    enabled: !!selectedListing,
  });

  const { data: blockedDates = [], isLoading: blockedLoading } = useQuery({
    queryKey: ["calendar-blocked-dates", selectedListing],
    queryFn: () => fetchBlockedDates(selectedListing),
    enabled: !!selectedListing,
  });

  const visibleDays = useMemo(() => getVisibleDays(cursorDate, view), [cursorDate, view]);
  const today = toISODate(new Date());
  const currentMonthLabel = cursorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const availabilityBookings = useMemo(
    () => (availability?.bookedRanges ?? [])
      .map((range) => normalizeAvailabilityBooking(range, selectedListingRecord))
      .filter((booking): booking is Booking => Boolean(booking)),
    [availability?.bookedRanges, selectedListingRecord]
  );
  const calendarBookings = selectedListing ? availabilityBookings : bookings;
  const calendarBlockedDates = selectedListing && availability?.blockedRanges ? availability.blockedRanges : blockedDates;
  const calendarLoading = bookingsLoading || (!!selectedListing && availabilityLoading);
  const selectedBooking = selectedBookingId ? calendarBookings.find((booking) => booking.id === selectedBookingId) : undefined;
  const selectedDateBookings = calendarBookings.filter((booking) => bookingTouchesDay(booking, selectedDate));

  const summary = useMemo(() => {
    const todayCheckIns = calendarBookings.filter((booking) => toISODate(booking.checkIn) === today).length;
    const todayCheckOuts = calendarBookings.filter((booking) => toISODate(booking.checkOut) === today).length;
    return {
      total: calendarBookings.length,
      todayCheckIns,
      todayCheckOuts,
      pending: calendarBookings.filter((booking) => booking.status === "pending").length,
      confirmed: calendarBookings.filter((booking) => booking.status === "confirmed").length,
      cancelled: calendarBookings.filter((booking) => booking.status === "cancelled").length,
    };
  }, [calendarBookings, today]);

  const showEmpty = !calendarLoading && calendarBookings.length === 0 && calendarBlockedDates.length === 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Calendar"
        subtitle="Manage reservations, availability, blocked dates, and external calendar sync."
        action={
          <Button
            variant="outline"
            icon={<CalendarDays />}
            onClick={() => {
              const next = new Date();
              setCursorDate(next);
              setSelectedDate(toISODate(next));
            }}
          >
            Today
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Bookings" count={summary.total} icon={<BookOpen />} tone="bg-green-700 text-white" />
        <SummaryCard label="Today Check-ins" count={summary.todayCheckIns} icon={<User />} tone="bg-green-700 text-white" />
        <SummaryCard label="Today Check-outs" count={summary.todayCheckOuts} icon={<Clock3 />} tone="bg-green-700 text-white" />
        <SummaryCard label="Pending Bookings" count={summary.pending} icon={<AlertCircle />} tone="bg-green-700 text-white" />
        <SummaryCard label="Confirmed" count={summary.confirmed} icon={<CheckCircle2 />} tone="bg-green-700 text-white" />
        <SummaryCard label="Cancelled" count={summary.cancelled} icon={<XCircle />} tone="bg-red-500 text-white" />
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <Input
            label="Search"
            placeholder="Booking ID, customer, or phone"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            leftIcon={<Search />}
          />
          <Select label="Booking Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={STATUS_OPTIONS} />
          <Select label="Payment Status" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} options={PAYMENT_OPTIONS} />
          <Select
            label="Date Range"
            value={rangeFilter}
            onChange={(event) => setRangeFilter(event.target.value as DateRangeFilter)}
            options={RANGE_OPTIONS}
          />
        </div>
        {rangeFilter === "custom" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="From" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            <Input label="To" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          </div>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setCursorDate((date) => moveDate(date, view, -1))} />
            <div>
              <h3 className="text-base font-bold text-slate-950">{currentMonthLabel}</h3>
              <p className="text-xs text-slate-500">{dateRange.from} to {dateRange.to}</p>
            </div>
            <Button variant="ghost" icon={<ChevronRight />} onClick={() => setCursorDate((date) => moveDate(date, view, 1))} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["month", "week", "day"] as CalendarView[]).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={cn(
                  "h-9 rounded-xl px-4 text-sm font-medium capitalize transition-colors",
                  view === item ? "bg-primary text-white" : "bg-surface-muted text-slate-600 hover:bg-slate-200"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Confirmed</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />Pending</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Cancelled</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />Blocked</span>
            </div>

            {calendarLoading ? (
              <CalendarSkeleton />
            ) : showEmpty ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                <CalendarDays className="h-12 w-12 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-900">No calendar entries scheduled</p>
                <p className="mt-1 text-sm text-slate-500">Reservations and blocked dates will appear here.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 border-y border-border bg-slate-50">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-slate-500">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {visibleDays.map((day) => {
                    const dayKey = toISODate(day);
                    const dayBookings = calendarBookings.filter((booking) => bookingTouchesDay(booking, dayKey));
                    const dayBlocks = calendarBlockedDates.filter((blocked) => dateInRange(dayKey, blocked.start, blocked.end));
                    const isToday = dayKey === today;
                    const isSelected = dayKey === selectedDate;
                    const hasExternalHold = dayBlocks.length > 0;
                    const hasBooking = dayBookings.some(b => b.status === "confirmed" || b.status === "completed");
                    const hasActiveLock = dayBookings.some(b => b.status === "pending");
                    const isOutsideMonth = view === "month" && day.getMonth() !== cursorDate.getMonth();
                    
                    let cellBgClass = "bg-white text-slate-800";
                    if (hasExternalHold) {
                      cellBgClass = "bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_8px,#f1f5f9_8px,#f1f5f9_16px)] text-slate-500 border-slate-200";
                    } else if (hasBooking) {
                      cellBgClass = "bg-emerald-600 text-white border-emerald-700";
                    } else if (hasActiveLock) {
                      cellBgClass = "bg-amber-500 text-white border-amber-600 animate-pulse-subtle";
                    }

                    return (
                      <button
                        key={dayKey}
                        onClick={() => handleDateClick(dayKey)}
                        className={cn(
                          "min-h-[116px] border-b border-r border-border p-2 text-left transition-colors relative hover:opacity-90",
                          view === "day" && "col-span-7 min-h-[300px]",
                          isOutsideMonth && !hasBooking && "opacity-40",
                          cellBgClass
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                              isToday && "bg-primary text-white",
                              isSelected && !isToday && "border border-primary text-primary"
                            )}
                          >
                            {day.getDate()}
                          </span>
                          
                          <div className="flex flex-wrap gap-1 items-center" />
                        </div>
                        <div className="space-y-1">
                          {hasExternalHold && (
                            <div className="truncate rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              Hold: {dayBlocks[0]?.platform || "iCal"}
                            </div>
                          )}
                          {dayBookings.slice(0, view === "month" ? 2 : 5).map((booking) => (
                            <div
                              key={`${booking.id}-${dayKey}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedBookingId(booking.id);
                              }}
                              className="truncate rounded-md bg-white/20 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white cursor-pointer hover:bg-white/30"
                            >
                              {booking.customerName}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <aside className="border-t border-border bg-slate-50 p-4 lg:border-l lg:border-t-0 space-y-6">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{formatDate(selectedDate)}</p>
                  <p className="text-xs text-slate-500">Availability and reservations</p>
                </div>
                <Badge label={selectedDateBookings.length ? "Partial" : "Available"} status={selectedDateBookings.length ? "pending" : "confirmed"} />
              </div>

              <div className="space-y-2">
                {selectedDateBookings.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-white p-4 text-center text-sm text-slate-500">
                    No reservations for this day.
                  </div>
                ) : (
                  selectedDateBookings.map((booking) => (
                    <div key={booking.id} className="rounded-xl border border-border bg-white p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{booking.customerName}</p>
                          <p className="text-xs text-slate-500">{booking.bookingId}</p>
                        </div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize", statusStyles[booking.status])}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{booking.propertyName}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="xs" variant="ghost" icon={<Eye />} onClick={() => setSelectedBookingId(booking.id)}>Details</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-slate-900">Availability Management</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-700">Occupied Dates</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{new Set(calendarBookings.flatMap((booking) => [toISODate(booking.checkIn), toISODate(booking.checkOut)])).size}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-xs font-medium text-slate-600">Blocked Dates</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{calendarBlockedDates.length}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs font-medium text-green-700">Synced Reservations</p>
              <p className="mt-2 text-2xl font-bold text-green-900">{calendarBlockedDates.filter((date) => date.type === "synced" || date.platform).length}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {blockedLoading || (!!selectedListing && availabilityLoading) ? (
              <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ) : calendarBlockedDates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">No blocked, maintenance, unavailable, or synced dates found.</p>
            ) : (
              calendarBlockedDates.slice(0, 5).map((blocked) => (
                <div key={blocked.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold capitalize text-slate-800">{blocked.type}</p>
                      <p className="text-xs text-slate-500">{formatDate(blocked.start)} to {formatDate(blocked.end)}</p>
                    </div>
                  </div>
                  <p className="max-w-[180px] truncate text-xs text-slate-500">{blocked.reason}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-slate-900">iCal Calendar Sync</h3>
            </div>
            <Select
              value={selectedListing}
              onChange={(event) => setSelectedListing(event.target.value)}
              options={listings.map((listing) => ({ value: listing.id, label: listing.name ?? listing.id }))}
              placeholder={listingsLoading ? "Loading listings..." : "Select listing"}
              className="sm:w-56"
            />
          </div>

          <div className="rounded-xl border border-border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Export URL</p>
            <p className="mt-2 break-all text-sm font-medium text-slate-800">
              {selectedListing ? `/listings/${selectedListing}/ical` : "Select a listing to view its iCal export endpoint."}
            </p>
            <p className="mt-2 text-xs text-slate-500">The current API list exposes iCal and blocked-date reads only. Feed import/add/sync controls are hidden until those APIs are available.</p>
          </div>

          <div className="mt-5 space-y-2">
            {!selectedListing ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">Select a listing to view connected calendar data.</p>
            ) : (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">iCal export ready</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Use the endpoint above wherever an external platform asks for the ZikaBooking calendar URL. Imported external feeds can be added here later when a feed-management API is available.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm" onClick={() => setSelectedBookingId(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Booking Details</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">{selectedBooking?.bookingId ?? selectedBookingId}</h3>
              </div>
              <Button variant="ghost" icon={<X />} onClick={() => setSelectedBookingId(null)} />
            </div>

            {!selectedBooking ? (
              <div className="flex min-h-[300px] items-center justify-center text-slate-500">
                Select a visible reservation to view details.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 font-semibold text-slate-900">Customer Details</h4>
                  <div className="space-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><User className="h-4 w-4" />{selectedBooking.customerName}</p>
                    <div className="mt-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-100">
                      All communication goes through the in-app messaging tool. No guest contact details are shown to protect privacy.
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 font-semibold text-slate-900">Booking Details</h4>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <Info label="Booking Date" value={formatDate(selectedBooking.bookingDate)} />
                    <Info label="Guest Count" value={String(selectedBooking.guestCount)} />
                    <Info label="Check-in" value={formatDate(selectedBooking.checkIn)} />
                    <Info label="Check-out" value={formatDate(selectedBooking.checkOut)} />
                    <Info label="Property / Service" value={selectedBooking.propertyName} />
                    <Info label="Service Details" value={selectedBooking.serviceDetails} />
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 font-semibold text-slate-900">Payment Details</h4>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <Info label="Net Payout" value={<NetCurrency amount={selectedBooking.totalAmount} currency={selectedBooking.currency} />} />
                    <Info label="Payment Method" value={selectedBooking.paymentMethod} />
                    <Info label="Payment Status" value={selectedBooking.paymentStatus} />
                    <Info label="Transaction ID" value={selectedBooking.transactionId} />
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 font-semibold text-slate-900">Additional Details</h4>
                  <div className="space-y-3 text-sm">
                    <Info label="Notes" value={selectedBooking.notes} />
                    <Info label="Special Requests" value={selectedBooking.specialRequests} />
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">
                  Booking status changes are managed from the bookings workflow. This calendar view only reads reservations, blocked dates, and iCal availability.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}
