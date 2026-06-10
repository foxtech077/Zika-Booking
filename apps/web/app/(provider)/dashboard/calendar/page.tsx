"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  Filter,
  Link2,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
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
}

interface IcalFeed {
  id: string;
  name: string;
  url: string;
  platform: string;
  lastSyncAt?: string;
  status: "active" | "syncing" | "failed" | "paused" | "synced";
}

interface BlockedDate {
  id: string;
  start: string;
  end: string;
  reason: string;
  type: "blocked" | "maintenance" | "unavailable" | "synced";
  platform?: string;
}

interface Notice {
  type: "success" | "error";
  message: string;
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

const PLATFORM_OPTIONS = [
  { value: "Airbnb", label: "Airbnb" },
  { value: "Booking.com", label: "Booking.com" },
  { value: "Google Calendar", label: "Google Calendar" },
  { value: "Custom iCal URL", label: "Custom iCal URL" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusStyles: Record<BookingStatus, string> = {
  pending: "border-yellow-200 bg-yellow-50 text-yellow-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-red-200 bg-red-50 text-red-800",
  failed: "border-orange-200 bg-orange-50 text-orange-800",
  completed: "border-blue-200 bg-blue-50 text-blue-800",
};

const eventDotStyles: Record<BookingStatus, string> = {
  pending: "bg-yellow-500",
  confirmed: "bg-emerald-500",
  cancelled: "bg-red-500",
  failed: "bg-orange-500",
  completed: "bg-blue-500",
};

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

function normalizeBooking(raw: unknown): Booking {
  const item = raw as Record<string, unknown>;
  const customer = (item.customer ?? item.guest ?? item.user ?? {}) as Record<string, unknown>;
  const payment = (item.payment ?? {}) as Record<string, unknown>;
  const listing = (item.listing ?? item.property ?? item.service ?? item.vehicle ?? {}) as Record<string, unknown>;
  const id = safeString(item.id ?? item._id ?? item.bookingId, "unknown-booking");

  return {
    id,
    bookingId: safeString(item.bookingId ?? item.reference ?? item.code, id),
    customerName: safeString(
      item.customerName ?? item.guestName ?? customer.name ?? customer.fullName,
      "Guest"
    ),
    phone: safeString(item.phone ?? customer.phone ?? customer.mobile, "Not provided"),
    email: safeString(item.email ?? customer.email, "Not provided"),
    propertyName: getNestedString(item, ["listing", "property", "service", "vehicle", "listingName", "propertyName"], "Listing"),
    checkIn: safeString(item.checkIn ?? item.checkInDate ?? item.startDate ?? item.start, new Date().toISOString()),
    checkOut: safeString(item.checkOut ?? item.checkOutDate ?? item.endDate ?? item.end, new Date().toISOString()),
    bookingDate: safeString(item.bookingDate ?? item.createdAt ?? item.date, new Date().toISOString()),
    status: normalizeStatus(item.status),
    paymentStatus: normalizePaymentStatus(item.paymentStatus ?? payment.status),
    guestCount: Number(item.guestCount ?? item.guests ?? item.adults ?? 1),
    totalAmount: Number(item.totalAmount ?? item.amount ?? payment.amount ?? 0),
    paymentMethod: safeString(item.paymentMethod ?? payment.method, "Not provided"),
    transactionId: safeString(item.transactionId ?? payment.transactionId ?? payment.id, "Not provided"),
    notes: safeString(item.notes, "No notes"),
    specialRequests: safeString(item.specialRequests ?? item.requests, "No special requests"),
    serviceDetails: safeString(
      item.serviceDetails ?? listing.name ?? listing.title,
      getNestedString(item, ["listing", "property", "service", "vehicle"], "Reservation")
    ),
  };
}

function normalizeFeed(raw: unknown): IcalFeed {
  const item = raw as Record<string, unknown>;
  return {
    id: safeString(item.id ?? item._id ?? item.feedId, crypto.randomUUID()),
    name: safeString(item.name ?? item.feedName, "External Calendar"),
    url: safeString(item.url ?? item.feedUrl, ""),
    platform: safeString(item.platform ?? item.source, "Custom iCal URL"),
    lastSyncAt: safeString(item.lastSyncAt ?? item.lastSyncTime ?? item.updatedAt),
    status: safeString(item.status ?? item.syncStatus, "active").toLowerCase() as IcalFeed["status"],
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

function moveDate(date: Date, view: CalendarView, direction: -1 | 1) {
  const d = new Date(date);
  if (view === "day") d.setDate(d.getDate() + direction);
  if (view === "week") d.setDate(d.getDate() + direction * 7);
  if (view === "month") d.setMonth(d.getMonth() + direction);
  return d;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

async function fetchListings() {
  const response = await listingApi.get("/listings", { params: { status: "active", limit: 50 } });
  return unwrapList<Listing>(response.data, ["listings", "items", "results"]);
}

async function fetchBookings(params: Record<string, string>) {
  try {
    const response = await api.get("/guests/me/bookings", { params });
    return unwrapList<unknown>(response.data, ["bookings", "items", "results"]).map(normalizeBooking);
  } catch {
    return [];
  }
}

async function fetchBookingDetails(id: string) {
  const response = await api.get(`/guests/me/bookings/${id}`);
  return normalizeBooking((response.data?.data ?? response.data) as unknown);
}

async function fetchIcalFeeds(listingId: string) {
  const response = await listingApi.get(`/listings/${listingId}/ical-feeds`);
  return unwrapList<unknown>(response.data, ["feeds", "icalFeeds", "items", "results"]).map(normalizeFeed);
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
          <p className="text-xs font-medium text-slate-500">{label}</p>
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
  const queryClient = useQueryClient();
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [feedForm, setFeedForm] = useState({ name: "", url: "", platform: "Airbnb" });

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
        page: "1",
        limit: "100",
        from: dateRange.from,
        to: dateRange.to,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(paymentFilter !== "all" ? { paymentStatus: paymentFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
      }),
  });

  const { data: selectedBooking, isLoading: detailsLoading } = useQuery({
    queryKey: ["calendar-booking-details", selectedBookingId],
    queryFn: () => fetchBookingDetails(selectedBookingId!),
    enabled: !!selectedBookingId,
  });

  const { data: feeds = [], isLoading: feedsLoading } = useQuery({
    queryKey: ["calendar-ical-feeds", selectedListing],
    queryFn: () => fetchIcalFeeds(selectedListing),
    enabled: !!selectedListing,
  });

  const { data: blockedDates = [], isLoading: blockedLoading } = useQuery({
    queryKey: ["calendar-blocked-dates", selectedListing],
    queryFn: () => fetchBlockedDates(selectedListing),
    enabled: !!selectedListing,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "confirm" | "cancel" | "fail" }) => {
      if (action === "confirm") return api.patch(`/bookings/${id}/confirm`);
      if (action === "fail") return api.patch(`/bookings/${id}/fail`);
      return api.post(`/provider/bookings/${id}/cancel`);
    },
    onSuccess: (_, variables) => {
      setNotice({ type: "success", message: `Booking ${variables.action} action completed.` });
      queryClient.invalidateQueries({ queryKey: ["calendar-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-booking-details"] });
    },
    onError: () => setNotice({ type: "error", message: "Booking action failed. Please try again." }),
  });

  const addFeedMutation = useMutation({
    mutationFn: () =>
      listingApi.post(`/listings/${selectedListing}/ical-feeds`, {
        name: feedForm.name,
        feedName: feedForm.name,
        url: feedForm.url,
        feedUrl: feedForm.url,
        platform: feedForm.platform,
        source: feedForm.platform,
      }),
    onSuccess: () => {
      setFeedForm({ name: "", url: "", platform: "Airbnb" });
      setNotice({ type: "success", message: "iCal feed added." });
      queryClient.invalidateQueries({ queryKey: ["calendar-ical-feeds", selectedListing] });
    },
    onError: () => setNotice({ type: "error", message: "Could not add iCal feed." }),
  });

  const deleteFeedMutation = useMutation({
    mutationFn: (feedId: string) => listingApi.delete(`/listings/${selectedListing}/ical-feeds/${feedId}`),
    onSuccess: () => {
      setNotice({ type: "success", message: "iCal feed removed." });
      queryClient.invalidateQueries({ queryKey: ["calendar-ical-feeds", selectedListing] });
    },
    onError: () => setNotice({ type: "error", message: "Could not delete iCal feed." }),
  });

  const syncFeedMutation = useMutation({
    mutationFn: (feedId: string) => listingApi.post(`/listings/${selectedListing}/ical-feeds/${feedId}/sync`),
    onSuccess: () => {
      setNotice({ type: "success", message: "Calendar sync started." });
      queryClient.invalidateQueries({ queryKey: ["calendar-ical-feeds", selectedListing] });
      queryClient.invalidateQueries({ queryKey: ["calendar-blocked-dates", selectedListing] });
    },
    onError: () => setNotice({ type: "error", message: "Calendar sync failed." }),
  });

  const visibleDays = useMemo(() => getVisibleDays(cursorDate, view), [cursorDate, view]);
  const today = toISODate(new Date());
  const currentMonthLabel = cursorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedDateBookings = bookings.filter((booking) => bookingTouchesDay(booking, selectedDate));

  const summary = useMemo(() => {
    const todayCheckIns = bookings.filter((booking) => toISODate(booking.checkIn) === today).length;
    const todayCheckOuts = bookings.filter((booking) => toISODate(booking.checkOut) === today).length;
    return {
      total: bookings.length,
      todayCheckIns,
      todayCheckOuts,
      pending: bookings.filter((booking) => booking.status === "pending").length,
      confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
      cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
    };
  }, [bookings, today]);

  const showEmpty = !bookingsLoading && bookings.length === 0;

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

      {notice && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          <span className="flex items-center gap-2">
            {notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {notice.message}
          </span>
          <button onClick={() => setNotice(null)} className="rounded-lg p-1 hover:bg-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Total Bookings" count={summary.total} icon={<BookOpen />} tone="bg-slate-100 text-slate-700" />
        <SummaryCard label="Today Check-ins" count={summary.todayCheckIns} icon={<User />} tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Today Check-outs" count={summary.todayCheckOuts} icon={<Clock3 />} tone="bg-blue-50 text-blue-700" />
        <SummaryCard label="Pending Bookings" count={summary.pending} icon={<AlertCircle />} tone="bg-yellow-50 text-yellow-700" />
        <SummaryCard label="Confirmed" count={summary.confirmed} icon={<CheckCircle2 />} tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Cancelled" count={summary.cancelled} icon={<XCircle />} tone="bg-red-50 text-red-700" />
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

            {bookingsLoading ? (
              <CalendarSkeleton />
            ) : showEmpty ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                <CalendarDays className="h-12 w-12 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-900">No bookings scheduled</p>
                <p className="mt-1 text-sm text-slate-500">Upcoming reservations will appear here.</p>
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
                    const dayBookings = bookings.filter((booking) => bookingTouchesDay(booking, dayKey));
                    const dayBlocks = blockedDates.filter((blocked) => dateInRange(dayKey, blocked.start, blocked.end));
                    const isToday = dayKey === today;
                    const isSelected = dayKey === selectedDate;
                    const isOutsideMonth = view === "month" && day.getMonth() !== cursorDate.getMonth();
                    const isFullyBooked = dayBookings.length >= 3;
                    const isPartial = dayBookings.length > 0 && dayBookings.length < 3;

                    return (
                      <button
                        key={dayKey}
                        onClick={() => setSelectedDate(dayKey)}
                        className={cn(
                          "min-h-[116px] border-b border-r border-border p-2 text-left transition-colors hover:bg-slate-50",
                          view === "day" && "col-span-7 min-h-[300px]",
                          isOutsideMonth && "bg-slate-50/70 text-slate-400",
                          isSelected && "bg-primary-50",
                          isFullyBooked && "bg-emerald-50",
                          isPartial && !isSelected && "bg-blue-50/50",
                          dayBlocks.length > 0 && "bg-slate-100"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                              isToday && "bg-primary text-white",
                              isSelected && !isToday && "bg-white text-primary ring-1 ring-primary"
                            )}
                          >
                            {day.getDate()}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {dayBookings.length} booking{dayBookings.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {dayBlocks.length > 0 && (
                            <div className="truncate rounded-md bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600">
                              Blocked
                            </div>
                          )}
                          {dayBookings.slice(0, view === "month" ? 2 : 5).map((booking) => (
                            <div
                              key={`${booking.id}-${dayKey}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedBookingId(booking.id);
                              }}
                              className={cn(
                                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
                                statusStyles[booking.status]
                              )}
                            >
                              <span className={cn("h-2 w-2 rounded-full", eventDotStyles[booking.status])} />
                              <span className="truncate">{booking.customerName}</span>
                            </div>
                          ))}
                          {dayBookings.length > 2 && view === "month" && (
                            <p className="text-[11px] font-medium text-slate-500">+{dayBookings.length - 2} more</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <aside className="border-t border-border bg-slate-50 p-4 lg:border-l lg:border-t-0">
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
                      {booking.status === "pending" && (
                        <>
                          <Button size="xs" variant="success" onClick={() => actionMutation.mutate({ id: booking.id, action: "confirm" })}>Confirm</Button>
                          <Button size="xs" variant="danger" onClick={() => actionMutation.mutate({ id: booking.id, action: "cancel" })}>Cancel</Button>
                        </>
                      )}
                      {booking.status === "confirmed" && (
                        <>
                          <Button size="xs" variant="outline" onClick={() => actionMutation.mutate({ id: booking.id, action: "fail" })}>Mark Failed</Button>
                          <Button size="xs" variant="danger" onClick={() => actionMutation.mutate({ id: booking.id, action: "cancel" })}>Cancel</Button>
                        </>
                      )}
                      <Button size="xs" variant="ghost" icon={<Eye />} onClick={() => setSelectedBookingId(booking.id)}>Details</Button>
                    </div>
                  </div>
                ))
              )}
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
              <p className="mt-2 text-2xl font-bold text-emerald-900">{new Set(bookings.flatMap((booking) => [toISODate(booking.checkIn), toISODate(booking.checkOut)])).size}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-xs font-medium text-slate-600">Blocked Dates</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{blockedDates.length}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-medium text-blue-700">Synced Reservations</p>
              <p className="mt-2 text-2xl font-bold text-blue-900">{blockedDates.filter((date) => date.type === "synced" || date.platform).length}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {blockedLoading ? (
              <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ) : blockedDates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">No blocked, maintenance, unavailable, or synced dates found.</p>
            ) : (
              blockedDates.slice(0, 5).map((blocked) => (
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

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_160px]">
            <Input placeholder="Feed name" value={feedForm.name} onChange={(event) => setFeedForm((form) => ({ ...form, name: event.target.value }))} />
            <Input placeholder="https://example.com/calendar.ics" value={feedForm.url} onChange={(event) => setFeedForm((form) => ({ ...form, url: event.target.value }))} />
            <Select value={feedForm.platform} onChange={(event) => setFeedForm((form) => ({ ...form, platform: event.target.value }))} options={PLATFORM_OPTIONS} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              icon={<Plus />}
              disabled={!selectedListing || !feedForm.name || !feedForm.url}
              loading={addFeedMutation.isPending}
              onClick={() => addFeedMutation.mutate()}
            >
              Add Feed
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            {!selectedListing ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">Select a listing to manage external calendar feeds.</p>
            ) : feedsLoading ? (
              <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
            ) : feeds.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-slate-500">No iCal feeds connected yet.</p>
            ) : (
              feeds.map((feed) => (
                <div key={feed.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{feed.name}</p>
                        <Badge label={feed.status} status={feed.status === "failed" ? "failed" : "confirmed"} />
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{feed.url}</p>
                      <p className="mt-1 text-xs text-slate-400">{feed.platform} · Last sync {feed.lastSyncAt ? formatDate(feed.lastSyncAt) : "Never"}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="xs" variant="outline" icon={<RefreshCw />} loading={syncFeedMutation.isPending} onClick={() => syncFeedMutation.mutate(feed.id)}>
                        Sync Now
                      </Button>
                      <Button size="xs" variant="ghost" icon={<Trash2 />} onClick={() => deleteFeedMutation.mutate(feed.id)} />
                    </div>
                  </div>
                </div>
              ))
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

            {detailsLoading || !selectedBooking ? (
              <div className="flex min-h-[300px] items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading booking details
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 font-semibold text-slate-900">Customer Details</h4>
                  <div className="space-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><User className="h-4 w-4" />{selectedBooking.customerName}</p>
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{selectedBooking.phone}</p>
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{selectedBooking.email}</p>
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
                    <Info label="Total Amount" value={money(selectedBooking.totalAmount)} />
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

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {selectedBooking.status === "pending" && (
                    <>
                      <Button variant="success" icon={<CheckCircle2 />} onClick={() => actionMutation.mutate({ id: selectedBooking.id, action: "confirm" })}>Confirm Booking</Button>
                      <Button variant="danger" icon={<Ban />} onClick={() => actionMutation.mutate({ id: selectedBooking.id, action: "cancel" })}>Cancel Booking</Button>
                    </>
                  )}
                  {selectedBooking.status === "confirmed" && (
                    <>
                      <Button variant="outline" icon={<CreditCard />} onClick={() => actionMutation.mutate({ id: selectedBooking.id, action: "fail" })}>Mark Failed</Button>
                      <Button variant="danger" icon={<Ban />} onClick={() => actionMutation.mutate({ id: selectedBooking.id, action: "cancel" })}>Cancel Booking</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}
