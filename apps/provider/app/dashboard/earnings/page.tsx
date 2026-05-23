"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Percent, Calendar } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatCard, RevenueBarChart } from "@/components/charts/Charts";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";
import type { EarningsData } from "@/types/provider";

const fetchEarnings = () =>
  listingApi
    .get<{ success: boolean; data: EarningsData }>("/provider/earnings")
    .then((r) => r.data.data);

export default function EarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["provider-earnings"],
    queryFn:  fetchEarnings,
    staleTime: 5 * 60_000,
  });

  const monthlyChartData = (data?.monthly ?? []).slice(-6).map((m) => ({
    label: formatMonthLabel(m.month),
    revenue: m.payout,
  }));

  const columns: Column<EarningsData["recentPayouts"][0]>[] = [
    {
      key: "listing",
      label: "Listing",
      render: (p) => (
        <div>
          <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{p.listingName ?? "—"}</p>
          <span className="text-xs text-slate-400 capitalize">{p.category}</span>
        </div>
      ),
    },
    {
      key: "ref",
      label: "Reference",
      render: (p) => <code className="text-xs text-slate-600 font-mono">{p.reference}</code>,
    },
    {
      key: "total",
      label: "Total Charged",
      render: (p) => (
        <span className="text-sm text-slate-700">{formatCurrency(p.totalAmount, p.currency)}</span>
      ),
    },
    {
      key: "commission",
      label: "Commission",
      render: (p) => (
        <span className="text-sm text-slate-500">-{formatCurrency(p.commission, p.currency)}</span>
      ),
    },
    {
      key: "payout",
      label: "Your Payout",
      render: (p) => (
        <span className="text-sm font-bold text-emerald-700">{formatCurrency(p.payout, p.currency)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (p) => <Badge label={p.status} status={p.status} />,
    },
    {
      key: "date",
      label: "Confirmed",
      render: (p) => <span className="text-xs text-slate-400">{formatDate(p.confirmedAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Earnings & Payouts"
        subtitle="Track your revenue, commissions, and provider payouts"
      />

      {/* All-time stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Revenue Generated"
          value={formatCurrency(data?.allTime.revenue ?? 0)}
          subtitle="Gross booking value"
          icon={<DollarSign />}
          color="blue"
          loading={isLoading}
        />
        <StatCard
          title="Platform Commission"
          value={formatCurrency(data?.allTime.commission ?? 0)}
          subtitle="ZikaBooking fees deducted"
          icon={<Percent />}
          color="amber"
          loading={isLoading}
        />
        <StatCard
          title="Net Payout to You"
          value={formatCurrency(data?.allTime.payout ?? 0)}
          subtitle="After commission"
          icon={<TrendingUp />}
          color="emerald"
          loading={isLoading}
        />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader
          title="Monthly Payout Trend"
          subtitle="Last 6 months"
          icon={<Calendar />}
        />
        {isLoading ? (
          <div className="h-48 bg-slate-50 rounded-xl animate-shimmer" />
        ) : (
          <RevenueBarChart data={monthlyChartData} />
        )}
      </Card>

      {/* Monthly breakdown table */}
      <Card>
        <CardHeader title="Monthly Breakdown" icon={<TrendingUp />} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Month", "Bookings", "Revenue", "Commission", "Payout"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-slate-100 rounded animate-shimmer" />
                        </td>
                      ))}
                    </tr>
                  ))
                : (data?.monthly ?? []).slice().reverse().map((m) => (
                    <tr key={m.month} className="hover:bg-surface-subtle transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">{formatMonthLabel(m.month)}</td>
                      <td className="py-3 px-4 text-slate-600">{m.bookings}</td>
                      <td className="py-3 px-4 text-slate-700">{formatCurrency(m.revenue)}</td>
                      <td className="py-3 px-4 text-slate-500">-{formatCurrency(m.commission)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">{formatCurrency(m.payout)}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent payout records */}
      <Card padding="none">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
          <p className="text-xs text-slate-500 mt-0.5">Latest confirmed bookings</p>
        </div>
        <DataTable
          columns={columns}
          data={data?.recentPayouts ?? []}
          keyExtractor={(p) => p.id}
          loading={isLoading}
          emptyTitle="No payouts yet"
          emptyMessage="Completed bookings will appear as payout records."
        />
      </Card>
    </div>
  );
}
