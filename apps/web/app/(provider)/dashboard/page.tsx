"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  Car,
  Clock3,
  DollarSign,
  MessageSquare,
  Plus,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { RatingStars, RevenueAreaChart } from "@/components/charts/Charts";
import { cn, formatCurrency, formatDate, formatMonthLabel, formatRelativeTime } from "@/lib/utils";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "failed";
type ListingStatus = "active" | "draft" | "pending_approval" | "suspended" | "rejected";
type PaymentStatus = "paid" | "pending" | "failed" | "refunded";

interface DashboardAnalytics {
  totalListings: number;
  activeListings: number;
  totalBookings: number;
  upcomingBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalEarnings: number;
  thisMonthEarnings: number;
  averageRating: number;
  totalReviews: number;
  trends: Record<string, number>;
}

interface Booking {
  id: string;
  bookingId: string;
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  // Extended fields (may be undefined at runtime)
  providerPayout?: number;
  listingId?: string;
  listingCategory?: string;
  nightsOrDays?: number;
  guestCount?: number;
  createdAt?: string;
}
console.log("WEB PROVIDER DASHBOARD");
interface Review {
  id: string;
  guestName: string;
  listingName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ListingSummary {
  id: string;
  name: string;
  status: ListingStatus;
  location: string;
  totalBookings: number;
  rating: number;
  price: number;
  currency: string;
  availabilityStatus: string;
  image?: string;
  category: string;
  unitCount?: number | null;
  licencePlate?: string | null;
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  // Review aggregation fields (may be populated server-side)
  reviewCount?: number;
  averageRating?: number;
}

interface EarningsOverview {
  total: number;
  monthly: number;
  pendingPayouts: number;
  completedPayouts: number;
  monthlyRevenue: Array<{ month: string; revenue: number; bookings?: number }>;
}

interface AvailabilityItem {
  id: string;
  date: string;
  end?: string;
  status: "blocked" | "reserved" | "available";
  label: string;
}

interface ActivityItem {
  id: string;
  type: "booking" | "cancelled" | "review" | "listing";
  title: string;
  detail: string;
  createdAt: string;
}

interface DashboardBundle {
  analytics: DashboardAnalytics;
  bookings: Booking[];
  reviews: Review[];
  listings: ListingSummary[];
  earnings: EarningsOverview;
  availability: AvailabilityItem[];
  activity: ActivityItem[];
  hasError: boolean;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

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

function normalizeBookingStatus(value: unknown): BookingStatus {
  const status = readString(value, "pending").toLowerCase();
  if (status.includes("cancel")) return "cancelled";
  if (status === "confirmed" || status === "completed" || status === "failed") return status;
  return "pending";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = readString(value, "pending").toLowerCase();
  if (status === "paid" || status === "failed" || status === "refunded") return status;
  return "pending";
}

function normalizeListingStatus(value: unknown): ListingStatus {
  const status = readString(value, "draft").toLowerCase().replace(/[\s-]/g, "_");
  if (status === "active" || status === "suspended" || status === "rejected" || status === "pending_approval") return status;
  return "draft";
}

function normalizeBooking(raw: unknown): Booking {
  const item = raw as Record<string, unknown>;
  const guest = (item.guest ?? item.customer ?? {}) as Record<string, unknown>;
  const listing = (item.listing ?? item.property ?? {}) as Record<string, unknown>;
  const payment = (item.payment ?? {}) as Record<string, unknown>;
  const id = readString(item.id ?? item._id ?? item.bookingId, "booking");

  return {
    id,
    bookingId: readString(item.bookingId ?? item.reference ?? item.code, id),
    guestName: readString(item.guestName ?? item.customerName ?? guest.name ?? guest.fullName, "Guest"),
    propertyName: readString(item.propertyName ?? item.listingTitle ?? item.listingName ?? listing.name ?? listing.title, "Listing"),
    checkIn: readString(item.checkIn ?? item.checkInDate ?? item.startDate ?? item.pickupDatetime, new Date().toISOString()),
    checkOut: readString(item.checkOut ?? item.checkOutDate ?? item.endDate ?? item.dropoffDatetime, new Date().toISOString()),
    totalAmount: readNumber(item.totalAmount ?? item.providerPayout ?? item.amount ?? payment.amount),
    currency: readString(item.currency ?? payment.currency, "USD"),
    status: normalizeBookingStatus(item.status),
    paymentStatus: normalizePaymentStatus(item.paymentStatus ?? payment.status),
  };
}

function normalizeReview(raw: unknown): Review {
  const item = raw as Record<string, unknown>;
  const guest = (item.guest ?? item.customer ?? {}) as Record<string, unknown>;
  const listing = (item.listing ?? item.property ?? {}) as Record<string, unknown>;
  const id = readString(item.id ?? item._id ?? item.reviewId, crypto.randomUUID());

  return {
    id,
    guestName: readString(item.guestName ?? item.customerName ?? guest.name ?? guest.fullName, "Guest"),
    listingName: readString(item.listingName ?? item.propertyName ?? listing.name ?? listing.title, "Listing"),
    rating: Math.min(5, Math.max(0, readNumber(item.rating ?? item.stars))),
    comment: readString(item.comment ?? item.body ?? item.review ?? item.message, "No written comment."),
    createdAt: readString(item.createdAt ?? item.date, new Date().toISOString()),
  };
}

function normalizeListing(raw: unknown): ListingSummary {
  const item = raw as Record<string, unknown>;
  const location = (item.location ?? item.address ?? {}) as Record<string, unknown>;
  const media = Array.isArray(item.media) ? item.media[0] as Record<string, unknown> : {};
  const id = readString(item.id ?? item._id ?? item.listingId, crypto.randomUUID());

  return {
    id,
    name: readString(item.name ?? item.title, "Untitled listing"),
    status: normalizeListingStatus(item.status),
    location: readString(
      item.locationText ?? item.city ?? location.city ?? location.country,
      "Location not set"
    ),
    totalBookings: readNumber(item.totalBookings ?? item.bookingsCount),
    rating: readNumber(item.rating ?? item.averageRating),
    price: readNumber(item.price ?? item.basePrice ?? item.nightlyPrice),
    currency: readString(item.currency, "USD"),
    availabilityStatus: readString(item.availabilityStatus ?? item.availability, "Available"),
    image: readString(item.image ?? item.coverImage ?? media.url),
    category: readString(item.category ?? item.listingCategory, "apartment"),
    unitCount: item.unitCount !== undefined ? (item.unitCount === null ? null : readNumber(item.unitCount)) : null,
    licencePlate: item.licencePlate !== undefined ? (item.licencePlate === null ? null : readString(item.licencePlate)) : null,
    carMake: item.carMake !== undefined ? (item.carMake === null ? null : readString(item.carMake)) : null,
    carModel: item.carModel !== undefined ? (item.carModel === null ? null : readString(item.carModel)) : null,
    carYear: item.carYear !== undefined ? (item.carYear === null ? null : readNumber(item.carYear)) : null,
  };
}

function normalizeEarnings(payload: unknown): EarningsOverview {
  const data = unwrap(payload);
  const allTime = (data.allTime ?? data.summary ?? {}) as Record<string, unknown>;
  const monthlyRaw = Array.isArray(data.monthly) ? data.monthly : Array.isArray(data.monthlyRevenue) ? data.monthlyRevenue : [];
  const monthlyRevenue = monthlyRaw.map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      month: readString(item.month ?? item.period, new Date().toISOString().slice(0, 7)),
      revenue: readNumber(item.revenue ?? item.payout ?? item.total),
      bookings: readNumber(item.bookings ?? item.bookingCount),
    };
  });

  return {
    total: readNumber(data.totalEarnings ?? allTime.payout ?? allTime.revenue),
    monthly: readNumber(data.thisMonthEarnings ?? data.monthlyEarnings ?? monthlyRevenue.at(-1)?.revenue),
    pendingPayouts: readNumber(data.pendingPayouts ?? allTime.pendingPayouts),
    completedPayouts: readNumber(data.completedPayouts ?? allTime.completedPayouts),
    monthlyRevenue,
  };
}

