"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";

type DateRange = "today" | "7d" | "30d" | "month" | "year" | "custom";
type PayoutStatus = "all" | "pending" | "processing" | "completed" | "failed";
type RevenueType = "all" | "booking" | "payout" | "commission" | "adjustment";

interface MonthlyPoint {
  month: string;
  bookings: number;
  revenue: number;
  commission: number;
  payout: number;
}

interface Transaction {
  id: string;
  transactionId: string;
  displayId?: string;
  bookingReference: string;
  guestName: string;
  listingName: string;
  revenueType: RevenueType;
  amount: number;
  commission: number;
  payout: number;
  status: Exclude<PayoutStatus, "all">;
  paymentDate: string;
  bookingDate: string;
  currency: string;
}

interface EarningsData {
  allTime: {
    revenue: number;
    commission: number;
    payout: number;
    pendingPayouts: number;
    completedPayouts: number;
    bookingsRevenue: number;
    averageBookingValue: number;
  };
  monthly: MonthlyPoint[];
  transactions: Transaction[];
  payout: {
    upcoming: number;
    pendingAmount: number;
    lastPayoutDate?: string;
    nextPayoutDate?: string;
    paymentMethodStatus: string;
  };
}

interface Notice {
  type: "success" | "error";
  text: string;
}

const PAGE_SIZE = 8;

const dateOptions = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const payoutOptions = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const revenueOptions = [
  { value: "all", label: "All revenue" },
  { value: "booking", label: "Booking" },
  { value: "payout", label: "Payout" },
  { value: "commission", label: "Commission" },
  { value: "adjustment", label: "Adjustment" },
];

function readNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function unwrap(payload: unknown) {
  const root = payload as Record<string, unknown>;
  return (root?.data as Record<string, unknown>) ?? root ?? {};
}

function normalizeStatus(value: unknown): Transaction["status"] {
  const status = readString(value, "pending").toLowerCase();
  if (status === "processing" || status === "completed" || status === "failed") return status;
  return "pending";
}

function normalizeRevenueType(value: unknown): RevenueType {
  const type = readString(value, "booking").toLowerCase();
  if (type === "payout" || type === "commission" || type === "adjustment") return type;
  return "booking";
}

function normalizeMonthly(raw: unknown): MonthlyPoint {
  const item = raw as Record<string, unknown>;
  return {
    month: readString(item.month ?? item.period, new Date().toISOString().slice(0, 7)),
    bookings: readNumber(item.bookings ?? item.bookingCount),
    revenue: readNumber(item.revenue ?? item.totalRevenue),
    commission: readNumber(item.commission ?? item.fees),
    payout: readNumber(item.payout ?? item.netEarnings ?? item.net),
  };
}

function normalizeTransaction(raw: unknown): Transaction {
  const item = raw as Record<string, unknown>;
  const booking = (item.booking ?? {}) as Record<string, unknown>;
  const listing = (item.listing ?? item.property ?? {}) as Record<string, unknown>;
  const id = readString(item.id ?? item._id ?? item.transactionId, crypto.randomUUID());

  return {
    id,
    transactionId: readString(item.transactionId ?? item.reference ?? id, id),
    displayId: readString(item.displayId, undefined) as string | undefined,
    bookingReference: readString(item.bookingReference ?? item.bookingId ?? booking.reference ?? booking.id, "N/A"),
    guestName: readString(item.guestName ?? item.customerName ?? booking.guestName, "Guest"),
    listingName: readString(item.listingName ?? item.propertyName ?? listing.name ?? listing.title, "Listing"),
    revenueType: normalizeRevenueType(item.revenueType ?? item.type),
    amount: readNumber(item.amount ?? item.totalAmount ?? item.revenue),
    commission: readNumber(item.commission ?? item.fees),
    payout: readNumber(item.payout ?? item.netPayout ?? item.net),
    status: normalizeStatus(item.status ?? item.payoutStatus),
    paymentDate: readString(item.paymentDate ?? item.paidAt ?? item.confirmedAt ?? item.createdAt, new Date().toISOString()),
    bookingDate: readString(item.bookingDate ?? booking.createdAt ?? item.createdAt, new Date().toISOString()),
    currency: readString(item.currency, "USD"),
  };
}

function emptyData(): EarningsData {
  return {
    allTime: {
      revenue: 0,
      commission: 0,
      payout: 0,
      pendingPayouts: 0,
      completedPayouts: 0,
      bookingsRevenue: 0,
      averageBookingValue: 0,
    },
    monthly: [],
    transactions: [],
    payout: {
      upcoming: 0,
      pendingAmount: 0,
      paymentMethodStatus: "Not connected",
    },
  };
}

