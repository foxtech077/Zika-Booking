"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  BarChart3, Calendar, Globe, DollarSign, TrendingUp, 
  Download, Printer, FileSpreadsheet, Eye, Info,
  BadgeCheck, Clock, RotateCcw, Landmark, Percent,
  CreditCard, XCircle
} from "lucide-react";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard, RevenueBarChart, DonutChart } from "@/components/charts/Charts";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { useMockFinanceStore, type Transaction, type Refund, type CommissionRule } from "@/lib/mock-finance-store";
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency, slugToLabel } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { paymentPayoutApi } from "@/lib/payment-api";
import { listingApi } from "@/lib/listing-api";

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

type ReportTab = "revenue" | "payment" | "payout" | "refund" | "commission";

export default function FinancialReportsPage() {
  const { user } = useAuthStore();
  const { payouts } = useMockFinanceStore();

  const { data: commissionData } = useQuery({
    queryKey: ["admin-commission-rates-reports"],
    queryFn: async () => {
      const res = await listingApi.get(`/admin/commission-rates`);
      return res.data.data ?? res.data;
    },
  });

  const dbCommissionRules = commissionData?.rates ?? [];

  const commissionRules: CommissionRule[] = useMemo(() => {
    const rules: CommissionRule[] = dbCommissionRules.map((r: any) => ({
      id: r.id,
      country: r.country,
      rate: Number(r.rate) * 100, // convert decimal to percentage
      setBy: r.setBy,
      updatedAt: r.updatedAt,
      effectiveDate: r.pendingEffectiveFrom ?? undefined,
      isScheduled: r.pendingRate !== null,
    }));
    const globalRate = commissionData?.globalRate !== undefined ? Number(commissionData.globalRate) * 100 : 10;
    rules.push({
      id: "global",
      country: "Global",
      rate: globalRate,
      setBy: "System",
      updatedAt: new Date().toISOString(),
    });
    return rules;
  }, [dbCommissionRules, commissionData]);

  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ["admin-payments-reports"],
    queryFn: async () => {
      const res = await paymentPayoutApi.get(`/admin/payments`, {
        params: { page: "1", limit: "100" },
      });
      return res.data;
    },
  });

  const payments = paymentsData?.data ?? [];

  const transactions: Transaction[] = useMemo(() => {
    return payments.map((p: any) => ({
      id: p.id,
      reference: p.bookingId,
      date: p.capturedAt ?? p.createdAt,
      amount: Number(p.amount),
      currency: p.currency,
      status: (p.status === "captured" ? "successful" : p.status) as any,
      commissionAmount: Number(p.amount) * 0.1,
      commissionRate: 10,
      country: "Global",
      gateway: (p.paymentProvider === "stripe" ? "Stripe" : p.paymentProvider === "tara" ? "Tara" : "Stripe") as any,
      transactionId: p.providerPaymentId ?? p.id,
      travellerName: "Guest",
      travellerEmail: "guest@test.com",
      listingId: "listing-id",
      listingName: "Listing",
      listingType: "hotel" as const,
      providerId: "provider-id",
      providerName: "Provider",
      providerPayout: Number(p.amount) * 0.9,
      logs: [],
    }));
  }, [payments]);

  const { data: refundsData } = useQuery({
    queryKey: ["admin-refunds-pending-reports"],
    queryFn: async () => {
      const res = await paymentPayoutApi.get(`/admin/refunds/pending`);
      return res.data;
    },
  });

  const refundsList = refundsData?.data ?? [];

  const refunds: Refund[] = useMemo(() => {
    return refundsList.map((r: any) => ({
      id: r.id,
      bookingId: r.bookingId,
      bookingReference: r.bookingId,
      travellerName: "Guest",
      travellerEmail: "guest@test.com",
      originalAmount: Number(r.payment?.amount ?? 0),
      refundAmount: Number(r.amount),
      currency: r.currency,
      reason: r.reason ?? "No reason provided",
      status: (r.status === "pending" ? "pending_approval" : r.status) as any,
      requestedDate: r.createdAt,
      country: "Global",
      type: "full" as const,
    }));
  }, [refundsList]);

  const canExportFinancialData = user?.role === "super_admin" || user?.role === "finance";

  const [mounted, setMounted] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportTab>("revenue");
  const [countryFilter, setCountryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter datasets based on dates and country scopes
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (user?.role === "country_manager" && !user.countryScope?.includes(tx.country)) return false;
      if (countryFilter && tx.country !== countryFilter) return false;
      if (startDate && new Date(tx.date) < new Date(startDate)) return false;
      if (endDate && new Date(tx.date) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [transactions, user, countryFilter, startDate, endDate]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      if (user?.role === "country_manager" && !user.countryScope?.includes(p.country)) return false;
      if (countryFilter && p.country !== countryFilter) return false;
      if (startDate && new Date(p.scheduledDate) < new Date(startDate)) return false;
      if (endDate && new Date(p.scheduledDate) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [payouts, user, countryFilter, startDate, endDate]);

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (user?.role === "country_manager" && !user.countryScope?.includes(r.country)) return false;
      if (countryFilter && r.country !== countryFilter) return false;
      if (startDate && new Date(r.requestedDate) < new Date(startDate)) return false;
      if (endDate && new Date(r.requestedDate) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [refunds, user, countryFilter, startDate, endDate]);

  // Report Specific Tables & Data Aggregation
  const reportTableData = useMemo(() => {
    switch (activeReport) {
      case "revenue":
        // Group by Month
        const revMap: Record<string, { id: string; period: string; gross: number; bookingsCount: number; avgValue: number; country: string }> = {};
        filteredTxs.forEach((tx) => {
          if (tx.status === "successful") {
            const dateObj = new Date(tx.date);
            const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
            if (!revMap[key]) {
              revMap[key] = { id: key, period: key, gross: 0, bookingsCount: 0, avgValue: 0, country: countryFilter || "All" };
            }
            revMap[key].gross += tx.amount;
            revMap[key].bookingsCount += 1;
          }
        });
        return Object.values(revMap).map((m) => ({
          ...m,
          avgValue: m.bookingsCount ? m.gross / m.bookingsCount : 0,
        })).sort((a, b) => b.period.localeCompare(a.period));

      case "payment":
        // List individual transactions with gateways
        return filteredTxs.map((t) => ({
          id: t.id,
          reference: t.reference,
          traveller: t.travellerName,
          gateway: t.gateway,
          transactionId: t.transactionId,
          amount: t.amount,
          currency: t.currency,
          date: t.date,
          status: t.status,
        }));

      case "payout":
        // Group by provider
        const payMap: Record<string, { id: string; providerName: string; totalPaid: number; pendingCount: number; completedCount: number; failedCount: number }> = {};
        filteredPayouts.forEach((p) => {
          const key = p.providerId;
          if (!payMap[key]) {
            payMap[key] = { id: key, providerName: p.providerName, totalPaid: 0, pendingCount: 0, completedCount: 0, failedCount: 0 };
          }
          if (p.status === "completed") {
            payMap[key].totalPaid += p.amount;
            payMap[key].completedCount += 1;
          } else if (p.status === "failed") {
            payMap[key].failedCount += 1;
          } else {
            payMap[key].pendingCount += 1;
          }
        });
        return Object.values(payMap);

      case "refund":
        // List individual refunds
        return filteredRefunds.map((r) => ({
          id: r.id,
          reference: r.bookingReference,
          traveller: r.travellerName,
          originalAmount: r.originalAmount,
          refundAmount: r.refundAmount,
          reason: r.reason,
          status: r.status,
          date: r.requestedDate,
        }));

      case "commission":
        // Group by country
        const commMap: Record<string, { id: string; country: string; totalRevenue: number; commissionEarned: number; bookingsCount: number }> = {};
        filteredTxs.forEach((tx) => {
          if (tx.status === "successful") {
            const key = tx.country;
            if (!commMap[key]) {
              commMap[key] = { id: key, country: key, totalRevenue: 0, commissionEarned: 0, bookingsCount: 0 };
            }
            commMap[key].totalRevenue += tx.amount;
            commMap[key].commissionEarned += tx.commissionAmount;
            commMap[key].bookingsCount += 1;
          }
        });
        return Object.values(commMap);

      default:
        return [];
    }
  }, [activeReport, filteredTxs, filteredPayouts, filteredRefunds, countryFilter]);

  // Dynamic columns based on active tab
  const tableColumns = useMemo((): Column<any>[] => {
    switch (activeReport) {
      case "revenue":
        return [
          { key: "period", label: "Month/Year", render: (r) => <span className="font-semibold text-slate-800">{r.period}</span> },
          { key: "bookingsCount", label: "Successful Bookings", render: (r) => <span>{r.bookingsCount}</span> },
          { key: "avgValue", label: "Avg Booking Value", align: "right", render: (r) => <span className="tabular font-medium">{formatCurrency(r.avgValue)}</span> },
          { key: "gross", label: "Gross Volume", align: "right", render: (r) => <span className="tabular font-bold text-slate-900">{formatCurrency(r.gross)}</span> },
        ];
      case "payment":
        return [
          { key: "ref", label: "Booking Ref", render: (r) => <span className="font-mono font-medium text-primary">{r.reference}</span> },
          { key: "traveller", label: "Traveller", render: (r) => <span>{r.traveller}</span> },
          { key: "gateway", label: "Gateway", render: (r) => <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{r.gateway}</span> },
          { key: "date", label: "Date", render: (r) => <span className="text-xs text-slate-500">{formatDate(r.date)}</span> },
          { key: "amount", label: "Amount", align: "right", render: (r) => <span className="tabular font-semibold">{formatCurrency(r.amount, r.currency)}</span> },
          { key: "status", label: "Status", render: (r) => <Badge label={r.status} status={r.status === "successful" ? "confirmed" : r.status === "failed" ? "cancelled_by_system" : r.status === "refunded" ? "suspended" : "pending_payment"} /> },
        ];
      case "payout":
        return [
          { key: "provider", label: "Provider Beneficiary", render: (r) => <span className="font-semibold text-slate-800">{r.providerName}</span> },
          { key: "completedCount", label: "Settled Count", render: (r) => <span>{r.completedCount} transfers</span> },
          { key: "pendingCount", label: "Pending/Scheduled", render: (r) => <span className="text-slate-500">{r.pendingCount} holded</span> },
          { key: "failedCount", label: "Failed", render: (r) => <span className={r.failedCount ? "text-danger font-medium" : "text-slate-400"}>{r.failedCount} failed</span> },
          { key: "totalPaid", label: "Total Paid Out", align: "right", render: (r) => <span className="tabular font-bold text-emerald-600">{formatCurrency(r.totalPaid)}</span> },
        ];
      case "refund":
        return [
          { key: "ref", label: "Refund ID & Booking", render: (r) => <div><p className="font-semibold text-xs text-slate-400">{r.id}</p><p className="font-mono text-sm text-primary font-semibold">{r.reference}</p></div> },
          { key: "traveller", label: "Traveller", render: (r) => <span>{r.traveller}</span> },
          { key: "date", label: "Requested Date", render: (r) => <span className="text-xs text-slate-500">{formatDate(r.date)}</span> },
          { key: "reason", label: "Reason", render: (r) => <p className="text-xs text-slate-500 truncate max-w-[200px]" title={r.reason}>{r.reason}</p> },
          { key: "amount", label: "Refund Amount", align: "right", render: (r) => <span className="tabular font-bold text-danger">{formatCurrency(r.refundAmount)}</span> },
          { key: "status", label: "Status", render: (r) => <Badge label={r.status} status={r.status === "processed" ? "confirmed" : r.status === "approved" ? "confirmed" : r.status === "rejected" ? "cancelled_by_guest" : "pending_payment"} /> },
        ];
      case "commission":
        return [
          { key: "country", label: "Country", render: (r) => <span className="font-semibold text-slate-800">{r.country}</span> },
          { key: "bookingsCount", label: "Bookings", render: (r) => <span>{r.bookingsCount}</span> },
          { key: "totalRevenue", label: "Total Volume", align: "right", render: (r) => <span className="tabular font-medium">{formatCurrency(r.totalRevenue)}</span> },
          { key: "commissionEarned", label: "Commission Earned", align: "right", render: (r) => <span className="tabular font-bold text-blue-600">{formatCurrency(r.commissionEarned)}</span> },
        ];
      default:
        return [];
    }
  }, [activeReport]);

  // Export File logic (CSV / Excel simulation)
  const triggerExport = (format: "csv" | "excel") => {
    let headers: string[] = [];
    let rows: any[][] = [];
    const fileName = `financial-${activeReport}-report-${new Date().toISOString().split("T")[0]}`;

    if (activeReport === "revenue") {
      headers = ["Period", "Successful Bookings", "Avg Booking Value", "Gross Volume"];
      rows = reportTableData.map((r: any) => [r.period, r.bookingsCount, r.avgValue, r.gross]);
    } else if (activeReport === "payment") {
      headers = ["Booking Ref", "Traveller", "Gateway", "Transaction ID", "Amount", "Currency", "Date", "Status"];
      rows = reportTableData.map((r: any) => [r.reference, r.traveller, r.gateway, r.transactionId, r.amount, r.currency, r.date, r.status]);
    } else if (activeReport === "payout") {
      headers = ["Provider", "Settled Count", "Pending Count", "Failed Count", "Total Settled Amount"];
      rows = reportTableData.map((r: any) => [r.providerName, r.completedCount, r.pendingCount, r.failedCount, r.totalPaid]);
    } else if (activeReport === "refund") {
      headers = ["Refund ID", "Booking Ref", "Traveller", "Original Paid", "Refund Amount", "Reason", "Status", "Requested Date"];
      rows = reportTableData.map((r: any) => [r.id, r.reference, r.traveller, r.originalAmount, r.refundAmount, r.reason, r.status, r.date]);
    } else if (activeReport === "commission") {
      headers = ["Country", "Bookings Count", "Total Revenue Volume", "Commission Earned"];
      rows = reportTableData.map((r: any) => [r.country, r.bookingsCount, r.totalRevenue, r.commissionEarned]);
    }

    if (format === "csv") {
      const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Excel Tab Delimited simulation (works seamlessly in MS Excel)
      const xlsContent = [headers, ...rows].map(r => r.join("\t")).join("\n");
      const blob = new Blob([xlsContent], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // KPI calculations based on activeTab
  const currentSummaryCards = useMemo(() => {
    switch (activeReport) {
      case "revenue":
        const totGross = filteredTxs.filter(t => t.status === "successful").reduce((sum, t) => sum + t.amount, 0);
        const count = filteredTxs.filter(t => t.status === "successful").length;
        const avg = count ? totGross / count : 0;
        return (
          <>
            <StatCard title="Gross Transaction Volume" value={totGross} currency="USD" icon={<DollarSign className="text-emerald-600 h-4 w-4" />} iconBg="bg-emerald-100" />
            <StatCard title="Successful Bookings" value={count} icon={<BadgeCheck className="text-blue-600 h-4 w-4" />} iconBg="bg-blue-100" />
            <StatCard title="Avg Booking Checkout" value={avg} currency="USD" icon={<TrendingUp className="text-purple-600 h-4 w-4" />} iconBg="bg-purple-100" />
          </>
        );

      case "payment":
        const attempts = filteredTxs.length;
        const successCount = filteredTxs.filter(t => t.status === "successful").length;
        const failCount = filteredTxs.filter(t => t.status === "failed").length;
        const successRate = attempts ? (successCount / (attempts - filteredTxs.filter(t => t.status === "pending").length || 1)) * 100 : 100;
        return (
          <>
            <StatCard title="Payment Attempts" value={attempts} icon={<CreditCard className="text-indigo-600 h-4 w-4" />} iconBg="bg-indigo-100" />
            <StatCard title="Gateway Success Rate" value={successRate} icon={<BadgeCheck className="text-emerald-600 h-4 w-4" />} iconBg="bg-emerald-100" />
            <StatCard title="Failed Checkout Attempts" value={failCount} icon={<XCircle className="text-red-600 h-4 w-4" />} iconBg="bg-red-100" />
          </>
        );

      case "payout":
        const settledAmount = filteredPayouts.filter(p => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
        const pendingAmount = filteredPayouts.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
        const failedPayoutsCount = filteredPayouts.filter(p => p.status === "failed").length;
        return (
          <>
            <StatCard title="Total Payouts Settled" value={settledAmount} currency="USD" icon={<Landmark className="text-emerald-600 h-4 w-4" />} iconBg="bg-emerald-100" />
            <StatCard title="Awaiting Release Escrow" value={pendingAmount} currency="USD" icon={<Clock className="text-amber-600 h-4 w-4" />} iconBg="bg-amber-100" />
            <StatCard title="Failed Bank Transfers" value={failedPayoutsCount} icon={<XCircle className="text-red-600 h-4 w-4" />} iconBg="bg-red-100" />
          </>
        );

      case "refund":
        const totRefunded = filteredRefunds.filter(r => r.status === "processed").reduce((sum, r) => sum + r.refundAmount, 0);
        const pendingRefsCount = filteredRefunds.filter(r => r.status === "pending_approval").length;
        const approvedRefsCount = filteredRefunds.filter(r => r.status === "approved").length;
        return (
          <>
            <StatCard title="Total Cleared Refunds" value={totRefunded} currency="USD" icon={<RotateCcw className="text-danger h-4 w-4" />} iconBg="bg-red-100" />
            <StatCard title="Claims Pending Review" value={pendingRefsCount} icon={<Clock className="text-amber-600 h-4 w-4" />} iconBg="bg-amber-100" />
            <StatCard title="Claims Approved (Escrow)" value={approvedRefsCount} icon={<BadgeCheck className="text-blue-600 h-4 w-4" />} iconBg="bg-blue-100" />
          </>
        );

      case "commission":
        const commEarned = filteredTxs.filter(t => t.status === "successful").reduce((sum, t) => sum + t.commissionAmount, 0);
        const avgRate = commissionRules.find(r => r.country === "Global")?.rate || 10;
        return (
          <>
            <StatCard title="Platform Commission Earned" value={commEarned} currency="USD" icon={<TrendingUp className="text-blue-600 h-4 w-4" />} iconBg="bg-blue-100" />
            <StatCard title="Standard Global Rate" value={avgRate} icon={<Percent className="text-purple-600 h-4 w-4" />} iconBg="bg-purple-100" />
            <StatCard title="Active Country Overrides" value={commissionRules.filter(r => r.country !== "Global").length} icon={<Globe className="text-indigo-600 h-4 w-4" />} iconBg="bg-indigo-100" />
          </>
        );

      default:
        return null;
    }
  }, [activeReport, filteredTxs, filteredPayouts, filteredRefunds, commissionRules]);

  const CM_OPTIONS = useMemo(() => {
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
    <div className="space-y-6 max-w-screen-2xl print:bg-white print:p-0">
      {/* Header hidden in print view */}
      <div className="print:hidden">
        <SectionHeader
          title="Financial Reports"
          description="Access generated analytical data grids for revenue, gateways, provider payouts, refunds, and platform commission margins."
        />
      </div>

      {/* Printing layout header */}
      <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Zika Booking Platform</h1>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">
          Financial Report: {activeReport.toUpperCase()} Reports
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Generated on {new Date().toLocaleDateString()} · Filter: {countryFilter || "Global Countries Scope"}
        </p>
      </div>

      {/* Tabs selectors - Hidden in print */}
      <div className="flex border-b border-border bg-white rounded-t-xl px-4 pt-3 gap-2 print:hidden">
        {([
          { key: "revenue", label: "Revenue Reports", icon: DollarSign, color: "text-emerald-600" },
          { key: "payment", label: "Payment Reports", icon: CreditCard, color: "text-indigo-600" },
          { key: "payout", label: "Payout Reports", icon: Landmark, color: "text-blue-600" },
          { key: "refund", label: "Refund Reports", icon: RotateCcw, color: "text-red-600" },
          { key: "commission", label: "Commission Reports", icon: Percent, color: "text-purple-600" },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveReport(tab.key); }}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all leading-none ${
                isActive 
                  ? "border-primary text-primary" 
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-primary" : tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters block - Hidden in print */}
      <Card className="p-4 bg-white border border-border print:hidden" padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">

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

            {(countryFilter || startDate || endDate) && (
              <button
                onClick={() => {
                  setCountryFilter("");
                  setStartDate("");
                  setEndDate("");
                }}
                className="mt-5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors border border-border hover:bg-slate-50 rounded-lg h-[38px]"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Export Actions Panel */}
          {canExportFinancialData && (
            <div className="flex gap-2 self-end mt-4 sm:mt-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => triggerExport("csv")}
                leftIcon={<Download className="h-4 w-4" />}
              >
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => triggerExport("excel")}
                leftIcon={<FileSpreadsheet className="h-4 w-4 text-emerald-700" />}
              >
                Export Excel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrintPDF}
                leftIcon={<Printer className="h-4 w-4" />}
              >
                Print Report (PDF)
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentSummaryCards}
      </div>

      {/* Detailed report table */}
      <Card padding="none" className="bg-white border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-slate-50/50 print:hidden">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {activeReport} Audit Grid
          </h4>
        </div>
        <DataTable
          columns={tableColumns}
          data={reportTableData}
          loading={false}
          emptyTitle={`No report data matches selected filters`}
          emptyDescription={`Try widening your date ranges or verifying user scope variables.`}
          emptyIcon={<BarChart3 className="h-10 w-10 text-slate-300" />}
        />
      </Card>
    </div>
  );
}
