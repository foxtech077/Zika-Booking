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
  DollarSign,
  History,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { cn, formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RevenueSummary {
  totalNetRevenue: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  pendingPayouts: number;
  completedPayouts: number;
  currency: string;
}

interface BookingStats {
  totalBookings: number;
  monthlyBookings: number;
  cancellationRate: number;
  averageRating: number;
}

interface MonthlyPoint {
  month: string;
  revenue: number;
  payout: number;
  commission: number;
  bookings: number;
}

interface RecentPayout {
  id: string;
  bookingReference: string;
  listingName: string;
  amount: number;
  status: string;
  payoutDate: string;
  currency: string;
}

interface PaymentDashboard {
  revenue: RevenueSummary;
  bookingStats: BookingStats;
  monthly: MonthlyPoint[];
  recentPayouts: RecentPayout[];
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

function normalizeRevenue(raw: unknown): RevenueSummary {
  const d = unwrap(raw);
  const rev = (d.revenue ?? d.summary ?? {}) as Record<string, unknown>;
  return {
    totalNetRevenue: readNumber(rev.totalNetRevenue ?? rev.netRevenue ?? d.totalNetRevenue),
    currentMonthRevenue: readNumber(rev.currentMonthRevenue ?? d.currentMonthRevenue),
    previousMonthRevenue: readNumber(rev.previousMonthRevenue ?? d.previousMonthRevenue),
    pendingPayouts: readNumber(rev.pendingPayouts ?? d.pendingPayouts),
    completedPayouts: readNumber(rev.completedPayouts ?? d.completedPayouts),
    currency: readString(rev.currency ?? d.currency, "USD"),
  };
}

function normalizeBookingStats(raw: unknown): BookingStats {
  const d = unwrap(raw);
  const stats = (d.bookingStats ?? d.stats ?? d) as Record<string, unknown>;
  return {
    totalBookings: readNumber(stats.totalBookings ?? d.totalBookings),
    monthlyBookings: readNumber(stats.monthlyBookings ?? d.monthlyBookings),
    cancellationRate: readNumber(stats.cancellationRate ?? d.cancellationRate),
    averageRating: readNumber(stats.averageRating ?? d.averageRating),
  };
}

function normalizeMonthly(raw: unknown[]): MonthlyPoint[] {
  return raw.map((item) => {
    const m = item as Record<string, unknown>;
    return {
      month: readString(m.month ?? m.period, new Date().toISOString().slice(0, 7)),
      revenue: readNumber(m.revenue ?? m.totalRevenue),
      payout: readNumber(m.payout ?? m.netEarnings),
      commission: readNumber(m.commission ?? m.fees),
      bookings: readNumber(m.bookings ?? m.bookingCount),
    };
  });
}

function normalizePayout(raw: unknown): RecentPayout {
  const m = raw as Record<string, unknown>;
  const id = readString(m.id ?? m._id ?? m.payoutId, crypto.randomUUID());
  return {
    id,
    bookingReference: readString(m.bookingReference ?? m.bookingId, "N/A"),
    listingName: readString(m.listingName ?? m.propertyName, "Listing"),
    amount: readNumber(m.amount ?? m.netPayout),
    status: readString(m.status ?? m.payoutStatus, "pending"),
    payoutDate: readString(m.payoutDate ?? m.paidAt ?? m.createdAt, new Date().toISOString()),
    currency: readString(m.currency, "USD"),
  };
}

function emptyDashboard(): PaymentDashboard {
  return {
    revenue: { totalNetRevenue: 0, currentMonthRevenue: 0, previousMonthRevenue: 0, pendingPayouts: 0, completedPayouts: 0, currency: "USD" },
    bookingStats: { totalBookings: 0, monthlyBookings: 0, cancellationRate: 0, averageRating: 0 },
    monthly: [],
    recentPayouts: [],
  };
}

function normalizePaymentDashboard(payload: unknown): PaymentDashboard {
  const data = unwrap(payload);
  const monthlyRaw = Array.isArray(data.monthly) ? data.monthly : Array.isArray(data.monthlyRevenue) ? data.monthlyRevenue : [];
  const payoutsRaw = Array.isArray(data.recentPayouts) ? data.recentPayouts : Array.isArray(data.payouts) ? data.payouts : [];
  return {
    revenue: normalizeRevenue(data),
    bookingStats: normalizeBookingStats(data),
    monthly: normalizeMonthly(monthlyRaw),
    recentPayouts: payoutsRaw.map(normalizePayout),
  };
}

async function fetchPaymentDashboard(): Promise<PaymentDashboard> {
  try {
    const [summaryRes, earningsRes] = await Promise.all([
      listingApi.get("/provider/payments/summary").catch(() => ({ data: null })),
      listingApi.get("/provider/earnings").catch(() => ({ data: null })),
    ]);
    const merged = {
      ...(unwrap(summaryRes.data)),
      ...(unwrap(earningsRes.data)),
    };
    return normalizePaymentDashboard(merged);
  } catch {
    return emptyDashboard();
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RevenueCard({
  label,
  value,
  icon,
  trend,
  loading,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: number;
  loading: boolean;
  tone: string;
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.05)] p-5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-all duration-200">
      {loading ? (
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 leading-none">{value}</p>
            {trend !== undefined && (
              <p className={cn("mt-2.5 flex items-center gap-1 text-[11px] font-semibold", positive ? "text-emerald-600" : "text-red-500")}>
                {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}% vs last period
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

function StatCard({
  label,
  value,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: string;
  loading: boolean;
}) {
  return (
    <Card>
      {loading ? (
        <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", tone)}>
            {icon}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
      <Banknote className="h-10 w-10 text-slate-300" />
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{message}</p>
    </div>
  );
}

function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "View Earnings Analytics", href: "/dashboard/earnings", icon: <DollarSign /> },
  { label: "Upcoming Booking Earnings", href: "/dashboard/payments/upcoming-earnings", icon: <CalendarDays /> },
  { label: "Payout History", href: "/dashboard/payments/payout-history", icon: <History /> },
  { label: "Booking Revenue Details", href: "/dashboard/payments/booking-revenue", icon: <BookOpen /> },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentDashboardPage() {
  const { data = emptyDashboard(), isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-payment-dashboard"],
    queryFn: fetchPaymentDashboard,
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  });

  const chartData = useMemo(
    () =>
      data.monthly.slice(-12).map((m) => ({
        ...m,
        label: formatMonthLabel(m.month),
      })),
    [data.monthly]
  );

  const monthChange = useMemo(() => {
    const { currentMonthRevenue, previousMonthRevenue } = data.revenue;
    if (!previousMonthRevenue) return currentMonthRevenue ? 100 : 0;
    return ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
  }, [data.revenue]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track earnings, payouts, and booking revenue — all in one place.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<RefreshCw />}
          loading={isFetching && !isLoading}
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </div>

      {/* ── Revenue Summary Cards ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue Summary</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <RevenueCard
            label="Total Net Revenue"
            value={formatCurrency(data.revenue.totalNetRevenue, data.revenue.currency)}
            icon={<Wallet />}
            loading={isLoading}
            tone="bg-emerald-600 text-white"
          />
          <RevenueCard
            label="Current Month Revenue"
            value={formatCurrency(data.revenue.currentMonthRevenue, data.revenue.currency)}
            icon={<CalendarDays />}
            trend={monthChange}
            loading={isLoading}
            tone="bg-green-700 text-white"
          />
          <RevenueCard
            label="Previous Month Revenue"
            value={formatCurrency(data.revenue.previousMonthRevenue, data.revenue.currency)}
            icon={<TrendingUp />}
            loading={isLoading}
            tone="bg-slate-600 text-white"
          />
          <RevenueCard
            label="Pending Payouts"
            value={formatCurrency(data.revenue.pendingPayouts, data.revenue.currency)}
            icon={<Clock3 />}
            loading={isLoading}
            tone="bg-amber-500 text-white"
          />
          <RevenueCard
            label="Completed Payouts"
            value={formatCurrency(data.revenue.completedPayouts, data.revenue.currency)}
            icon={<CheckCircle2 />}
            loading={isLoading}
            tone="bg-teal-600 text-white"
          />
        </div>
      </div>

      {/* ── Booking Statistics ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Booking Statistics</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Bookings"
            value={data.bookingStats.totalBookings}
            icon={<BookOpen />}
            tone="bg-green-50 text-green-700"
            loading={isLoading}
          />
          <StatCard
            label="Monthly Bookings"
            value={data.bookingStats.monthlyBookings}
            icon={<Users />}
            tone="bg-indigo-50 text-indigo-700"
            loading={isLoading}
          />
          <StatCard
            label="Cancellation Rate"
            value={`${data.bookingStats.cancellationRate.toFixed(1)}%`}
            icon={<XCircle />}
            tone="bg-red-50 text-red-600"
            loading={isLoading}
          />
          <StatCard
            label="Average Rating"
            value={data.bookingStats.averageRating ? data.bookingStats.averageRating.toFixed(1) : "—"}
            icon={<Star />}
            tone="bg-amber-50 text-amber-600"
            loading={isLoading}
          />
        </div>
      </div>

      {/* ── Main content: Chart + Quick Actions ── */}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
        <Card>
          <SectionHeader
            title="Monthly Revenue Trend"
            subtitle="Net revenue and payouts over the last 12 months"
            action={
              <Link href="/dashboard/earnings">
                <Button variant="ghost" size="sm">View Full Analytics</Button>
              </Link>
            }
          />
          {isLoading ? (
            <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
          ) : chartData.length === 0 ? (
            <EmptyState
              title="No revenue data yet"
              message="Monthly charts will appear after completed bookings generate payout records."
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#16a34a"
                    fill="url(#revGrad)"
                    strokeWidth={2}
                    name="Gross Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="payout"
                    stroke="#10b981"
                    fill="url(#payGrad)"
                    strokeWidth={2}
                    name="Net Payout"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Quick Actions" subtitle="Payment management shortcuts" />
          <div className="grid gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700 [&>svg]:h-4 [&>svg]:w-4">
                  {action.icon}
                </span>
                <span className="text-sm font-semibold text-slate-700">{action.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Payout Policy</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                  Earnings are released after guest check-in + T+24h holding period. Platform commission is deducted before payout.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Recent Payouts ── */}
      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Recent Payouts</h3>
            <p className="text-xs text-slate-500">Last processed payouts from the platform</p>
          </div>
          <Link href="/dashboard/payments/payout-history">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="p-5">
            <RowsSkeleton rows={4} />
          </div>
        ) : data.recentPayouts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No payouts yet"
              message="Payout records will appear here after your first completed booking."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  {["Booking Ref", "Listing", "Net Payout", "Status", "Payout Date"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentPayouts.slice(0, 6).map((payout) => (
                  <tr key={payout.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{payout.bookingReference}</td>
                    <td className="px-4 py-3">
                      <p className="max-w-[200px] truncate font-medium text-slate-900">{payout.listingName}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700">
                      {formatCurrency(payout.amount, payout.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={payout.status} status={payout.status} dot />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(payout.payoutDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
