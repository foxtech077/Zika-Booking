"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, TrendingUp, Users, Building2, CalendarDays } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { api } from "@/lib/api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard, RevenueBarChart, DonutChart } from "@/components/charts/Charts";
import { formatNumber, formatCurrency, slugToLabel } from "@/lib/utils";
import { useEurRates, toEur } from "@/lib/eur";
import type { Booking } from "@/types/admin";
import { canAccess } from "@/permissions/rbac";
import { useAuthStore } from "@/stores/auth";

const fetchAllBookings = () =>
  listingApi.get("/admin/bookings?limit=100").then((r) => r.data.data ?? r.data);

const fetchUsers = () =>
  api.get("/admin/users?limit=1").then((r) => r.data.data ?? r.data);

const CATEGORY_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

function buildCategoryBreakdown(bookings: Booking[]) {
  const counts: Record<string, number> = {};
  for (const b of bookings) {
    counts[b.listingType] = (counts[b.listingType] ?? 0) + 1;
  }
  return Object.entries(counts).map(([name, value], i) => ({
    name: slugToLabel(name),
    value,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
  }));
}

function buildRevenueChart(bookings: Booking[], rates: ReturnType<typeof useEurRates>) {
  const byMonth: Record<string, { revenue: number; bookings: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short" });
    byMonth[key] = { revenue: 0, bookings: 0 };
  }
  for (const b of bookings) {
    if (["confirmed", "completed"].includes(b.status)) {
      const d = new Date(b.createdAt);
      const key = d.toLocaleString("default", { month: "short" });
      if (byMonth[key]) {
        const eur = toEur(b.totalAmount, b.currency, rates);
        if (eur != null) byMonth[key].revenue += eur;
        byMonth[key].bookings += 1;
      }
    }
  }
  return Object.entries(byMonth).map(([label, v]) => ({ label, ...v }));
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#3b82f6",
  completed: "#10b981",
  pending_payment: "#f59e0b",
  cancelled_by_guest: "#94a3b8",
  cancelled_by_provider: "#f97316",
  cancelled_by_system: "#ef4444",
};

export default function ReportsPage() {
  const { user } = useAuthStore();
  const canExportFinancialData = user?.role === "super_admin" || user?.role === "finance";

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["reports-bookings"],
    queryFn: fetchAllBookings,
  });
  const { data: usersData } = useQuery({
    queryKey: ["reports-users"],
    queryFn: fetchUsers,
    enabled: canAccess(user?.role, "view_reports"),
  });

  const bookings: Booking[] = bookingsData?.bookings ?? [];
  const confirmed = bookings.filter((b) => ["confirmed", "completed"].includes(b.status));
  const cancelled = bookings.filter((b) => b.status.startsWith("cancelled"));
  const eurRates = useEurRates(bookings.map((b) => b.currency));
  const toEurAmount = (amount: number | string, currency?: string | null) => toEur(amount, currency, eurRates) ?? 0;
  const totalRevenue = confirmed.reduce((s, b) => s + toEurAmount(b.totalAmount, b.currency), 0);
  const totalCommission = confirmed.reduce((s, b) => s + toEurAmount(b.commissionAmount, b.currency), 0);
  const conversionRate = bookings.length > 0 ? (confirmed.length / bookings.length) * 100 : 0;

  const categoryData = buildCategoryBreakdown(bookings);
  const statusData = Object.entries(
    bookings.reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }), {} as Record<string, number>)
  ).map(([name, value], i) => ({ name: slugToLabel(name), value, color: (STATUS_COLORS[name] ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]! ?? "#94a3b8") as string }));

  const revenueChart = buildRevenueChart(bookings, eurRates);

  const exportSummary = () => {
    const csv = [
      ["Metric", "Value"],
      ["Total Bookings", bookings.length],
      ["Confirmed Bookings", confirmed.length],
      ["Cancelled Bookings", cancelled.length],
      ["Total Revenue (EUR)", totalRevenue.toFixed(2)],
      ["Platform Commission (EUR)", totalCommission.toFixed(2)],
      ["Conversion Rate (%)", conversionRate.toFixed(1)],
      ["Total Users", usersData?.total ?? 0],
    ].map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kainook-platform-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-screen-xl">
      <SectionHeader
        title="Reports"
        description="Platform analytics and performance metrics"
        action={
          canExportFinancialData && (
            <Button
              variant="secondary"
              size="sm"
              onClick={exportSummary}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export Summary
            </Button>
          )
        }
      />

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bookings"
          value={bookings.length}
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          iconBg="bg-primary/10"
          loading={isLoading}
        />
        <StatCard
          title="Total Revenue"
          value={totalRevenue}
          currency="EUR"
          icon={<TrendingUp className="h-4 w-4 text-success" />}
          iconBg="bg-success/10"
          loading={isLoading}
        />
        <StatCard
          title="Commission Earned"
          value={totalCommission}
          currency="EUR"
          icon={<BarChart3 className="h-4 w-4 text-info" />}
          iconBg="bg-info/10"
          loading={isLoading}
        />
        <StatCard
          title="Conversion Rate"
          value={Math.round(conversionRate)}
          subValue={`${confirmed.length} confirmed of ${bookings.length}`}
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          iconBg="bg-purple-100"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" padding="none">
          <div className="p-5 border-b border-border">
            <CardHeader title="12-Month Revenue Trend" description="Confirmed + completed bookings" />
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="h-60 bg-slate-100 rounded-lg animate-shimmer" />
            ) : (
              <RevenueBarChart data={revenueChart} height={240} currency="EUR" />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card padding="none">
            <div className="p-4 border-b border-border">
              <CardHeader title="By Category" />
            </div>
            <div className="p-4">
              <DonutChart data={categoryData} height={180} />
            </div>
          </Card>

          <Card padding="none">
            <div className="p-4 border-b border-border">
              <CardHeader title="By Status" />
            </div>
            <div className="p-4">
              <DonutChart data={statusData} height={180} />
            </div>
          </Card>
        </div>
      </div>

      {/* Summary table */}
      <Card>
        <CardHeader title="Performance Summary" description="Key platform metrics at a glance" />
        <div className="mt-4 space-y-0">
          {[
            { label: "Total Bookings", value: formatNumber(bookings.length) },
            { label: "Confirmed Bookings", value: formatNumber(confirmed.length) },
            { label: "Cancelled Bookings", value: formatNumber(cancelled.length) },
            { label: "Total Revenue", value: formatCurrency(totalRevenue, "EUR") },
            { label: "Platform Commission", value: formatCurrency(totalCommission, "EUR") },
            { label: "Provider Payouts", value: formatCurrency(totalRevenue - totalCommission, "EUR") },
            { label: "Conversion Rate", value: `${conversionRate.toFixed(1)}%` },
            { label: "Total Users", value: formatNumber(usersData?.total ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-3 border-b border-border last:border-0">
              <span className="text-sm text-slate-600">{label}</span>
              <span className="text-sm font-semibold text-slate-900 tabular">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