function normalizeAvailability(raw: unknown): AvailabilityItem[] {
  const data = unwrap(raw);
  const lists = [
    ...unwrapList(data.bookedRanges ?? data.bookings ?? [], ["items"]).map((item) => ({ item, status: "reserved" as const })),
    ...unwrapList(data.blockedRanges ?? data.blockedDates ?? [], ["items"]).map((item) => ({ item, status: "blocked" as const })),
  ];

  return lists.slice(0, 8).map(({ item, status }) => {
    const value = item as Record<string, unknown>;
    const start = readString(value.start ?? value.startDate ?? value.from, new Date().toISOString());
    return {
      id: readString(value.id ?? value._id, crypto.randomUUID()),
      date: start,
      end: readString(value.end ?? value.endDate ?? value.to),
      status,
      label: readString(value.summary ?? value.guestName ?? value.reason, status === "blocked" ? "Blocked date" : "Reserved stay"),
    };
  });
}

function emptyBundle(): DashboardBundle {
  return {
    analytics: {
      totalListings: 0,
      activeListings: 0,
      totalBookings: 0,
      upcomingBookings: 0,
      pendingBookings: 0,
      cancelledBookings: 0,
      totalEarnings: 0,
      thisMonthEarnings: 0,
      averageRating: 0,
      totalReviews: 0,
      trends: {},
    },
    bookings: [],
    reviews: [],
    listings: [],
    earnings: { total: 0, monthly: 0, pendingPayouts: 0, completedPayouts: 0, monthlyRevenue: [] },
    availability: [],
    activity: [],
    hasError: false,
  };
}

