"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users, Building2, CalendarDays, BadgeCheck,
  DollarSign, TrendingUp, Clock, AlertCircle,
  RefreshCw, ChevronRight, ShieldAlert, CreditCard
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatCard } from "@/components/charts/Charts";
import { Card, CardHeader, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatCurrency, formatRelativeTime, slugToLabel } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

export default function DashboardPage() {
  const { user, _hasHydrated } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";
  const isCountryManager = user?.role === "country_manager";
  const isDashboardUser = isSuperAdmin || isAdmin || isCountryManager;
  const queriesEnabled = _hasHydrated && isDashboardUser;

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

  // ── 4. Operators Query (for resolving names in activity feed) ───────────────
  const { data: operatorsData } = useQuery({
    queryKey: ["admin-dashboard-operators", user?.role],
    queryFn: () => api.get("/admin/operators?limit=1000").then((r) => r.data?.data?.operators ?? r.data?.operators ?? []),
    enabled: queriesEnabled,
    retry: 1,
  });

  // Non-Dashboard access restriction
  if (_hasHydrated && !isDashboardUser) {
    return (
      <div className="space-y-6 max-w-screen-2xl">
        <SectionHeader
          title="Dashboard"
          description={`Overview · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
        />
        <Card className="max-w-lg mx-auto mt-12 p-8 text-center border-amber-200 bg-amber-50/50">
          <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-600 mb-4">
            The Dashboard is restricted to accounts with Admin or Manager privileges.
          </p>
          <p className="text-xs text-slate-500">
            Please use the navigation menu to access listing management, bookings, or user details assigned to your role.
          </p>
        </Card>
      </div>
    );
  }

  // Common trigger to retry all queries if there's any failure
  const handleRetryAll = () => {
    if (summaryError) refetchSummary();
    if (pendingError) refetchPending();
    if (activityError) refetchActivity();
  };

  const hasAnyError = Boolean(summaryError || pendingError || activityError);

  // Statistics Mappings
  const stats = [
    {
      title: "Total Bookings",
      value: summaryData?.totalBookings ?? 0,
      icon: <CalendarDays className="h-4 w-4 text-primary" />,
      iconBg: "bg-primary/10",
    },
    {
      title: "Total Revenue",
      value: summaryData?.totalRevenue ?? 0,
      currency: "USD",
      icon: <DollarSign className="h-4 w-4 text-success" />,
      iconBg: "bg-success/10",
    },
    {
      title: "Total Users",
      value: summaryData?.totalUsers ?? 0,
      icon: <Users className="h-4 w-4 text-purple-600" />,
      iconBg: "bg-purple-100",
    },
    {
      title: "Total Listings",
      value: summaryData?.totalListings ?? 0,
      icon: <Building2 className="h-4 w-4 text-teal-600" />,
      iconBg: "bg-teal-100",
    },
    {
      title: "Total Hosts",
      value: summaryData?.totalAccreditations ?? 0,
      icon: <BadgeCheck className="h-4 w-4 text-indigo-600" />,
      iconBg: "bg-indigo-100",
    },
    {
      title: "Total Payments",
      value: summaryData?.totalPayments ?? 0,
      icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
      iconBg: "bg-emerald-100",
    },
    {
      title: "Audit Log Count",
      value: summaryData?.totalAudits ?? 0,
      icon: <Clock className="h-4 w-4 text-rose-600" />,
      iconBg: "bg-rose-100",
    },
  ];

  // Pending Tasks Mappings
  const pendingTasks = [
    {
      id: "hotel-approvals",
      title: "Hotel Approvals",
      count: pendingData?.pendingHotelApprovals ?? 0,
      description: "Listings waiting for admin review & activation",
      link: "/dashboard/listings",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    },
    {
      id: "accreditation-reviews",
      title: "Accreditation Reviews",
      count: pendingData?.pendingAccreditationReviews ?? 0,
      description: "Host applications waiting for verification",
      link: "/dashboard/host-accreditations",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    },
    {
      id: "refund-requests",
      title: "Refund Requests",
      count: pendingData?.pendingRefundRequests ?? 0,
      description: "Pending guest booking refunds requiring confirmation",
      link: "/dashboard/finance/refunds",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    },
  ];

  const totalPendingCount =
    (pendingData?.pendingHotelApprovals ?? 0) +
    (pendingData?.pendingAccreditationReviews ?? 0) +
    (pendingData?.pendingRefundRequests ?? 0);

  const activities = activityData ?? [];

  const operators = operatorsData ?? [];
  const operatorMap = new Map<string, string>();
  operators.forEach((op: any) => {
    if (op.id && op.name) {
      operatorMap.set(op.id, op.name);
    }
  });

  return (
    <div className="space-y-6 max-w-screen-2xl pb-12">
      <SectionHeader
        title={
          isSuperAdmin
            ? "Super Admin Dashboard"
            : isAdmin
              ? "Admin Dashboard"
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
      {summaryError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <div className="flex-1 text-sm font-medium">
            Failed to load dashboard summary statistics. The server might be experiencing temporary downtime.
          </div>
          <button
            onClick={() => refetchSummary()}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-white border border-rose-200 rounded-lg shadow-sm hover:bg-rose-50 text-rose-700 transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <StatCard
            key={idx}
            title={stat.title}
            value={stat.value}
            currency={stat.currency}
            icon={stat.icon}
            iconBg={stat.iconBg}
            loading={loadingSummary}
          />
        ))}
      </div>

      {/* Main content row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pending Actions & Tasks */}
        <Card padding="none" className="lg:col-span-1 flex flex-col">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <CardHeader
              title="Pending Actions"
              description="Tasks waiting for administrative action"
            />
            {loadingPending ? (
              <div className="h-5 w-12 bg-slate-100 rounded animate-shimmer" />
            ) : pendingError ? (
              <span className="text-xs text-rose-500 flex items-center gap-1 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Error
              </span>
            ) : (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${totalPendingCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                }`}>
                {totalPendingCount} items
              </span>
            )}
          </div>

          <div className="flex-1 p-5 space-y-4">
            {loadingPending ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-slate-100 rounded-xl">
                  <div className="h-8 w-8 bg-slate-100 rounded-lg animate-shimmer flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-100 rounded w-1/3 animate-shimmer" />
                    <div className="h-2.5 bg-slate-100 rounded w-2/3 animate-shimmer" />
                  </div>
                </div>
              ))
            ) : pendingError ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-rose-200 rounded-xl bg-rose-50/20">
                <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800">Failed to load tasks</p>
                <button
                  onClick={() => refetchPending()}
                  className="mt-3 text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-all"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              </div>
            ) : totalPendingCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                  <BadgeCheck className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">All Caught Up!</p>
                <p className="text-xs text-slate-500 mt-1">No pending administrative actions require your attention right now.</p>
              </div>
            ) : (
              pendingTasks.map((task) => (
                <Link
                  key={task.id}
                  href={task.link}
                  className="flex items-start gap-4 p-4 border border-slate-100 rounded-xl hover:border-primary-light hover:bg-slate-50/50 transition-all duration-200 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors">
                        {task.title}
                      </span>
                      {task.count > 0 && (
                        <span className={`text-xs font-semibold px-2 py-0.25 rounded-full border ${task.badgeColor}`}>
                          {task.count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary transition-all group-hover:translate-x-0.5 mt-0.5" />
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Recent Activity Feed */}
        <Card padding="none" className="lg:col-span-2 flex flex-col">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <CardHeader
              title="Recent Activity Feed"
              description="Chronological audit logs, listing reviews, and refund details"
            />
            {activityError && (
              <button
                onClick={() => refetchActivity()}
                className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            )}
          </div>

          <div className="flex-1 divide-y divide-border overflow-y-auto max-h-[500px]">
            {loadingActivity ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 items-start">
                  <div className="h-2 w-2 rounded-full bg-slate-200 mt-2 animate-shimmer flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-1/2 animate-shimmer" />
                    <div className="h-2.5 bg-slate-100 rounded w-3/4 animate-shimmer" />
                  </div>
                </div>
              ))
            ) : activityError ? (
              <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500">
                <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800">Failed to load activity feed</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">Please check your network connection or session token.</p>
                <button
                  onClick={() => refetchActivity()}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg shadow-sm text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <RefreshCw className="h-3 w-3" /> Try Again
                </button>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400">
                <Clock className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium">No recent activities found</p>
                <p className="text-xs text-slate-500 mt-1">Actions performed by admins or system operations will show up here.</p>
              </div>
            ) : (
              activities.map((item: any) => {
                let badgeStyle = "bg-slate-100 text-slate-700";
                let actionLabel = slugToLabel(item.action);

                if (item.action === "admin_login" || item.action === "admin_login_attempt") {
                  const roleMap: Record<string, string> = {
                    super_admin: "Super Admin",
                    admin: "Admin",
                    country_manager: "Country Manager",
                    sales: "Sales Agent",
                    support: "Support Agent",
                    finance: "Finance Manager",
                  };
                  const role = item.metadata?.role;
                  if (role && roleMap[role]) {
                    const suffix = item.action === "admin_login" ? "Login" : "Login Attempt";
                    actionLabel = `${roleMap[role]} ${suffix}`;
                  }
                }

                if (item.type === "refund") {
                  badgeStyle = "bg-rose-100 text-rose-700 border-rose-200";
                } else if (item.type === "moderation") {
                  badgeStyle = "bg-amber-100 text-amber-700 border-amber-200";
                } else if (item.type === "audit") {
                  badgeStyle = "bg-purple-100 text-purple-700 border-purple-200";
                }

                const displayName = item.actor === "system" ? "system" : (operatorMap.get(item.actor) || item.actor);

                return (
                  <div key={item.id} className="flex gap-4 px-5 py-3.5 hover:bg-slate-50/40 transition-colors">
                    <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${item.type === "refund" ? "bg-rose-500" : item.type === "moderation" ? "bg-amber-500" : "bg-purple-500"
                      }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {actionLabel}
                        </p>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.25 rounded border ${badgeStyle}`}>
                          {item.type}
                        </span>

                        <span className="text-xs text-slate-500">
                          by <span className="font-medium text-slate-700 cursor-help" title={item.actor && item.actor !== "system" ? `User ID: ${item.actor}` : undefined}>{displayName}</span>
                        </span>
                      </div>

                      {/* Optional metadata visualization */}
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs text-slate-600">
                          {item.type === "refund" && item.metadata.amount && (
                            <div className="flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                              <span>Refund Amount: <strong>{formatCurrency(item.metadata.amount)}</strong></span>
                              {item.metadata.paymentId && (
                                <span className="text-slate-400">· Payment: {item.metadata.displayId ?? item.metadata.paymentId}</span>
                              )}
                            </div>
                          )}

                          {item.type === "audit" && item.metadata.target && (
                            <div>
                              <span>Target: <strong>{slugToLabel(item.metadata.target)}</strong></span>
                              {item.metadata.role && (
                                <span className="text-slate-400"> · Role: {item.metadata.role}</span>
                              )}
                            </div>
                          )}

                          {item.type === "moderation" && (
                            <div className="space-y-1">
                              {item.metadata.listingId && (
                                <div>Listing ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">{item.metadata.listingId}</code></div>
                              )}
                              {item.metadata.reason && (
                                <div className="italic text-slate-500">Reason: "{item.metadata.reason}"</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}

