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
import { formatDate, formatNumber } from "@/lib/utils";
import { useEurRates, EurValue, toEur } from "@/lib/eur";
import { SYSTEM_COUNTRIES } from "@/lib/countries";
import type { Booking } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";

const fetchBookings = (params: Record<string, string>) =>
  listingApi.get(`/admin/bookings?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

function buildRevenueChart(bookings: Booking[], rates: ReturnType<typeof useEurRates>) {
  const byMonth: Record<string, { revenue: number; bookings: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short" });
    byMonth[key] = { revenue: 0, bookings: 0 };
  }
  for (const b of (Array.isArray(bookings) ? bookings : [])) {
    if (["confirmed", "completed"].includes(b?.status)) {
      const d = b?.createdAt ? new Date(b.createdAt) : new Date();
      if (isNaN(d.getTime())) continue;
      const key = d.toLocaleString("default", { month: "short" });
      if (byMonth[key]) {
        const eur = toEur(b?.totalAmount, b?.currency, rates);
        if (eur != null) byMonth[key].revenue += eur;
        byMonth[key].bookings += 1;
      }
    }
  }
  return Object.entries(byMonth).map(([label, v]) => ({ label, ...v }));
}

export default function FinancePage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState("confirmed");
  const [country, setCountry] = useState("");

  const canExportFinancialData = user?.role === "super_admin" || user?.role === "finance";

  const isCountryScoped = user?.role === "country_manager" || user?.role === "sales";
  const scopedCountries = isCountryScoped ? (user?.countryScope ?? []) : [];
  const countryOptions = scopedCountries.length > 0
    ? scopedCountries.map((c) => {
        const found = SYSTEM_COUNTRIES.find((sc) => sc.code === c);
        return { value: c, label: found ? `${found.flag} ${found.name}` : c };
      })
    : SYSTEM_COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }));

  const params = { status, country, page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-finance-bookings", page, limit, status, country],
    queryFn: () => fetchBookings(params),
  });

  const allBookingsQuery = useQuery({
    queryKey: ["admin-finance-all", country],
    queryFn: async () => {
      // Fetch ALL bookings (paginated) so the KPI aggregates are complete —
      // a fixed 100-row cap previously made the numbers silently wrong.
      const limit = 100;
      const first = await fetchBookings({ limit: String(limit), ...(country ? { country } : {}) });
      const all = [...(first.bookings ?? [])];
      const total = Number(first.total ?? all.length);
      for (let offset = limit; offset < total; offset += limit) {
        const page = await fetchBookings({ limit: String(limit), offset: String(offset), ...(country ? { country } : {}) });
        all.push(...(page.bookings ?? []));
      }
      return { bookings: all, total };
    },
  });

  const bookings: Booking[] = Array.isArray(data?.bookings) ? data.bookings : [];
  const total: number = data?.total ?? 0;

  const allBookings: Booking[] = Array.isArray(allBookingsQuery.data?.bookings) ? allBookingsQuery.data.bookings : [];
  const confirmed = allBookings.filter((b) => ["confirmed", "completed"].includes(b?.status));

  // EUR-converted display rates — every transaction settles in EUR (Stripe) or
  // XAF (Tara, pegged to EUR), so financial aggregates are shown in EUR.
  const eurRates = useEurRates([...bookings, ...allBookings].map((b) => b?.currency));

  const totalRevenue = confirmed.reduce((s, b) => {
    const eur = toEur(b?.totalAmount, b?.currency, eurRates);
    return s + (eur ?? 0);
  }, 0);
  const totalCommission = confirmed.reduce((s, b) => {
    const eur = toEur(b?.commissionAmount, b?.currency, eurRates);
    return s + (eur ?? 0);
  }, 0);
  const totalPayout = confirmed.reduce((s, b) => {
    const eur = toEur(b?.providerPayout, b?.currency, eurRates);
    return s + (eur ?? 0);
  }, 0);
  const avgBookingValue = confirmed.length ? totalRevenue / confirmed.length : 0;
  const revenueChart = buildRevenueChart(allBookings, eurRates);

  const exportCsv = () => {
    const headers = ["Reference", "Guest", "Listing", "Type", "Status", "Amount", "Commission", "Payout", "Currency", "Date"];
    const rows = bookings.map((b) => [
      b?.reference || "—",
      `${b?.guestFirstName || ""} ${b?.guestLastName || ""}`.trim() || "—",
      b?.listing?.name ?? b?.listingId ?? "—",
      b?.listingType || "—",
      b?.status || "—",
      b?.totalAmount || 0,
      b?.commissionAmount || 0,
      b?.providerPayout || 0,
      b?.currency || "USD",
      b?.createdAt ? formatDate(b.createdAt) : "—",
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
      render: (b) => <span className="font-mono text-sm font-medium text-primary">{b?.reference ?? "—"}</span>,
    },
    {
      key: "guest",
      label: "Guest",
      render: (b) => (
        <div>
          <p className="font-medium text-sm">{b?.guestFirstName} {b?.guestLastName}</p>
          <p className="text-xs text-slate-500">{b?.guestEmail}</p>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (b) => <span className="text-sm capitalize text-slate-600">{b?.listingType ?? "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (b) => <Badge label={b?.status ?? "unknown"} status={b?.status ?? "default"} />,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      render: (b) => (
        <span className="font-semibold text-sm tabular"><EurValue amount={b?.totalAmount} currency={b?.currency} rates={eurRates} /></span>
      ),
    },
    {
      key: "commission",
      label: "Commission",
      align: "right",
      render: (b) => (
        <span className="text-sm tabular text-info-dark"><EurValue amount={b?.commissionAmount} currency={b?.currency} rates={eurRates} /></span>
      ),
    },
    {
      key: "payout",
      label: "Provider Payout",
      align: "right",
      render: (b) => (
        <span className="text-sm tabular text-success-dark"><EurValue amount={b?.providerPayout} currency={b?.currency} rates={eurRates} /></span>
      ),
    },
    {
      key: "date",
      label: "Date",
      render: (b) => <span className="text-xs text-slate-500">{b?.createdAt ? formatDate(b.createdAt) : "—"}</span>,
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-2xl">
      <SectionHeader
        title="Payment Dashboard"
        description="Revenue, commission, and provider payout overview"
        action={
          canExportFinancialData && (
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export CSV
            </Button>
          )
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={totalRevenue}
          currency="EUR"
          icon={<DollarSign className="h-4 w-4 text-success" />}
          iconBg="bg-success/10"
          loading={allBookingsQuery.isLoading}
        />
        <StatCard
          title="Platform Commission"
          value={totalCommission}
          currency="EUR"
          icon={<TrendingUp className="h-4 w-4 text-info" />}
          iconBg="bg-info/10"
          loading={allBookingsQuery.isLoading}
        />
        <StatCard
          title="Provider Payouts"
          value={totalPayout}
          currency="EUR"
          icon={<DollarSign className="h-4 w-4 text-warning" />}
          iconBg="bg-warning/10"
          loading={allBookingsQuery.isLoading}
        />
        <StatCard
          title="Avg. Booking Value"
          value={avgBookingValue}
          currency="EUR"
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
          <RevenueBarChart data={revenueChart} height={240} currency="EUR" />
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
            {
              key: "country",
              label: "All Countries",
              value: country,
              onChange: (v) => { setCountry(v); setPage(1); },
              options: countryOptions,
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
          actions={
            canExportFinancialData && (
              <Button
                variant="secondary"
                size="sm"
                onClick={exportCsv}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Export
              </Button>
            )
          }
        />
        <DataTable
          columns={columns}
          data={bookings}
          loading={isLoading}
          emptyTitle="No transactions found"
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
