"use client";

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
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
    safeGet("/provider/bookings?limit=8"),
    safeGet("/provider/reviews?limit=6"),
    safeGet("/provider/earnings"),
  ]);

  const dashboard = unwrap(dashboardRes.data);
  const bookings = unwrapList(bookingsRes.data, ["bookings", "items", "results", "recentBookings"]).map(normalizeBooking);
  const reviews = unwrapList(reviewsRes.data, ["reviews", "items", "results"]).map(normalizeReview);
  const listings = unwrapList(listingsRes.data, ["listings", "items", "results", "summary"]).map(normalizeListing);
  const earnings = normalizeEarnings(earningsRes.data);
  const availabilityRes = listings[0]?.id ? await safeGet(`/provider/availability/${listings[0].id}`) : { data: null, failed: false };
  const availability = normalizeAvailability(availabilityRes.data);

  const analytics: DashboardAnalytics = {
    totalListings: readNumber(dashboard.totalListings ?? dashboard.totalListingsCount, listings.length),
    activeListings: readNumber(dashboard.activeListings ?? dashboard.activeListingsCount, listings.filter((item) => item.status === "active").length),
    totalBookings: readNumber(dashboard.totalBookings ?? dashboard.totalBookingsCount, bookings.length),
    upcomingBookings: readNumber(dashboard.upcomingBookings ?? dashboard.upcomingBookingsCount, bookings.filter((item) => item.status === "confirmed").length),
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

function OverviewCard({
  title,
  value,
  icon,
  trend,
  loading,
  tone,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  loading: boolean;
  tone: string;
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.05)] p-5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-shadow duration-200">
      {loading ? (
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-slate-400 uppercase tracking-wide">{title}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 leading-none">{value}</p>
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

  const statCards = useMemo(
    () => [
      { title: "Total Listings",     value: data.analytics.totalListings,                                         icon: <Building2 />,   trend: trend.totalListings,     tone: "bg-green-700 text-white" },
      { title: "Active Listings",    value: data.analytics.activeListings,                                        icon: <CheckCircle2 />, trend: trend.activeListings,    tone: "bg-green-700 text-white" },
      { title: "Total Bookings",     value: data.analytics.totalBookings,                                         icon: <BookOpen />,    trend: trend.totalBookings,     tone: "bg-green-700 text-white" },
      { title: "Upcoming Bookings",  value: data.analytics.upcomingBookings,                                      icon: <CalendarDays />, trend: trend.upcomingBookings,  tone: "bg-green-700 text-white" },
      { title: "Pending Bookings",   value: data.analytics.pendingBookings,                                       icon: <Clock3 />,      trend: trend.pendingBookings,   tone: "bg-green-700 text-white" },
      { title: "Cancelled Bookings", value: data.analytics.cancelledBookings,                                     icon: <XCircle />,     trend: trend.cancelledBookings, tone: "bg-red-500 text-white" },
      { title: "Total Earnings",     value: formatCurrency(data.analytics.totalEarnings),                        icon: <DollarSign />,  trend: trend.totalEarnings,     tone: "bg-green-700 text-white" },
      { title: "This Month Earnings",value: formatCurrency(data.analytics.thisMonthEarnings),                    icon: <TrendingUp />,  trend: trend.thisMonthEarnings, tone: "bg-green-700 text-white" },
      { title: "Average Rating",     value: data.analytics.averageRating ? data.analytics.averageRating.toFixed(1) : "0.0", icon: <Star />, trend: trend.averageRating, tone: "bg-green-700 text-white" },
      { title: "Total Reviews",      value: data.analytics.totalReviews,                                         icon: <MessageSquare />,trend: trend.totalReviews,     tone: "bg-green-700 text-white" },
    ],
    [data.analytics, trend]
  );

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

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
        <Card>
          <SectionHeader
            title="Earnings Overview"
            subtitle="Revenue trends and payout performance"
            action={<Link href="/dashboard/earnings"><Button variant="ghost" size="sm">View earnings</Button></Link>}
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              {isLoading ? (
                <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
              ) : chartData.length === 0 ? (
                <EmptyState title="No earnings data" message="Revenue trends will appear after completed bookings." icon={<Banknote />} />
              ) : (
                <RevenueAreaChart data={chartData} height={260} />
              )}
            </div>
            <div className="space-y-3">
              <PayoutMetric label="Total earnings" value={formatCurrency(data.earnings.total)} />
              <PayoutMetric label="Monthly earnings" value={formatCurrency(data.earnings.monthly)} />
              <PayoutMetric label="Pending payouts" value={formatCurrency(data.earnings.pendingPayouts)} />
              <PayoutMetric label="Completed payouts" value={formatCurrency(data.earnings.completedPayouts)} />
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex justify-between text-xs text-slate-500">
                  <span>Payout progress</span>
                  <span>{payoutProgress.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${payoutProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Quick Actions" subtitle="Common provider workflows" />
          <div className="grid gap-2">
            {[
              { label: "Add New Listing", href: "/dashboard/listings/new", icon: <Building2 /> },
              { label: "View All Bookings", href: "/dashboard/bookings", icon: <BookOpen /> },
              { label: "Manage Availability", href: "/dashboard/calendar", icon: <CalendarDays /> },
              { label: "View Earnings", href: "/dashboard/earnings", icon: <DollarSign /> },
              { label: "Messages", href: "/dashboard/messaging", icon: <MessageSquare /> },
              { label: "Calendar Sync", href: "/dashboard/channel", icon: <RefreshCw /> },
            ].map((action) => (
              <Link key={action.href} href={action.href} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary [&>svg]:h-4 [&>svg]:w-4">{action.icon}</span>
                <span className="text-sm font-semibold text-slate-700">{action.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <SectionHeader
            title="Recent Bookings"
            subtitle="Latest provider reservations"
            action={<Link href="/dashboard/bookings"><Button variant="outline" size="sm">View all</Button></Link>}
          />
          {isLoading ? (
            <RowsSkeleton rows={5} />
          ) : data.bookings.length === 0 ? (
            <EmptyState title="No bookings yet" message="Bookings will appear here once guests reserve your listings." icon={<BookOpen />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    {["Booking ID", "Guest", "Property", "Check-in", "Check-out", "Amount", "Status", "Payment"].map((heading) => (
                      <th key={heading} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{booking.bookingId}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={booking.guestName} size="sm" />
                          <span className="font-medium text-slate-900">{booking.guestName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{booking.propertyName}</td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(booking.checkIn)}</td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(booking.checkOut)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatCurrency(booking.totalAmount, booking.currency)}</td>
                      <td className="px-3 py-3"><Badge label={booking.status} status={booking.status} /></td>
                      <td className="px-3 py-3"><Badge label={booking.paymentStatus} status={booking.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Recent Reviews" subtitle="Latest guest feedback" action={<Link href="/dashboard/reviews"><Button variant="ghost" size="sm">View all</Button></Link>} />
          {isLoading ? (
            <RowsSkeleton rows={4} />
          ) : data.reviews.length === 0 ? (
            <EmptyState title="No reviews yet" message="Guest reviews will appear after completed stays." icon={<Star />} />
          ) : (
            <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {data.reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{review.guestName}</p>
                      <p className="text-xs text-slate-500">{review.listingName}</p>
                    </div>
                    <RatingStars rating={review.rating} />
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-slate-600">{review.comment}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <Card>
          <SectionHeader title="Listings Summary" subtitle="Property performance and availability" action={<Link href="/dashboard/listings"><Button variant="outline" size="sm">Manage listings</Button></Link>} />
          {isLoading ? (
            <RowsSkeleton rows={4} />
          ) : data.listings.length === 0 ? (
            <EmptyState title="No listings available" message="Create your first listing to start receiving bookings." icon={<Building2 />} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.listings.slice(0, 6).map((listing) => (
                <div key={listing.id} className="rounded-xl border border-border p-3 transition-all hover:border-primary/40 hover:shadow-sm">
                  <div className="flex gap-3">
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {listing.image ? (
                        <img src={listing.image} alt={listing.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300"><Building2 className="h-7 w-7" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold text-slate-900">{listing.name}</p>
                        <Badge label={listing.status.replace("_", " ")} status={listing.status === "active" ? "confirmed" : "pending"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{listing.location}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <span><strong className="text-slate-900">{listing.totalBookings}</strong><br />Bookings</span>
                        <span><strong className="text-slate-900">{listing.rating || "0.0"}</strong><br />Rating</span>
                        <span><strong className="text-slate-900">{formatCurrency(listing.price, listing.currency)}</strong><br />Price</span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-emerald-700">{listing.availabilityStatus}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionHeader title="Availability Preview" subtitle="Blocked and reserved dates" />
            {isLoading ? (
              <RowsSkeleton rows={4} />
            ) : data.availability.length === 0 ? (
              <EmptyState title="No blocked dates" message="Reserved and blocked dates will appear here." icon={<CalendarDays />} />
            ) : (
              <div className="space-y-2">
                {data.availability.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(item.date)}{item.end ? ` to ${formatDate(item.end)}` : ""}
                      </p>
                    </div>
                    <Badge label={item.status} status={item.status === "reserved" ? "confirmed" : "pending"} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Recent Activity" subtitle="Latest account events" />
            {data.activity.length === 0 ? (
              <EmptyState title="No recent activity" message="Booking, review, and listing updates will appear here." icon={<Clock3 />} />
            ) : (
              <div className="space-y-4">
                {data.activity.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
                      {item.type === "review" ? <Star className="h-4 w-4" /> : item.type === "listing" ? <Building2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatRelativeTime(item.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function PayoutMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}
