"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  DollarSign, TrendingUp, Landmark, BadgeCheck, XCircle, 
  RotateCcw, Clock, ShieldAlert, Monitor, ArrowRight 
} from "lucide-react";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard, RevenueBarChart, DonutChart } from "@/components/charts/Charts";
import { PaymentLifecycleFlow } from "@/components/finance/PaymentLifecycleFlow";
import { useMockFinanceStore } from "@/lib/mock-finance-store";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency, formatDate } from "@/lib/utils";

const COUNTRY_OPTIONS = [
  { value: "MT", label: "Malta (MT)" },
  { value: "US", label: "United States (US)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "DE", label: "Germany (DE)" },
  { value: "FR", label: "France (FR)" },
  { value: "ES", label: "Spain (ES)" },
  { value: "IT", label: "Italy (IT)" },
  { value: "IN", label: "India (IN)" },
  { value: "CA", label: "Canada (CA)" },
];

export default function PaymentDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { transactions } = useMockFinanceStore();

  const [mounted, setMounted] = useState(false);
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter transactions based on countryScope and UI filters
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Role Scope Filter
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(tx.country);
        if (!hasScope) return false;
      }

      // 2. Country Dropdown Filter
      if (countryFilter && tx.country !== countryFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter && tx.status !== statusFilter) {
        return false;
      }

      // 4. Date Range Filter
      if (startDate) {
        const txDate = new Date(tx.date);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (txDate < start) return false;
      }
      if (endDate) {
        const txDate = new Date(tx.date);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (txDate > end) return false;
      }

      return true;
    });
  }, [transactions, user, countryFilter, statusFilter, startDate, endDate]);

  // Derived Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let successfulCount = 0;
    let successfulAmount = 0;
    let failedCount = 0;
    let failedAmount = 0;
    let refundedCount = 0;
    let refundedAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let totalCommission = 0;
    let totalPayout = 0;

    filteredTxs.forEach((tx) => {
      if (tx.status === "successful") {
        successfulCount++;
        successfulAmount += tx.amount;
        totalRevenue += tx.amount;
        totalCommission += tx.commissionAmount;
        totalPayout += tx.providerPayout;
      } else if (tx.status === "failed") {
        failedCount++;
        failedAmount += tx.amount;
      } else if (tx.status === "refunded") {
        refundedCount++;
        refundedAmount += tx.amount;
        totalRevenue += tx.amount; // Count original gross value
        totalCommission += tx.commissionAmount; // Track gross commission
      } else if (tx.status === "pending") {
        pendingCount++;
        pendingAmount += tx.amount;
      }
    });

    return {
      totalRevenue,
      successfulCount,
      successfulAmount,
      failedCount,
      failedAmount,
      refundedCount,
      refundedAmount,
      pendingCount,
      pendingAmount,
      totalCommission,
      totalPayout,
    };
  }, [filteredTxs]);

  // Build Charts Data
  const statusChartData = useMemo(() => {
    return [
      { name: "Successful", value: metrics.successfulCount, color: "#10b981" },
      { name: "Pending", value: metrics.pendingCount, color: "#f59e0b" },
      { name: "Refunded", value: metrics.refundedCount, color: "#3b82f6" },
      { name: "Failed", value: metrics.failedCount, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [metrics]);

  const monthlyRevenueData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const byMonth: Record<string, { label: string; revenue: number; bookings: number }> = {};
    
    // Initialize last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = months[d.getMonth()]!;
      byMonth[mLabel] = { label: mLabel, revenue: 0, bookings: 0 };
    }

    filteredTxs.forEach((tx) => {
      if (tx.status === "successful" || tx.status === "refunded") {
        const d = new Date(tx.date);
        const mLabel = months[d.getMonth()]!;
        if (byMonth[mLabel]) {
          byMonth[mLabel].revenue += tx.amount;
          byMonth[mLabel].bookings += 1;
        }
      }
    });

    return Object.values(byMonth);
  }, [filteredTxs]);

  // Get allowed countries based on Country Manager scope
  const availableCountryOptions = useMemo(() => {
    if (user?.role === "country_manager") {
      return COUNTRY_OPTIONS.filter((opt) => user.countryScope?.includes(opt.value));
    }
    return COUNTRY_OPTIONS;
  }, [user]);

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl">
      <SectionHeader
        title="Payment Dashboard"
        description="Comprehensive summary of platform revenue, commissions, and transaction metrics."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/dashboard/finance/payments")}
              leftIcon={<Monitor className="h-4 w-4" />}
            >
              Monitor Transactions
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/dashboard/finance/payments?investigate=true")}
              leftIcon={<ShieldAlert className="h-4 w-4" />}
            >
              Investigate Payment Issues
            </Button>
          </div>
        }
      />

      {/* Date & Country Filters */}
      <Card className="p-4 bg-white border border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Country</label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px] min-w-[150px]"
              aria-label="Filter by Country"
            >
              <option value="">All Countries</option>
              {availableCountryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Payment Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px] min-w-[140px]"
              aria-label="Filter by Status"
            >
              <option value="">All Statuses</option>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px]"
                aria-label="Start Date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px]"
                aria-label="End Date"
              />
            </div>
          </div>

          {(countryFilter || statusFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setCountryFilter("");
                setStatusFilter("");
                setStartDate("");
                setEndDate("");
              }}
              className="mt-5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors border border-border hover:bg-slate-50 rounded-lg h-[38px]"
            >
              Clear Filters
            </button>
          )}
        </div>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Gross Revenue"
          value={metrics.totalRevenue}
          currency="USD"
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-100"
          subValue={`across ${filteredTxs.length} transaction attempts`}
        />
        <StatCard
          title="Total Commission Earned"
          value={metrics.totalCommission}
          currency="USD"
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-100"
          subValue={`Gross platform fee cut`}
        />
        <StatCard
          title="Total Provider Payouts"
          value={metrics.totalPayout}
          currency="USD"
          icon={<Landmark className="h-4 w-4 text-indigo-600" />}
          iconBg="bg-indigo-100"
          subValue={`Transfers settled or escrowed`}
        />
        <StatCard
          title="Payment Success Rate"
          value={filteredTxs.length > 0 ? (metrics.successfulCount / (filteredTxs.length - metrics.pendingCount || 1)) * 100 : 100}
          icon={<BadgeCheck className="h-4 w-4 text-purple-600" />}
          iconBg="bg-purple-100"
          subValue={`${metrics.successfulCount} success vs ${metrics.failedCount} failures`}
        />
      </div>

      {/* Small Metrics Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-border p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Successful Payments</p>
            <p className="text-lg font-bold text-slate-900 tabular">{formatCurrency(metrics.successfulAmount)}</p>
            <p className="text-[10px] text-slate-400">{metrics.successfulCount} transactions</p>
          </div>
        </div>

        <div className="bg-white border border-border p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="h-5 w-5 font-bold animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Pending Payments</p>
            <p className="text-lg font-bold text-slate-900 tabular">{formatCurrency(metrics.pendingAmount)}</p>
            <p className="text-[10px] text-slate-400">{metrics.pendingCount} transactions</p>
          </div>
        </div>

        <div className="bg-white border border-border p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Refunded Payments</p>
            <p className="text-lg font-bold text-slate-900 tabular">{formatCurrency(metrics.refundedAmount)}</p>
            <p className="text-[10px] text-slate-400">{metrics.refundedCount} transactions</p>
          </div>
        </div>

        <div className="bg-white border border-border p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Failed Payments</p>
            <p className="text-lg font-bold text-slate-900 tabular">{formatCurrency(metrics.failedAmount)}</p>
            <p className="text-[10px] text-slate-400">{metrics.failedCount} transactions</p>
          </div>
        </div>
      </div>

      {/* Visual Lifecycle Flow Component */}
      <PaymentLifecycleFlow activeStep={2} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" padding="none">
          <div className="p-5 border-b border-border">
            <CardHeader 
              title="Revenue Summary Trends" 
              description="Monthly revenue and transaction volumes for the last 6 months" 
            />
          </div>
          <div className="p-6">
            {monthlyRevenueData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-slate-400">
                No monthly data matching filters.
              </div>
            ) : (
              <RevenueBarChart data={monthlyRevenueData} height={240} />
            )}
          </div>
        </Card>

        <Card padding="none">
          <div className="p-5 border-b border-border">
            <CardHeader 
              title="Payment Status Breakdown" 
              description="Distribution of payment outcomes" 
            />
          </div>
          <div className="p-6 flex flex-col items-center justify-center">
            {statusChartData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm text-slate-400">
                No status data available.
              </div>
            ) : (
              <div className="w-full">
                <DonutChart data={statusChartData} height={180} />
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  {statusChartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 justify-center">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-600 font-medium">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Operational Actions */}
      <Card>
        <CardHeader 
          title="Operational Quick-Start Actions" 
          description="Direct shortcuts to common financial manager tasks." 
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <h5 className="font-semibold text-slate-900 text-sm">Approve Pending Payouts</h5>
              <p className="text-xs text-slate-500 mt-1">
                Release escrowed booking payments to provider bank accounts post T+24 hold period.
              </p>
            </div>
            <Button 
              className="mt-4 w-full" 
              variant="secondary" 
              size="sm"
              onClick={() => router.push("/dashboard/finance/payouts")}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Go to Payouts
            </Button>
          </div>

          <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <h5 className="font-semibold text-slate-900 text-sm">Process Refund Requests</h5>
              <p className="text-xs text-slate-500 mt-1">
                Approve, reject, or process full and partial traveller refunds under Flexible policies.
              </p>
            </div>
            <Button 
              className="mt-4 w-full" 
              variant="secondary" 
              size="sm"
              onClick={() => router.push("/dashboard/finance/refunds")}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Go to Refunds
            </Button>
          </div>

          <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between">
            <div>
              <h5 className="font-semibold text-slate-900 text-sm">Configure Country Commission Rates</h5>
              <p className="text-xs text-slate-500 mt-1">
                Set custom country commission rules or schedule automated platform rate adjustments.
              </p>
            </div>
            <Button 
              className="mt-4 w-full" 
              variant="secondary" 
              size="sm"
              onClick={() => router.push("/dashboard/commission")}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Configure Rates
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
