"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users, Building2, CalendarDays, BadgeCheck,
  DollarSign, TrendingUp, Clock, AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { listingApi } from "@/lib/listing-api";
import { StatCard, RevenueBarChart, DonutChart } from "@/components/charts/Charts";
import { Card, CardHeader, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency, formatRelativeTime, slugToLabel } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const fetchUsers = () =>
  api.get("/admin/users?limit=1").then((r) => r.data.data ?? r.data);

const fetchBookings = () =>
  listingApi.get("/admin/bookings?limit=100").then((r) => r.data.data ?? r.data);

const fetchListings = () =>
  listingApi.get("/admin/listings?limit=1").then((r) => r.data.data ?? r.data);

const fetchReviewQueue = () =>
  listingApi.get("/admin/listings/review-queue?limit=1").then((r) => r.data.data ?? r.data);

const fetchAuditLogs = () =>
  api.get("/admin/audit-logs?limit=8").then((r) => r.data.data ?? r.data);

// ── Revenue aggregator (from bookings) ───────────────────────────────────────

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

// ── Booking status donut data ─────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: usersData, isLoading: loadingUsers } = useQuery({ queryKey: ["admin-users-count"], queryFn: fetchUsers });
  const { data: bookingsData, isLoading: loadingBookings } = useQuery({ queryKey: ["admin-bookings-dash"], queryFn: fetchBookings });
  const { data: listingsData, isLoading: loadingListings } = useQuery({ queryKey: ["admin-listings-dash"], queryFn: fetchListings });
  const { data: queueData, isLoading: loadingQueue } = useQuery({ queryKey: ["admin-queue-dash"], queryFn: fetchReviewQueue });
  const role = useAuthStore(state => state.user?.role);
  const { data: auditData, isLoading: loadingAudit } = useQuery({ queryKey: ["admin-audit-dash"], queryFn: fetchAuditLogs });
  const bookings: any[] = bookingsData?.bookings ?? [];
  const confirmedBookings = bookings.filter((b) => ["confirmed", "completed"].includes(b.status));
  const totalRevenue = confirmedBookings.reduce((s, b) => s + Number(b.totalAmount ?? 0), 0);
  const totalCommission = confirmedBookings.reduce((s, b) => s + Number(b.commissionAmount ?? 0), 0);
  const revenueChart = buildRevenueChart(bookings);
  const statusDonut = buildStatusDonut(bookings);

  return (
    <div className="space-y-6 max-w-screen-2xl">
      <SectionHeader
        title="Dashboard"
        description={`Overview · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bookings"
          value={bookingsData?.total ?? 0}
          change={3.4}
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          iconBg="bg-primary/10"
          loading={loadingBookings}
        />
        {role !== "sales" && (
          <StatCard
            title="Total Revenue"
            value={totalRevenue}
            currency="USD"
            change={7.2}
            icon={<DollarSign className="h-4 w-4 text-success" />}
            iconBg="bg-success/10"
            loading={loadingBookings}
          />
        )}
        {role !== "sales" && (
          <StatCard
            title="Platform Commission"
            value={totalCommission}
            currency="USD"
            change={5.1}
            icon={<TrendingUp className="h-4 w-4 text-info" />}
            iconBg="bg-info/10"
            loading={loadingBookings}
          />
        )}
        {role !== "sales" && (
          <StatCard
            title="Total Users"
            value={usersData?.total ?? 0}
            change={12.8}
            icon={<Users className="h-4 w-4 text-purple-600" />}
            iconBg="bg-purple-100"
            loading={loadingUsers}
          />
        )}
        {role !== "sales" && (
          <StatCard
            title="Total Listings"
            value={listingsData?.total ?? 0}
            change={2.1}
            icon={<Building2 className="h-4 w-4 text-teal-600" />}
            iconBg="bg-teal-100"
            loading={loadingListings}
          />
        )}
        {role !== "sales" && (
          <StatCard
            title="Pending Accreditation"
            value={queueData?.total ?? 0}
            icon={<BadgeCheck className="h-4 w-4 text-warning" />}
            iconBg="bg-warning/10"
            loading={loadingQueue}
          />
        )}
        <StatCard
          title="Confirmed Bookings"
          value={confirmedBookings.length}
          subValue={`of ${bookings.length} total`}
          icon={<CalendarDays className="h-4 w-4 text-green-600" />}
          iconBg="bg-green-100"
          loading={loadingBookings}
        />
        <StatCard
          title="Conversion Rate"
          value={bookings.length > 0 ? Math.round((confirmedBookings.length / bookings.length) * 100) : 0}
          subValue="confirmed / total"
          icon={<TrendingUp className="h-4 w-4 text-indigo-600" />}
          iconBg="bg-indigo-100"
          loading={loadingBookings}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {role !== "sales" && (
          <Card className="lg:col-span-2" padding="none">
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

        <Card padding="none">
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
      </div>

      {/* Bottom row — Recent activity + pending queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent bookings */}
        <Card padding="none">
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
          </div></Card>
        {role !== "sales" && (
  <Card padding="none">
    <div className="p-5 border-b border-border">
      <CardHeader title="Audit Activity" description="Recent actions" />
    </div>
    <div className="p-5">
      {loadingAudit ? (
        <div className="h-[220px] bg-slate-100 rounded-lg animate-shimmer" />
      ) : auditData && auditData.logs && auditData.logs.length > 0 ? (
        <ul className="space-y-2">
          {auditData.logs.slice(0, 5).map((log: any) => (
            <li key={log.id} className="text-sm text-slate-700">
              {log.message}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-slate-400 text-sm">No audit activity</div>
      )}
    </div>
  </Card>
)}
      </div>
    </div>
  );
}
