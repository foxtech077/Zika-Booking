"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Download } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard, RevenueBarChart } from "@/components/charts/Charts";
import { formatDate, formatCurrency, formatNumber } from "@/lib/utils";
import type { Booking } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";

const fetchBookings = (params: Record<string, string>) =>
  listingApi.get(`/admin/bookings?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

function buildRevenueChart(bookings: Booking[]) {
  const byMonth: Record<string, { revenue: number; bookings: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short" });
    byMonth[key] = { revenue: 0, bookings: 0 };
  }
  for (const b of bookings) {
    if (["confirmed", "completed"].includes(b.status)) {
      const d = new Date(b.createdAt);
      const key = d.toLocaleString("default", { month: "short" });
      if (byMonth[key]) {
        byMonth[key].revenue += Number(b.totalAmount);
        byMonth[key].bookings += 1;
      }
    }
  }
  return Object.entries(byMonth).map(([label, v]) => ({ label, ...v }));
}

export default function FinancePage() {
  const { user } = useAuthStore();
  const canExport = canAccess(user?.role, "manage_finance");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("confirmed");
  const [currency, setCurrency] = useState("");

  const params = { status, page: String(page), limit: "20" };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance-bookings", params],
    queryFn: () => fetchBookings(params),
  });

  const allBookingsQuery = useQuery({
    queryKey: ["admin-finance-all"],
    queryFn: () => fetchBookings({ limit: "100" }),
  });

  const bookings: Booking[] = data?.bookings ?? [];
  const total: number = data?.total ?? 0;
  const allBookings: Booking[] = allBookingsQuery.data?.bookings ?? [];
  const confirmed = allBookings.filter((b) => ["confirmed", "completed"].includes(b.status));

  const totalRevenue = confirmed.reduce((s, b) => s + Number(b.totalAmount), 0);
  const totalCommission = confirmed.reduce((s, b) => s + Number(b.commissionAmount), 0);
  const totalPayout = confirmed.reduce((s, b) => s + Number(b.providerPayout), 0);
  const avgBookingValue = confirmed.length ? totalRevenue / confirmed.length : 0;
  const revenueChart = buildRevenueChart(allBookings);

  const exportCsv = () => {
    const headers = ["Reference", "Guest", "Listing", "Type", "Status", "Amount", "Commission", "Payout", "Currency", "Date"];
    const rows = bookings.map((b) => [
      b.reference,
      `${b.guestFirstName} ${b.guestLastName}`,
      b.listing?.name ?? b.listingId,
      b.listingType,
      b.status,
      b.totalAmount,
      b.commissionAmount,
      b.providerPayout,
      b.currency,
      formatDate(b.createdAt),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-export-${formatDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Booking>[] = [
    {
      key: "ref",
      label: "Reference",
      render: (b) => <span className="font-mono text-sm font-medium text-primary">{b.reference}</span>,
    },
    {
      key: "guest",
      label: "Guest",
      render: (b) => (
        <div>
          <p className="font-medium text-sm">{b.guestFirstName} {b.guestLastName}</p>
          <p className="text-xs text-slate-500">{b.guestEmail}</p>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (b) => <span className="text-sm capitalize text-slate-600">{b.listingType}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (b) => <Badge label={b.status} status={b.status} />,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      render: (b) => (
        <span className="font-semibold text-sm tabular">{formatCurrency(Number(b.totalAmount), b.currency)}</span>
      ),
    },
    {
      key: "commission",
      label: "Commission",
      align: "right",
      render: (b) => (
        <span className="text-sm tabular text-info-dark">{formatCurrency(Number(b.commissionAmount), b.currency)}</span>
      ),
    },
    {
      key: "payout",
      label: "Provider Payout",
      align: "right",
      render: (b) => (
        <span className="text-sm tabular text-success-dark">{formatCurrency(Number(b.providerPayout), b.currency)}</span>
      ),
    },
    {
      key: "date",
      label: "Date",
      render: (b) => <span className="text-xs text-slate-500">{formatDate(b.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-2xl">
      <SectionHeader
        title="Finance"
        description="Revenue, commission, and provider payout overview"
        action={
          canExport ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={totalRevenue}
          currency="USD"
          icon={<DollarSign className="h-4 w-4 text-success" />}
          iconBg="bg-success/10"
          loading={allBookingsQuery.isLoading}
        />
        <StatCard
          title="Platform Commission"
          value={totalCommission}
          currency="USD"
          icon={<TrendingUp className="h-4 w-4 text-info" />}
          iconBg="bg-info/10"
          loading={allBookingsQuery.isLoading}
        />
        <StatCard
          title="Provider Payouts"
          value={totalPayout}
          currency="USD"
          icon={<DollarSign className="h-4 w-4 text-warning" />}
          iconBg="bg-warning/10"
          loading={allBookingsQuery.isLoading}
        />
        <StatCard
          title="Avg. Booking Value"
          value={avgBookingValue}
          currency="USD"
          subValue={`across ${formatNumber(confirmed.length)} bookings`}
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          iconBg="bg-purple-100"
          loading={allBookingsQuery.isLoading}
        />
      </div>

      {/* Revenue chart */}
      <Card padding="none">
        <div className="p-5 border-b border-border">
          <CardHeader title="Monthly Revenue Trend" description="Last 6 months" />
        </div>
        <div className="p-5">
          <RevenueBarChart data={revenueChart} height={240} />
        </div>
      </Card>

      {/* Transactions table */}
      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "confirmed", label: "Confirmed" },
                { value: "completed", label: "Completed" },
                { value: "cancelled_by_guest", label: "Cancelled" },
                { value: "pending_payment", label: "Pending" },
              ],
            },
          ]}
          actions={
            canExport ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={exportCsv}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Export
              </Button>
            ) : undefined
          }
        />
        <DataTable
          columns={columns}
          data={bookings}
          loading={isLoading}
          emptyTitle="No transactions found"
        />
        <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
