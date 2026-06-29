"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users, Building2, CalendarDays, BadgeCheck,
  DollarSign, TrendingUp, Clock, AlertCircle, CheckCircle2, XCircle, RotateCcw, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { listingApi } from "@/lib/listing-api";
import { StatCard, RevenueBarChart, DonutChart } from "@/components/charts/Charts";
import { Card, CardHeader, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { canAccess } from "@/permissions/rbac";
import { formatDate, formatCurrency, formatRelativeTime, slugToLabel } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import type { SalesDashboardSummary, SupportDashboardSummary, FinanceDashboardSummary, FinanceRecentActivityItem } from "@/types/admin";

const fetchUsers = (params: Record<string, string>) =>
  api.get("/admin/users", { params }).then((r) => r.data?.data ?? r.data);

const fetchBookings = (params: Record<string, string>) =>
  listingApi.get("/admin/bookings", { params }).then((r) => r.data?.data ?? r.data);

const fetchListings = (params: Record<string, string>) =>
  listingApi.get("/admin/listings", { params }).then((r) => r.data?.data ?? r.data);

const fetchReviewQueue = (params: Record<string, string>) =>
  listingApi.get("/admin/listings/review-queue", { params }).then((r) => r.data?.data ?? r.data);

const fetchAuditLogs = () =>
  api.get("/admin/audit-logs?limit=8").then((r) => r.data?.data ?? r.data);

function buildRevenueChart(bookings: any[]) {
  const byMonth: Record<string, { revenue: number; bookings: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short" });
    byMonth[key] = { revenue: 0, bookings: 0 };
  }
  for (const b of bookings ?? []) {
    if (b.status === "confirmed" || b.status === "completed") {
      const d = new Date(b.createdAt);
      const key = d.toLocaleString("default", { month: "short" });
      if (byMonth[key]) {
        byMonth[key].revenue += Number(b.totalAmount ?? 0);
        byMonth[key].bookings += 1;
      }
    }
  }
  return Object.entries(byMonth).map(([label, v]) => ({ label, ...v }));
}

const STATUS_COLORS_MAP: Record<string, string> = {
  confirmed:          "#3b82f6",
  completed:          "#10b981",
  pending_payment:    "#f59e0b",
  cancelled_by_guest: "#94a3b8",
  cancelled_by_provider: "#f97316",
  cancelled_by_system: "#ef4444",
};

function buildStatusDonut(bookings: any[]) {
  const counts: Record<string, number> = {};
  for (const b of bookings ?? []) {
    counts[b.status] = (counts[b.status] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({
      name: slugToLabel(name),
      value,
      color: STATUS_COLORS_MAP[name] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export default function DashboardPage() {
  const { user, _hasHydrated } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";
  const queriesEnabled = _hasHydrated && isSuperAdmin;
  const isCountryManager = user?.role === "country_manager";
  const userCountryScope = user?.countryScope ?? [];
  const defaultCountry = isCountryManager && userCountryScope.length > 0 ? userCountryScope[0] : "";
  const canViewUsers = canAccess(user?.role as any, "view_users");
  const canViewAudit = canAccess(user?.role as any, "view_audit");
  const role = user?.role;

  const scopedCountryParam: Record<string, string> = defaultCountry ? { country: defaultCountry } : {};
  const queueParams = { limit: "100", ...scopedCountryParam };
  const usersParams = { limit: isCountryManager ? "1000" : "1", ...scopedCountryParam };
  const bookingsParams = { limit: "100", ...scopedCountryParam };
  const listingsParams = { limit: "1", ...scopedCountryParam };
  const scopedQueriesEnabled = _hasHydrated && (!isCountryManager || Boolean(defaultCountry));

  // ── 1. Summary Query ───────────────────────────────────────────────────────
  const {
    data: summaryData,
    isLoading: loadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["admin-dashboard-summary", user?.role],
    queryFn: () => {
      const endpoint = isSuperAdmin
        ? "/admin/dashboard/super-admin/summary"
        : isAdmin
        ? "/admin/dashboard/admin/summary"
        : "/admin/dashboard/country-manager/summary";
      return api.get(endpoint).then((r) => r.data?.data ?? r.data);
    },
    enabled: queriesEnabled,
    retry: 1,
  });

  // ── 2. Pending Actions Query ───────────────────────────────────────────────
  const {
    data: pendingData,
    isLoading: loadingPending,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["admin-dashboard-pending", user?.role],
    queryFn: () => {
      const endpoint = isSuperAdmin
        ? "/admin/dashboard/super-admin/pending-actions"
        : isAdmin
        ? "/admin/dashboard/admin/pending-actions"
        : "/admin/dashboard/country-manager/pending-actions";
      return api.get(endpoint).then((r) => r.data?.data ?? r.data);
    },
    enabled: queriesEnabled,
    retry: 1,
  });

  // ── 3. Recent Activity Query ───────────────────────────────────────────────
  const {
    data: activityData,
    isLoading: loadingActivity,
    error: activityError,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ["admin-dashboard-activity", user?.role],
    queryFn: () => {
      const endpoint = isSuperAdmin
        ? "/admin/dashboard/super-admin/recent-activity?limit=15"
        : isAdmin
        ? "/admin/dashboard/admin/recent-activity?limit=15"
        : "/admin/dashboard/country-manager/recent-activity?limit=15";
      return api.get(endpoint).then((r) => r.data?.data ?? r.data);
    },
    enabled: queriesEnabled,
    retry: 1,
  });

  // ── 4. Sales Summary Query ──────────────────────────────────────────────────
  const {
    data: salesSummary,
    isLoading: loadingSalesSummary,
    error: salesError,
    refetch: refetchSales,
  } = useQuery<SalesDashboardSummary>({
    queryKey: ["sales-dashboard-summary"],
    queryFn: () => api.get("/admin/dashboard/sales/summary").then((r) => r.data?.data ?? r.data),
    enabled: _hasHydrated && role === "sales",
    retry: 1,
  });

  // ── 5. Support Summary Query ────────────────────────────────────────────────
  const {
    data: supportSummary,
    isLoading: loadingSupportSummary,
    error: supportError,
    refetch: refetchSupport,
  } = useQuery<SupportDashboardSummary>({
    queryKey: ["support-dashboard-summary"],
    queryFn: () => api.get("/admin/dashboard/support/summary").then((r) => r.data?.data ?? r.data),
    enabled: _hasHydrated && role === "support",
    retry: 1,
  });

  // ── 6. Finance Summary Query ────────────────────────────────────────────────
  const {
    data: financeSummary,
    isLoading: loadingFinanceSummary,
    error: financeError,
    refetch: refetchFinance,
  } = useQuery<FinanceDashboardSummary>({
    queryKey: ["finance-dashboard-summary"],
    queryFn: () => api.get("/admin/dashboard/finance/summary").then((r) => r.data?.data ?? r.data),
    enabled: _hasHydrated && role === "finance",
    retry: 1,
  });

  // ── 7. Finance Recent Activity Query ────────────────────────────────────────
  const {
    data: financeRecent,
    isLoading: loadingFinanceRecent,
    error: financeRecentError,
    refetch: refetchFinanceRecent,
  } = useQuery<FinanceRecentActivityItem[]>({
    queryKey: ["finance-dashboard-recent-activity"],
    queryFn: () => api.get("/admin/dashboard/finance/recent-activity?limit=15").then((r) => r.data?.data ?? r.data),
    enabled: _hasHydrated && role === "finance",
    retry: 1,
  });

  const hasAnyError =
    (role === "sales" && salesError) ||
    (role === "support" && supportError) ||
    (role === "finance" && (financeError || financeRecentError)) ||
    (!["sales", "support", "finance"].includes(role ?? "") && (summaryError || pendingError || activityError));

  const handleRetryAll = () => {
    if (role === "sales") {
      refetchSales();
    } else if (role === "support") {
      refetchSupport();
    } else if (role === "finance") {
      refetchFinance();
      refetchFinanceRecent();
    } else {
      refetchSummary();
      refetchPending();
      refetchActivity();
    }
  };

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users-count", defaultCountry],
    queryFn: () => fetchUsers(usersParams),
    enabled: scopedQueriesEnabled && canViewUsers,
  });
  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ["admin-bookings-dash", defaultCountry],
    queryFn: () => fetchBookings(bookingsParams),
    enabled: scopedQueriesEnabled,
  });

  const { data: listingsData, isLoading: loadingListings } = useQuery({
    queryKey: ["admin-listings-dash", defaultCountry],
    queryFn: () => fetchListings(listingsParams),
    enabled: scopedQueriesEnabled,
  });
  const { data: queueData, isLoading: loadingQueue } = useQuery({
    queryKey: ["admin-queue-dash", queueParams],
    queryFn: () => fetchReviewQueue(queueParams),
    enabled: scopedQueriesEnabled,
  });
  const { data: auditData, isLoading: loadingAudit } = useQuery({ queryKey: ["admin-audit-dash"], queryFn: fetchAuditLogs, enabled: scopedQueriesEnabled && canViewAudit });
  const rawUsers: any[] = usersData?.users ?? [];
  const scopedUsers = isCountryManager && defaultCountry
    ? rawUsers.filter((u) => u.country?.toUpperCase() === defaultCountry.toUpperCase())
    : rawUsers;
  const usersTotal = isCountryManager ? scopedUsers.length : (usersData?.total ?? 0);
  const bookings: any[] = bookingsData?.bookings ?? [];
  const confirmedBookings = bookings.filter((b) => ["confirmed", "completed"].includes(b.status));
  const totalRevenue = confirmedBookings.reduce((s, b) => s + Number(b.totalAmount ?? 0), 0);
  const totalCommission = confirmedBookings.reduce((s, b) => s + Number(b.commissionAmount ?? 0), 0);
  const totalPayout = confirmedBookings.reduce((s, b) => s + Number(b.providerPayout ?? 0), 0);
  const revenueChart = buildRevenueChart(bookings);
  const statusDonut = buildStatusDonut(bookings);
  const auditLogs: any[] = auditData?.logs ?? [];

  return (
    <div className="space-y-6 max-w-screen-2xl pb-12">
      <SectionHeader
        title={
          isSuperAdmin
            ? "Super Admin Dashboard"
            : isAdmin
            ? "Admin Dashboard"
            : role === "sales"
            ? "Sales Agent Dashboard"
            : role === "support"
            ? "Support Agent Dashboard"
            : role === "finance"
            ? "Finance Dashboard"
            : "Country Manager Dashboard"
        }
        description={`Overview · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        action={
          hasAnyError && (
            <button
              onClick={handleRetryAll}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm hover:bg-rose-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
              Retry Failed Widgets
            </button>
          )
        }
      />

      {/* Global Error Banner if Statistics fails */}
      {(summaryError || salesError || supportError || financeError || financeRecentError) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <div className="flex-1 text-sm font-medium">
            Failed to load dashboard summary statistics. The server might be experiencing temporary downtime.
          </div>
          <button
            onClick={handleRetryAll}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-white border border-rose-200 rounded-lg shadow-sm hover:bg-rose-50 text-rose-700 transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Dashboard KPI Cards */}
        {role === "sales" && (
          <>
            <StatCard
              title="Total Bookings"
              value={salesSummary?.totalBookings ?? 0}
              icon={<CalendarDays className="h-4 w-4 text-primary" />}
              iconBg="bg-primary/10"
              loading={loadingSalesSummary}
            />
            <StatCard
              title="Pending Payments"
              value={bookings.filter((b) => b.status === "pending_payment").length}
              change={0}
              icon={<Clock className="h-4 w-4 text-warning" />}
              iconBg="bg-warning/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Confirmed Bookings"
              value={bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).length}
              change={0}
              icon={<CheckCircle2 className="h-4 w-4 text-success" />}
              iconBg="bg-success/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Cancelled Bookings"
              value={bookings.filter((b) => b.status.startsWith("cancelled")).length}
              change={0}
              icon={<XCircle className="h-4 w-4 text-danger" />}
              iconBg="bg-danger/10"
              loading={loadingBookings}
            />
          </>
        )}

        {/* Support Dashboard KPI Cards */}
        {role === "support" && (
          <>
            <StatCard
              title="Total Bookings"
              value={supportSummary?.totalBookings ?? 0}
              icon={<CalendarDays className="h-4 w-4 text-primary" />}
              iconBg="bg-primary/10"
              loading={loadingSupportSummary}
            />
            <StatCard
              title="Captured Payments"
              value={supportSummary?.totalPayments ?? 0}
              icon={<CheckCircle2 className="h-4 w-4 text-success" />}
              iconBg="bg-success/10"
              loading={loadingSupportSummary}
            />
          </>
        )}

        {/* Finance Dashboard KPI Cards */}
        {role === "finance" && (
          <>
            <StatCard
              title="Total Revenue"
              value={financeSummary?.totalRevenue ?? 0}
              currency="USD"
              icon={<DollarSign className="h-4 w-4 text-success" />}
              iconBg="bg-success/10"
              loading={loadingFinanceSummary}
            />
            <StatCard
              title="Payment Count"
              value={financeSummary?.totalPayments ?? 0}
              icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
              iconBg="bg-primary/10"
              loading={loadingFinanceSummary}
            />
            <StatCard
              title="Report Count"
              value={financeSummary?.totalReports ?? 0}
              icon={<AlertCircle className="h-4 w-4 text-warning" />}
              iconBg="bg-warning/10"
              loading={loadingFinanceSummary}
            />
          </>
        )}

        {/* Standard / Admin / Country Manager KPI Cards */}
        {role !== "sales" && role !== "support" && role !== "finance" && (
          <>
            <StatCard
              title="Total Bookings"
              value={bookingsData?.total ?? 0}
              change={3.4}
              icon={<CalendarDays className="h-4 w-4 text-primary" />}
              iconBg="bg-primary/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Pending Payments"
              value={bookings.filter((b) => b.status === "pending_payment").length}
              change={0}
              icon={<Clock className="h-4 w-4 text-warning" />}
              iconBg="bg-warning/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Confirmed Bookings"
              value={bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).length}
              change={0}
              icon={<CheckCircle2 className="h-4 w-4 text-success" />}
              iconBg="bg-success/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Cancelled Bookings"
              value={bookings.filter((b) => b.status.startsWith("cancelled")).length}
              change={0}
              icon={<XCircle className="h-4 w-4 text-danger" />}
              iconBg="bg-danger/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Total Revenue"
              value={totalRevenue}
              currency="USD"
              change={7.2}
              icon={<DollarSign className="h-4 w-4 text-success" />}
              iconBg="bg-success/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Platform Commission"
              value={totalCommission}
              currency="USD"
              change={5.1}
              icon={<TrendingUp className="h-4 w-4 text-info" />}
              iconBg="bg-info/10"
              loading={loadingBookings}
            />
            <StatCard
              title="Total Listings"
              value={listingsData?.total ?? 0}
              change={2.1}
              icon={<Building2 className="h-4 w-4 text-teal-600" />}
              iconBg="bg-teal-100"
              loading={loadingListings}
            />
            <StatCard
              title="Pending Accreditation"
              value={queueData?.total ?? 0}
              icon={<BadgeCheck className="h-4 w-4 text-warning" />}
              iconBg="bg-warning/10"
              loading={loadingQueue}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className={`grid grid-cols-1 ${role !== "sales" && role !== "support" ? "lg:grid-cols-3" : ""} gap-4`}>
        {role !== "sales" && role !== "support" && (
          <Card className={role === "finance" ? "lg:col-span-3" : "lg:col-span-2"} padding="none">
            <div className="p-5 border-b border-border">
              <CardHeader title="Monthly Revenue" description="Last 6 months — confirmed + completed bookings" />
            </div>
            <div className="p-5">
              {loadingBookings ? (
                <div className="h-[220px] bg-slate-100 rounded-lg animate-shimmer" />
              ) : (
                <RevenueBarChart data={revenueChart} />
              )}
            </div>
          </Card>
        )}

        {role !== "finance" && (
          <Card padding="none" className={role === "sales" || role === "support" ? "lg:col-span-1" : ""}>
            <div className="p-5 border-b border-border">
              <CardHeader title="Booking Status" description="Distribution across all bookings" />
            </div>
            <div className="p-5">
              {loadingBookings ? (
                <div className="h-[220px] bg-slate-100 rounded-lg animate-shimmer" />
              ) : statusDonut.length > 0 ? (
                <DonutChart data={statusDonut} />
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                  No booking data
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Bottom row — Recent activity + pending queue */}
      <div className={`grid grid-cols-1 ${role !== "sales" && role !== "support" && role !== "finance" ? "lg:grid-cols-2" : ""} gap-4`}>
        {/* Recent bookings */}
        {role !== "finance" && (
          <Card padding="none" className={role === "sales" || role === "support" ? "lg:col-span-1" : ""}>
            <div className="p-5 border-b border-border">
              <CardHeader title="Recent Bookings" description="Latest activity" />
            </div>
            <div className="divide-y divide-border">
              {loadingBookings ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <div className="h-8 w-8 bg-slate-200 rounded-full animate-shimmer" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-200 rounded w-3/4 animate-shimmer" />
                      <div className="h-3 bg-slate-200 rounded w-1/2 animate-shimmer" />
                    </div>
                  </div>
                ))
              ) : bookings.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No bookings yet</div>
              ) : (
                bookings.slice(0, 6).map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar
                      name={`${b.guestFirstName ?? "G"} ${b.guestLastName ?? ""}`}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {b.guestFirstName} {b.guestLastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {b.reference} · {b.listing?.name ?? b.listingId}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-900 tabular">
                        {formatCurrency(Number(b.totalAmount), b.currency)}
                      </p>
                      <Badge label={b.status} status={b.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Audit activity feed */}
        {role !== "sales" && role !== "support" && role !== "finance" && (
          <Card padding="none" className="lg:col-span-2">
            <div className="p-5 border-b border-border">
              <CardHeader title="Audit Activity" description="Recent admin actions" />
            </div>
            <div className="divide-y divide-border">
              {loadingAudit ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-4">
                    <div className="h-2 w-2 bg-slate-200 rounded-full mt-2 animate-shimmer flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-200 rounded w-full animate-shimmer" />
                      <div className="h-3 bg-slate-200 rounded w-2/3 animate-shimmer" />
                    </div>
                  </div>
                ))
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No audit entries</div>
              ) : (
                auditLogs.map((log: any) => (
                  <div key={log.id} className="flex gap-3 px-5 py-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{slugToLabel(log.action)}</span>
                        {log.targetType && (
                          <span className="text-slate-500"> on {slugToLabel(log.targetType)}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge label={log.role} status={log.role} size="sm" />
                        <span className="text-xs text-slate-400">
                          {formatRelativeTime(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Finance Recent Activity Feed */}
        {role === "finance" && (
          <Card padding="none" className="lg:col-span-2">
            <div className="p-5 border-b border-border">
              <CardHeader title="Finance Recent Activity" description="Recent refund activity" />
            </div>
            <div className="divide-y divide-border">
              {loadingFinanceRecent ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <div className="h-8 w-8 bg-slate-200 rounded-full animate-shimmer" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-200 rounded w-3/4 animate-shimmer" />
                      <div className="h-3 bg-slate-200 rounded w-1/2 animate-shimmer" />
                    </div>
                  </div>
                ))
              ) : !financeRecent || financeRecent.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">No recent refund activities</div>
              ) : (
                financeRecent.map((act: any) => (
                  <div key={act.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0 text-purple-600">
                      <RotateCcw className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        Refund Issued <span className="text-xs text-slate-400 font-normal">by {act.actor ?? "system"}</span>
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Payment ID: {act.metadata?.paymentId || "—"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-rose-600 tabular">
                        -{formatCurrency(Number(act.metadata?.amount || 0), "USD")}
                      </p>
                      <span className="text-xs text-slate-400">
                        {formatRelativeTime(act.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