async function safeGet(path: string) {
  try {
    const response = await listingApi.get(path);
    return { data: response.data, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}

async function fetchDashboardBundle(): Promise<DashboardBundle> {
  const [dashboardRes, listingsRes, bookingsRes, reviewsRes, earningsRes] = await Promise.all([
    safeGet("/provider/dashboard"),
    safeGet("/provider/listings/summary"),
    safeGet("/provider/bookings?limit=50"),
    safeGet("/provider/reviews?limit=6"),
    safeGet("/provider/earnings"),
  ]);

  const dashboard = unwrap(dashboardRes.data);
  const bookings = unwrapList(bookingsRes.data, ["bookings", "items", "results", "recentBookings"]).map(normalizeBooking);
  const reviews = unwrapList(reviewsRes.data, ["reviews", "items", "results"]).map(normalizeReview);
  const listingsSummary = unwrapList(listingsRes.data, ["listings", "items", "results", "summary", "listingsSummary"]);
  
  // Fetch details for each listing to get licencePlate, unitCount, etc.
  const listings = await Promise.all(
    listingsSummary.map(async (l: any) => {
      try {
        const detailsRes = await listingApi.get(`/listings/${l.id ?? l._id}`);
        const details = detailsRes.data?.data ?? detailsRes.data ?? {};
        return normalizeListing({
          ...l,
          unitCount: details.unitCount,
          licencePlate: details.licencePlate,
          carMake: details.carMake,
          carModel: details.carModel,
          carYear: details.carYear,
          category: details.category ?? l.category,
        });
      } catch {
        return normalizeListing(l);
      }
    })
  );

  const earnings = normalizeEarnings(earningsRes.data);
  const availabilityRes = listings[0]?.id ? await safeGet(`/provider/availability/${listings[0].id}`) : { data: null, failed: false };
  const availability = normalizeAvailability(availabilityRes.data);

  const analytics: DashboardAnalytics = {
    totalListings: readNumber(dashboard.totalListings ?? dashboard.totalListingsCount, listings.length),
    activeListings: readNumber(dashboard.activeListings ?? dashboard.activeListingsCount, listings.filter((item) => item.status === "active").length),
    totalBookings: readNumber(dashboard.completedBookingsCount ?? 0) + readNumber(dashboard.pendingBookingsCount ?? 0),
    upcomingBookings: readNumber(dashboard.pendingBookingsCount ?? dashboard.upcomingBookingsCount, bookings.filter((item) => item.status === "confirmed").length),
    pendingBookings: readNumber(dashboard.pendingBookings ?? dashboard.pendingBookingsCount, bookings.filter((item) => item.status === "pending").length),
    cancelledBookings: readNumber(dashboard.cancelledBookings ?? dashboard.cancelledBookingsCount, bookings.filter((item) => item.status === "cancelled").length),
    totalEarnings: readNumber(dashboard.totalEarnings, earnings.total),
    thisMonthEarnings: readNumber(dashboard.thisMonthEarnings, earnings.monthly),
    averageRating: readNumber(dashboard.averageRating, reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0),
    totalReviews: readNumber(dashboard.totalReviews ?? dashboard.totalReviewsCount, reviews.length),
    trends: (dashboard.trends ?? {}) as Record<string, number>,
  };

  const activity = buildActivity(bookings, reviews, listings);
  return {
    analytics,
    bookings,
    reviews,
    listings,
    earnings,
    availability,
    activity,
    hasError: dashboardRes.failed || listingsRes.failed || bookingsRes.failed || reviewsRes.failed || earningsRes.failed || availabilityRes.failed,
  };
}

function buildActivity(bookings: Booking[], reviews: Review[], listings: ListingSummary[]): ActivityItem[] {
  const bookingActivity = bookings.slice(0, 4).map((booking) => ({
    id: `booking-${booking.id}`,
    type: booking.status === "cancelled" ? "cancelled" as const : "booking" as const,
    title: booking.status === "cancelled" ? "Booking cancelled" : "Booking created",
    detail: `${booking.guestName} - ${booking.propertyName}`,
    createdAt: booking.checkIn,
  }));
  const reviewActivity = reviews.slice(0, 3).map((review) => ({
    id: `review-${review.id}`,
    type: "review" as const,
    title: "Review received",
    detail: `${review.rating}/5 from ${review.guestName}`,
    createdAt: review.createdAt,
  }));
  const listingActivity = listings.slice(0, 3).map((listing) => ({
    id: `listing-${listing.id}`,
    type: "listing" as const,
    title: listing.status === "active" ? "Listing approved" : "Listing updated",
    detail: listing.name,
    createdAt: new Date().toISOString(),
  }));
  return [...bookingActivity, ...reviewActivity, ...listingActivity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
}

function formatGuestName(fullName?: string) {
  if (!fullName) return "Guest";
  const name = fullName.trim();
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!last) return first;
  return `${first} ${last.charAt(0)}.`;
}

function NetCurrency({ amount, currency = "USD", className }: { amount: number; currency?: string; className?: string }) {
  const formatted = formatCurrency(amount, currency);
  const tooltipText = "This is your earnings after ZikaBooking's 5% service fee. ZikaBooking retains the remainder.";
  return (
    <span
      className={cn("inline-flex items-center gap-1 group relative cursor-help font-semibold", className)}
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

function OverviewCard({
  title,
  value,
  icon,
  trend,
  loading,
  tone,
  tooltip,
}: {
  title: string;
  value: string | number | ReactNode;
  icon: ReactNode;
  trend?: number;
  loading: boolean;
  tone: string;
  tooltip?: string;
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.05)] p-5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-shadow duration-200">
      {loading ? (
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">{title}</p>
            {tooltip ? (
              <span className="mt-2 block group relative cursor-help" title={tooltip}>
                <span className="text-2xl font-bold text-slate-900 leading-none">{value}</span>
                <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg bg-slate-950 px-2 py-1.5 text-center text-[11px] font-normal text-white shadow-xl transition-all scale-0 group-hover:scale-100 origin-bottom-left">
                  {tooltip}
                  <span className="absolute top-full left-4 h-1.5 w-1.5 -translate-y-0.5 rotate-45 bg-slate-950" />
                </span>
              </span>
            ) : (
              <p className="mt-2 text-2xl font-bold text-slate-900 leading-none">{value}</p>
            )}
            {trend !== undefined && (
              <p className={cn("mt-2.5 flex items-center gap-1 text-[11px] font-semibold", positive ? "text-emerald-600" : "text-red-500")}>
                {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}%
              </p>
            )}
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm [&>svg]:h-5 [&>svg]:w-5", tone)}>
            {icon}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, message, icon }: { title: string; message: string; icon: ReactNode }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
      <div className="text-slate-300 [&>svg]:h-10 [&>svg]:w-10">{icon}</div>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

function PayoutMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white border border-slate-100 px-4 py-3 shadow-sm">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data = emptyBundle(), isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-dashboard-page-bundle"],
    queryFn: fetchDashboardBundle,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const firstName = user?.firstName ?? "Partner";
  const trend = data.analytics.trends;
  const chartData = data.earnings.monthlyRevenue.length ? data.earnings.monthlyRevenue : [];
  const payoutProgress = data.earnings.total ? Math.min(100, (data.earnings.completedPayouts / data.earnings.total) * 100) : 0;

  // Sorting & Filtering for Upcoming Bookings (Section 12.2)
  const [bookingFilterListing, setBookingFilterListing] = useState("");
  const [bookingStartDate, setBookingStartDate] = useState("");
  const [bookingEndDate, setBookingEndDate] = useState("");
  const [bookingSortKey, setBookingSortKey] = useState<"checkIn" | "listingName" | "payout">("checkIn");
  const [bookingSortOrder, setBookingSortOrder] = useState<"asc" | "desc">("asc");

  const now = new Date();

  // Programmatic Calculations for Financial Summary (Section 12.1)
  const completedBookings = data.bookings.filter(b => b.status === "completed");
  const netRevenueAllTimeVal = completedBookings.reduce((sum, b) => sum + (b.totalAmount * 0.95), 0);
  const netRevenueAllTime = completedBookings.length > 0 ? netRevenueAllTimeVal : (data.analytics.totalEarnings || 0);

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const netRevenueThisMonth = data.analytics.thisMonthEarnings || 0;

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const netRevenueLastMonth = data.earnings.monthlyRevenue.find(r => r.month === lastMonthKey)?.revenue ?? 0;

  const pendingPayoutBookings = data.bookings.filter(b => {
    const checkInTime = new Date(b.checkIn).getTime();
    return b.status === "confirmed" && checkInTime <= now.getTime();
  });
  const pendingPayout = pendingPayoutBookings.reduce((sum, b) => sum + (b.totalAmount * 0.95), 0);

  const totalBookingsAllTime = data.analytics.totalListings > 0 ? (data.analytics.totalBookings || data.bookings.filter(b => b.status === "confirmed" || b.status === "completed").length) : 0;

  const bookingsThisMonth = data.earnings.monthlyRevenue.find(r => r.month === currentMonthKey)?.bookings ?? 
    data.bookings.filter(b => (b.status === "confirmed" || b.status === "completed") && b.checkIn.startsWith(currentMonthKey)).length;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const bookings90Days = data.bookings.filter(b => new Date(b.checkIn).getTime() >= ninetyDaysAgo.getTime());
  const cancelled90Days = bookings90Days.filter(b => b.status.includes("cancel")).length;
  const total90Days = bookings90Days.length;
  const cancellationRate = total90Days > 0 ? (cancelled90Days / total90Days) * 100 : 0;

  const totalReviews = data.listings.reduce((sum, l) => sum + (l.reviewCount ?? 0), 0);
  const weightedSum = data.listings.reduce((sum, l) => sum + (l.averageRating ?? l.rating ?? 0) * (l.reviewCount ?? 0), 0);
  const averageRating = totalReviews > 0 ? weightedSum / totalReviews : (data.analytics.averageRating || 0);

  const tooltipText = "This is your earnings after ZikaBooking's 5% service fee. ZikaBooking retains the remainder.";

  const statCards = useMemo(
    () => [
      { title: "Net revenue — all time",   value: formatCurrency(netRevenueAllTime),  icon: <DollarSign />,  tone: "bg-green-700 text-white", tooltip: tooltipText },
      { title: "Net revenue — this month",  value: formatCurrency(netRevenueThisMonth), icon: <TrendingUp />,  tone: "bg-green-700 text-white", tooltip: tooltipText },
      { title: "Net revenue — last month",  value: formatCurrency(netRevenueLastMonth), icon: <TrendingDown />,tone: "bg-slate-600 text-white",    tooltip: tooltipText },
      { title: "Pending payout",            value: formatCurrency(pendingPayout),       icon: <Clock3 />,      tone: "bg-amber-600 text-white",    tooltip: tooltipText },
      { title: "Total bookings — all time", value: totalBookingsAllTime,                 icon: <BookOpen />,    tone: "bg-green-700 text-white" },
      { title: "Bookings — this month",     value: bookingsThisMonth,                   icon: <CalendarDays />,tone: "bg-green-700 text-white" },
      { title: "Cancellation rate",         value: `${cancellationRate.toFixed(1)}%`,   icon: <XCircle />,     tone: "bg-red-500 text-white" },
      { title: "Average rating",            value: averageRating ? averageRating.toFixed(1) : "0.0", icon: <Star />, tone: "bg-green-700 text-white" },
    ],
    [netRevenueAllTime, netRevenueThisMonth, netRevenueLastMonth, pendingPayout, totalBookingsAllTime, bookingsThisMonth, cancellationRate, averageRating]
  );

  // Filter & Sort upcoming bookings (Section 12.2)
  const filteredUpcomingBookings = useMemo(() => {
    let list = data.bookings.filter(b => {
      const isFuture = new Date(b.checkIn).getTime() > now.getTime();
      const isConfirmed = b.status === "confirmed";
      return isFuture && isConfirmed;
    });
    if (bookingFilterListing) {
      list = list.filter(b => b.propertyName.toLowerCase().includes(bookingFilterListing.toLowerCase()));
    }
    if (bookingStartDate) {
      list = list.filter(b => b.checkIn >= bookingStartDate);
    }
    if (bookingEndDate) {
      list = list.filter(b => b.checkIn <= bookingEndDate);
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (bookingSortKey === "checkIn") {
        comparison = new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
      } else if (bookingSortKey === "listingName") {
        comparison = a.propertyName.localeCompare(b.propertyName);
      } else if (bookingSortKey === "payout") {
        comparison = (a.providerPayout ?? a.totalAmount * 0.95) - (b.providerPayout ?? b.totalAmount * 0.95);
      }
      return bookingSortOrder === "asc" ? comparison : -comparison;
    });

    return list;
  }, [data.bookings, bookingFilterListing, bookingStartDate, bookingEndDate, bookingSortKey, bookingSortOrder]);

  const toggleSort = (key: "checkIn" | "listingName" | "payout") => {
    if (bookingSortKey === key) {
      setBookingSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setBookingSortKey(key);
      setBookingSortOrder("asc");
    }
  };

  // Available Units Calculation (Section 12.3)
  const isDateOverlappingToday = (start: string, end: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const s = start.slice(0, 10);
    const e = end.slice(0, 10);
    return todayStr >= s && todayStr <= e;
  };

  const isLockActive = (b: any) => {
    const isPending = b.status === "pending" || b.status === "pending_payment";
    const createdTime = new Date(b.createdAt || new Date()).getTime();
    const fiveMinsMs = 5 * 60 * 1000;
    return isPending && (new Date().getTime() - createdTime) < fiveMinsMs;
  };

  const availableUnitsList = useMemo(() => {
    return data.listings.map(l => {
      const listBookings = data.bookings.filter(b => (b.listingId != null ? b.listingId === l.id : b.propertyName === l.name));
      
      const bookedToday = listBookings.filter(b => 
        (b.status === "completed") && 
        isDateOverlappingToday(b.checkIn, b.checkOut)
      ).length;

      const heldToday = listBookings.filter(b => 
        isLockActive(b) && 
        isDateOverlappingToday(b.checkIn, b.checkOut)
      ).length;

      const totalUnits = l.unitCount ?? (l.category === "hotel" ? 10 : 1);
      const availableNow = Math.max(0, totalUnits - bookedToday - heldToday);

      return {
        ...l,
        totalUnits,
        bookedToday,
        heldToday,
        availableNow,
      };
    });
  }, [data.listings, data.bookings]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Greeting header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Good morning, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here is your provider performance overview.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
            Refresh
          </Button>
          <Link href="/dashboard/listings/new">
            <Button icon={<Plus />}>Add New Listing</Button>
          </Link>
        </div>
      </div>

      {data.hasError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some dashboard APIs did not respond, so available sections are shown with safe fallback data.
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <OverviewCard key={card.title} {...card} loading={isLoading} />
        ))}
      </div>

      
      {/* ── Upcoming Bookings (Section 12.2) ── */}
      <div className="grid gap-5">
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Upcoming Bookings</h2>
              <p className="text-xs text-slate-500">Future reservations scoped to your properties</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Filter by listing name..."
                value={bookingFilterListing}
                onChange={(e) => setBookingFilterListing(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex items-center gap-1 text-xs">
                <span>From:</span>
                <input
                  type="date"
                  value={bookingStartDate}
                  onChange={(e) => setBookingStartDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-2 py-1 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span>To:</span>
                <input
                  type="date"
                  value={bookingEndDate}
                  onChange={(e) => setBookingEndDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-2 py-1 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <RowsSkeleton rows={5} />
          ) : filteredUpcomingBookings.length === 0 ? (
            <EmptyState title="No upcoming bookings" message="No upcoming active stays match the current filters." icon={<BookOpen />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Booking Reference</th>
                    <th onClick={() => toggleSort("listingName")} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100">
                      Listing Name {bookingSortKey === "listingName" && (bookingSortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Guest Name</th>
                    <th onClick={() => toggleSort("checkIn")} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100">
                      Check-in Date {bookingSortKey === "checkIn" && (bookingSortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Check-out Date</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Guests / Rental Days</th>
                    <th onClick={() => toggleSort("payout")} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer hover:bg-slate-100">
                      Net Payout {bookingSortKey === "payout" && (bookingSortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUpcomingBookings.map((booking) => {
                    const isCar = booking.listingCategory === "car";
                    const durationText = isCar 
                      ? `${booking.nightsOrDays ?? 1} day${(booking.nightsOrDays ?? 1) > 1 ? "s" : ""}`
                      : `${booking.guestCount ?? 1} guest${(booking.guestCount ?? 1) > 1 ? "s" : ""}`;
                    const netPayout = booking.providerPayout ?? booking.totalAmount * 0.95;

                    return (
                      <tr key={booking.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{booking.bookingId}</td>
                        <td className="px-3 py-3 font-medium text-slate-900">{booking.propertyName}</td>
                        <td className="px-3 py-3 text-slate-700">{formatGuestName(booking.guestName)}</td>
                        <td className="px-3 py-3 text-slate-500">{formatDate(booking.checkIn)}</td>
                        <td className="px-3 py-3 text-slate-500">{formatDate(booking.checkOut)}</td>
                        <td className="px-3 py-3 text-slate-600">{durationText}</td>
                        <td className="px-3 py-3">
                          <NetCurrency amount={netPayout} currency={booking.currency} />
                        </td>
                        <td className="px-3 py-3"><Badge label={booking.status} status={booking.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Available Units & Car Fleet Breakdown (Section 12.3) ── */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <SectionHeader
            title="Available Units Overview"
            subtitle="Real-time occupancy status per listing. Click listing to open its calendar."
            action={<Link href="/dashboard/listings"><Button variant="outline" size="sm">Manage Listings</Button></Link>}
          />
          {isLoading ? (
            <RowsSkeleton rows={4} />
          ) : availableUnitsList.length === 0 ? (
            <EmptyState title="No listings available" message="Create your first listing to start tracking units." icon={<Building2 />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Listing Name</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-center">Total Units</th>
                    <th className="px-4 py-3 text-center">Booked Today</th>
                    <th className="px-4 py-3 text-center">Held (Locks)</th>
                    <th className="px-4 py-3 text-center">Available Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {availableUnitsList.map((l) => {
                    const isCar = l.category === "car";
                    return (
                      <tr key={l.id} className="hover:bg-slate-50 group">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/calendar?listing=${l.id}`} className="font-semibold text-slate-900 group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {l.name}
                            <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          {isCar && l.licencePlate && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 ml-2 uppercase font-mono">
                              {l.licencePlate}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-500">{l.category}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{l.totalUnits}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{l.bookedToday}</td>
                        <td className="px-4 py-3 text-center text-amber-600 font-semibold">{l.heldToday}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            l.availableNow > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          )}>
                            {l.availableNow} free
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── Car Fleets Breakdown (Section 12.3) ── */}
        <Card>
          <SectionHeader
            title="Car Fleet Breakdown"
            subtitle="Vehicle status and details"
          />
          {isLoading ? (
            <RowsSkeleton rows={3} />
          ) : availableUnitsList.filter(l => l.category === "car").length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center text-center text-slate-400">
              <Car className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-xs">No vehicles in fleet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {availableUnitsList.filter(l => l.category === "car").map((l) => {
                const status = l.availableNow > 0 ? "Available" : (l.heldToday > 0 ? "Held" : "Booked");
                return (
                  <div key={l.id} className="rounded-xl border border-border p-3 flex items-center justify-between hover:border-primary-500/40 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{l.name}</p>
                      <p className="text-[11px] font-mono font-semibold text-slate-500 mt-0.5 uppercase">
                        Licence: {l.licencePlate || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                        status === "Available" && "bg-green-100 text-green-800",
                        status === "Held" && "bg-amber-100 text-amber-800",
                        status === "Booked" && "bg-red-100 text-red-800"
                      )}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      
    </div>
  );
}