function normalizeEarnings(payload: unknown): EarningsData {
  const data = unwrap(payload);
  const allTime = (data.allTime ?? data.summary ?? {}) as Record<string, unknown>;
  const payout = (data.payout ?? data.payoutStatus ?? {}) as Record<string, unknown>;
  const monthly = Array.isArray(data.monthly) ? data.monthly : Array.isArray(data.analytics) ? data.analytics : [];
  const transactions = Array.isArray(data.transactions)
    ? data.transactions
    : Array.isArray(data.recentPayouts)
      ? data.recentPayouts
      : [];
  const normalizedTransactions = transactions.map(normalizeTransaction);
  const revenue = readNumber(allTime.revenue ?? allTime.totalRevenue, normalizedTransactions.reduce((sum, item) => sum + item.amount, 0));
  const commission = readNumber(allTime.commission ?? allTime.fees, normalizedTransactions.reduce((sum, item) => sum + item.commission, 0));
  const totalPayout = readNumber(allTime.payout ?? allTime.netPayout, normalizedTransactions.reduce((sum, item) => sum + item.payout, 0));
  const completedPayouts = normalizedTransactions.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.payout, 0);
  const pendingPayouts = normalizedTransactions.filter((item) => item.status === "pending" || item.status === "processing").reduce((sum, item) => sum + item.payout, 0);

  return {
    allTime: {
      revenue,
      commission,
      payout: totalPayout,
      pendingPayouts: readNumber(allTime.pendingPayouts, pendingPayouts),
      completedPayouts: readNumber(allTime.completedPayouts, completedPayouts),
      bookingsRevenue: readNumber(allTime.bookingsRevenue, revenue),
      averageBookingValue: readNumber(allTime.averageBookingValue, normalizedTransactions.length ? revenue / normalizedTransactions.length : 0),
    },
    monthly: monthly.map(normalizeMonthly),
    transactions: normalizedTransactions,
    payout: {
      upcoming: readNumber(payout.upcoming ?? payout.upcomingPayouts, pendingPayouts),
      pendingAmount: readNumber(payout.pendingAmount, pendingPayouts),
      lastPayoutDate: readString(payout.lastPayoutDate ?? payout.lastPaidAt),
      nextPayoutDate: readString(payout.nextPayoutDate ?? payout.estimatedNextPayout),
      paymentMethodStatus: readString(payout.paymentMethodStatus ?? payout.bankStatus, "Not connected"),
    },
  };
}

async function fetchEarnings(params: Record<string, string>) {
  try {
    const response = await listingApi.get("/provider/earnings", { params });
    return normalizeEarnings(response.data);
  } catch {
    return emptyData();
  }
}

function buildRange(range: DateRange, customFrom: string, customTo: string) {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now);
  if (range === "today") return { from: to, to };
  if (range === "7d") from.setDate(now.getDate() - 7);
  if (range === "30d") from.setDate(now.getDate() - 30);
  if (range === "month") from.setDate(1);
  if (range === "year") from.setMonth(0, 1);
  if (range === "custom") return { from: customFrom, to: customTo };
  return { from: from.toISOString().slice(0, 10), to };
}

function percentChange(points: MonthlyPoint[], key: keyof Pick<MonthlyPoint, "revenue" | "payout" | "commission">) {
  if (points.length < 2) return 0;
  const current = points.at(-1)?.[key] ?? 0;
  const previous = points.at(-2)?.[key] ?? 0;
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function StatCard({
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
  trend: number;
  loading: boolean;
  tone: string;
}) {
  const positive = trend >= 0;
  return (
    <Card>
      {loading ? (
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
            <p className={cn("mt-2 flex items-center gap-1 text-xs font-semibold", positive ? "text-emerald-600" : "text-red-600")}>
              {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(trend).toFixed(1)}% vs previous period
            </p>
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", tone)}>
            {icon}
          </div>
        </div>
      )}
    </Card>
  );
}

function ChartShell({ title, subtitle, children, loading }: { title: string; subtitle: string; children: ReactNode; loading: boolean }) {
  return (
    <Card>
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {loading ? <div className="h-64 rounded-xl bg-slate-100 animate-pulse" /> : <div className="h-64">{children}</div>}
    </Card>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <ReceiptText className="h-7 w-7" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default function EarningsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus>("all");
  const [listingFilter, setListingFilter] = useState("all");
  const [revenueType, setRevenueType] = useState<RevenueType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<Notice | null>(null);

  const range = useMemo(() => buildRange(dateRange, customFrom, customTo), [customFrom, customTo, dateRange]);

  const { data = emptyData(), isLoading, isFetching, refetch } = useQuery({
    queryKey: ["provider-earnings-dashboard", range, payoutStatus, listingFilter, revenueType],
    queryFn: () =>
      fetchEarnings({
        from: range.from,
        to: range.to,
        ...(payoutStatus !== "all" ? { status: payoutStatus } : {}),
        ...(listingFilter !== "all" ? { listingId: listingFilter } : {}),
        ...(revenueType !== "all" ? { revenueType } : {}),
      }),
    staleTime: 5 * 60_000,
  });

  const listingOptions = useMemo(() => {
    const names = Array.from(new Set(data.transactions.map((item) => item.listingName).filter(Boolean)));
    return [{ value: "all", label: "All listings" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [data.transactions]);

  const filteredTransactions = useMemo(() => {
    const text = search.trim().toLowerCase();
    return data.transactions
      .filter((item) => payoutStatus === "all" || item.status === payoutStatus)
      .filter((item) => listingFilter === "all" || item.listingName === listingFilter)
      .filter((item) => revenueType === "all" || item.revenueType === revenueType)
      .filter((item) => {
        if (!text) return true;
        return `${item.bookingReference} ${item.displayId ?? item.transactionId} ${item.guestName} ${item.listingName}`.toLowerCase().includes(text);
      });
  }, [data.transactions, listingFilter, payoutStatus, revenueType, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const pageTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chartData = data.monthly.slice(-12).map((item) => ({
    ...item,
    label: formatMonthLabel(item.month),
  }));
  const weeklyData = chartData.slice(-8);
  const revenueTrend = percentChange(data.monthly, "revenue");
  const payoutTrend = percentChange(data.monthly, "payout");
  const commissionTrend = percentChange(data.monthly, "commission");

  const breakdown = useMemo(() => {
    const groups = new Map<string, { listingName: string; bookings: number; revenue: number; commission: number; payout: number }>();
    data.transactions.forEach((item) => {
      const existing = groups.get(item.listingName) ?? { listingName: item.listingName, bookings: 0, revenue: 0, commission: 0, payout: 0 };
      existing.bookings += 1;
      existing.revenue += item.amount;
      existing.commission += item.commission;
      existing.payout += item.payout;
      groups.set(item.listingName, existing);
    });
    return Array.from(groups.values()).sort((a, b) => b.payout - a.payout).slice(0, 6);
  }, [data.transactions]);

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Earnings & Payouts"
        subtitle="Track revenue analytics, payouts, booking earnings, and monthly performance."
        action={
          <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
            Retry
          </Button>
        }
      />

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{notice.text}</span>
          <button className="rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          <Input
            label="Search"
            placeholder="Booking, transaction, guest, property"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            leftIcon={<Search />}
          />
          <Select label="Date Range" value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} options={dateOptions} />
          <Select label="Payout Status" value={payoutStatus} onChange={(event) => setPayoutStatus(event.target.value as PayoutStatus)} options={payoutOptions} />
          <Select label="Listing" value={listingFilter} onChange={(event) => setListingFilter(event.target.value)} options={listingOptions} />
          <Select label="Revenue Type" value={revenueType} onChange={(event) => setRevenueType(event.target.value as RevenueType)} options={revenueOptions} />
        </div>
        {dateRange === "custom" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="From" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            <Input label="To" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Earnings" value={formatCurrency(data.allTime.payout)} icon={<Wallet />} trend={payoutTrend} loading={isLoading} tone="bg-green-700 text-white" />
        <StatCard label="This Month Earnings" value={formatCurrency(chartData.at(-1)?.payout ?? 0)} icon={<CalendarDays />} trend={payoutTrend} loading={isLoading} tone="bg-green-700 text-white" />
        <StatCard label="Pending Payouts" value={formatCurrency(data.allTime.pendingPayouts)} icon={<CreditCard />} trend={0} loading={isLoading} tone="bg-green-700 text-white" />
        <StatCard label="Completed Payouts" value={formatCurrency(data.allTime.completedPayouts)} icon={<Banknote />} trend={payoutTrend} loading={isLoading} tone="bg-green-700 text-white" />
        <StatCard label="Total Bookings Revenue" value={formatCurrency(data.allTime.bookingsRevenue)} icon={<ReceiptText />} trend={revenueTrend} loading={isLoading} tone="bg-green-700 text-white" />
        <StatCard label="Average Booking Value" value={formatCurrency(data.allTime.averageBookingValue)} icon={<TrendingUp />} trend={revenueTrend} loading={isLoading} tone="bg-green-700 text-white" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartShell title="Monthly Earnings Trend" subtitle="Revenue, fees, and net payouts" loading={isLoading}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" fill="#bbf7d0" name="Revenue" />
              <Area type="monotone" dataKey="payout" stroke="#10b981" fill="#bbf7d0" name="Payout" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Weekly Revenue" subtitle="Recent period comparison" loading={isLoading}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="revenue" fill="#16a34a" radius={[6, 6, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Booking Revenue Analytics" subtitle="Bookings and average movement" loading={isLoading}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="bookings" stroke="#7c3aed" strokeWidth={3} name="Bookings" />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Earnings vs Payouts" subtitle="Gross revenue against net payouts" loading={isLoading}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="revenue" fill="#16a34a" radius={[6, 6, 0, 0]} name="Earnings" />
              <Bar dataKey="payout" fill="#34d399" radius={[6, 6, 0, 0]} name="Payouts" />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Earnings Breakdown</h3>
              <p className="text-xs text-slate-500">Revenue, bookings, commission, and net earnings by listing.</p>
            </div>
            <Badge label={`${breakdown.length} listings`} status="confirmed" />
          </div>
          {isLoading ? (
            <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />
          ) : breakdown.length === 0 ? (
            <EmptyState title="No earnings data" message="Booking earnings will appear here once completed payouts are available." />
          ) : (
            <div className="space-y-3">
              {breakdown.map((item) => {
                const percent = data.allTime.payout ? Math.min(100, (item.payout / data.allTime.payout) * 100) : 0;
                return (
                  <div key={item.listingName} className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.listingName}</p>
                        <p className="text-xs text-slate-500">{item.bookings} bookings</p>
                      </div>
                      <p className="font-bold text-emerald-700">{formatCurrency(item.payout)}</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                      <span>Revenue {formatCurrency(item.revenue)}</span>
                      <span>Fees -{formatCurrency(item.commission)}</span>
                      <span>Net {formatCurrency(item.payout)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-slate-900">Payout Status</h3>
            </div>
            <div className="space-y-3">
              <PayoutRow label="Upcoming payouts" value={formatCurrency(data.payout.upcoming)} />
              <PayoutRow label="Pending amount" value={formatCurrency(data.payout.pendingAmount)} />
              <PayoutRow label="Last payout" value={data.payout.lastPayoutDate ? formatDate(data.payout.lastPayoutDate) : "Not available"} />
              <PayoutRow label="Next estimate" value={data.payout.nextPayoutDate ? formatDate(data.payout.nextPayoutDate) : "Pending schedule"} />
              <PayoutRow label="Payment method" value={data.payout.paymentMethodStatus} />
            </div>
          </Card>

          <Card>
            <div className="mb-4">
              <h3 className="font-semibold text-slate-900">Export Reports</h3>
              <p className="text-xs text-slate-500">Print or save this summary as a PDF from the print dialog.</p>
            </div>
            <div className="grid gap-2">
              <Button variant="outline" icon={<Printer />} onClick={() => window.print()}>Print Summary</Button>
            </div>
          </Card>
        </div>
      </div>

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Recent Transactions & Payouts</h3>
            <p className="text-xs text-slate-500">Showing {filteredTransactions.length} record{filteredTransactions.length === 1 ? "" : "s"}</p>
          </div>
          <Badge label={`Page ${page} of ${totalPages}`} status="pending" />
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState title="No transactions" message="Try adjusting filters, or check back after completed bookings generate payout records." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  {["Transaction", "Booking", "Guest", "Listing", "Amount", "Fees", "Net Payout", "Status", "Dates"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageTransactions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.displayId ?? item.transactionId}</td>
                    <td className="px-4 py-3 text-slate-700">{item.bookingReference}</td>
                    <td className="px-4 py-3 text-slate-700">{item.guestName}</td>
                    <td className="px-4 py-3">
                      <p className="max-w-[180px] truncate font-medium text-slate-900">{item.listingName}</p>
                      <p className="text-xs capitalize text-slate-400">{item.revenueType}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(item.amount, item.currency)}</td>
                    <td className="px-4 py-3 text-slate-500">-{formatCurrency(item.commission, item.currency)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{formatCurrency(item.payout, item.currency)}</td>
                    <td className="px-4 py-3">
                      <Badge label={item.status} status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <p>Paid {formatDate(item.paymentDate)}</p>
                      <p>Booked {formatDate(item.bookingDate)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Rows per page {PAGE_SIZE} · Total records {filteredTransactions.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" icon={<ChevronLeft />} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PayoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
