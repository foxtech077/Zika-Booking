"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { 
  BarChart3, Calendar, Globe, DollarSign, TrendingUp, 
  Download, Printer, FileSpreadsheet, Eye, Info,
  BadgeCheck, Clock, RotateCcw, Landmark, Percent,
  CreditCard, XCircle, Tag, Euro
} from "lucide-react";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard, RevenueBarChart, DonutChart } from "@/components/charts/Charts";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency, slugToLabel } from "@/lib/utils";
import { useEurRates, EurValue, toEur, formatEur, chargedToEur, toEurAtCharge } from "@/lib/eur";
import { useQuery } from "@tanstack/react-query";
import { paymentPayoutApi } from "@/lib/payment-api";
import { listingApi } from "@/lib/listing-api";
import type { 
  FinancialTransaction, 
  FinancialSummary, 
  FinancialReportsResponse,
  CommissionRate 
} from "@/types/admin";

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

  const { data: commissionData } = useQuery({
    queryKey: ["admin-commission-rates-reports"],
    queryFn: async () => {
      const res = await listingApi.get(`/admin/commission-rates`);
      return res.data.data ?? res.data;
    },
  });

  const dbCommissionRules = commissionData?.rates ?? [];

  const commissionRules = useMemo(() => {
    const rules = dbCommissionRules.map((r: any) => ({
      id: r.id,
      country: r.country,
      rate: Number(r.rate),
      setBy: r.setBy,
      updatedAt: r.updatedAt,
      effectiveDate: r.pendingEffectiveFrom ?? undefined,
      isScheduled: r.pendingRate !== null,
    }));
    const globalRate = commissionData?.globalRate !== undefined ? Number(commissionData.globalRate) : 10;
    rules.push({
      id: "global",
      country: "Global",
      rate: globalRate,
      setBy: "System",
      updatedAt: new Date().toISOString(),
      effectiveDate: undefined,
      isScheduled: false,
    });
    return rules;
  }, [dbCommissionRules, commissionData]);

  const { data: payoutsData } = useQuery({
    queryKey: ["admin-payouts-reports"],
    queryFn: async () => {
      const res = await paymentPayoutApi.get(`/admin/payouts`, {
        params: { page: "1", limit: "100" },
      });
      return res.data;
    },
  });

  const payouts = useMemo(() => {
    const payoutList = payoutsData?.data ?? [];
    return payoutList.map((p: any) => ({
      id: p.id,
      bookingId: p.bookingId,
      bookingReference: p.bookingReference ?? "—",
      paymentDisplayId: p.paymentDisplayId ?? null,
      providerId: p.providerId,
      providerName: p.merchant?.businessName ?? p.providerId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status as "pending" | "scheduled" | "completed" | "failed",
      method: "bank_transfer",
      scheduledDate: p.scheduledAt,
      processedDate: p.processedAt,
      country: "Global",
    }));
  }, [payoutsData]);

  const { data: refundsData } = useQuery({
    queryKey: ["admin-refunds-pending-reports"],
    queryFn: async () => {
      const res = await paymentPayoutApi.get(`/admin/refunds/pending`);
      return res.data;
    },
  });

  const refundsList = refundsData?.data ?? [];

  const refunds = useMemo(() => {
    return refundsList.map((r: any) => ({
      id: r.id,
      bookingId: r.bookingId,
      bookingReference: r.bookingReference ?? "—",
      paymentDisplayId: r.paymentDisplayId ?? null,
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

  // Fetch financial reports data from real API
  const { data: reportsData, isLoading: isReportsLoading } = useQuery({
    queryKey: ["admin-financial-reports", startDate, endDate, countryFilter],
    queryFn: async () => {
      const params: Record<string, string> = { page: "1", limit: "1000" };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (countryFilter) params.country = countryFilter;
      const res = await listingApi.get(`/admin/financial-reports?${new URLSearchParams(params)}`);
      return res.data.data as FinancialReportsResponse;
    },
  });

  const transactions: FinancialTransaction[] = reportsData?.transactions ?? [];

  // Filter datasets based on dates and country scopes
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (user?.role === "country_manager" && tx.country && !user.countryScope?.includes(tx.country)) return false;
      return true;
    });
  }, [transactions, user]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((p: any) => {
      if (user?.role === "country_manager" && !user.countryScope?.includes(p.country)) return false;
      if (countryFilter && p.country !== countryFilter) return false;
      if (startDate && new Date(p.scheduledDate) < new Date(startDate)) return false;
      if (endDate && new Date(p.scheduledDate) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [payouts, user, countryFilter, startDate, endDate]);

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r: any) => {
      if (user?.role === "country_manager" && !user.countryScope?.includes(r.country)) return false;
      if (countryFilter && r.country !== countryFilter) return false;
      if (startDate && new Date(r.requestedDate) < new Date(startDate)) return false;
      if (endDate && new Date(r.requestedDate) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [refunds, user, countryFilter, startDate, endDate]);

  // EUR display rates — the reporting KPI cards aggregate across currencies, so
  // every amount is converted to EUR (the money-of-record for all settlements).
  const eurRates = useEurRates([
    ...transactions.map((tx) => tx.currency),
    ...payouts.map((p: any) => p.currency),
    ...refunds.map((r: any) => r.currency),
  ]);

  /** EUR value of an amount in its own currency (0 when the rate is unavailable). */
  const eur = useCallback(
    (amount: number, currency?: string | null): number => toEur(amount, currency, eurRates) ?? 0,
    [eurRates],
  );

  // Report Specific Tables & Data Aggregation
  const reportTableData = useMemo(() => {
    switch (activeReport) {
      case "revenue":
        // Group by Month. Money flow: gross is the ACTUAL charge captured at
        // booking time (chargedAmount in EUR/XAF, converted to EUR via the
        // charge-time snapshot — see billing.service.ts). Platform net revenue
        // is gross minus the provider payout (which includes the full base +
        // delivery + deposit passed through to the provider).
        const revMap: Record<string, { 
          id: string; 
          period: string; 
          gross: number; 
          voucherDiscounts: number;
          payout: number;
          netRevenue: number;
          bookingsCount: number; 
          avgValue: number; 
          country: string 
        }> = {};
        filteredTxs.forEach((tx) => {
          const dateObj = new Date(tx.date);
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
          if (!revMap[key]) {
            revMap[key] = { 
              id: key, 
              period: key, 
              gross: 0, 
              voucherDiscounts: 0,
              payout: 0,
              netRevenue: 0,
              bookingsCount: 0, 
              avgValue: 0, 
              country: countryFilter || "All" 
            };
          }
          // Money flow: gross = the actual charge captured at booking time
          // (chargedAmount in EUR/XAF → EUR). The platform keeps the difference
          // between gross and the provider payout; everything else passes
          // through to the provider (see billing.service.ts).
          revMap[key].gross += chargedToEur(tx.chargedAmount, tx.chargedCurrency, eurRates)
            ?? eur(tx.amount, tx.currency);
          revMap[key].voucherDiscounts += eur(tx.voucherDiscount, tx.currency);
          revMap[key].payout += toEurAtCharge(tx.providerPayout, tx.currency, tx.chargedCurrency, tx.chargedRate, eurRates) ?? 0;
          revMap[key].netRevenue += (chargedToEur(tx.chargedAmount, tx.chargedCurrency, eurRates) ?? eur(tx.amount, tx.currency))
            - (toEurAtCharge(tx.providerPayout, tx.currency, tx.chargedCurrency, tx.chargedRate, eurRates) ?? 0);
          revMap[key].bookingsCount += 1;
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
          gateway: t.paymentGateway ?? "Unknown",
           transactionId: t.paymentDisplayId ?? "—",
          voucherCode: t.voucherCode,
          voucherDiscount: t.voucherDiscount,
          amount: t.amount,
          currency: t.currency,
          date: t.date,
          status: t.paymentStatus ?? "unknown",
        }));

      case "payout":
        // Group by provider
        const payMap: Record<string, { id: string; providerName: string; totalPaid: number; pendingCount: number; completedCount: number; failedCount: number }> = {};
        filteredPayouts.forEach((p: any) => {
          const key = p.providerId;
          if (!payMap[key]) {
            payMap[key] = { id: key, providerName: p.providerName, totalPaid: 0, pendingCount: 0, completedCount: 0, failedCount: 0 };
          }
          if (p.status === "completed") {
            payMap[key].totalPaid += eur(p.amount, p.currency);
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
        return filteredRefunds.map((r: any) => ({
           id: r.paymentDisplayId ?? "—",
          reference: r.bookingReference,
          traveller: r.travellerName,
          originalAmount: r.originalAmount,
          refundAmount: r.refundAmount,
          currency: r.currency,
          reason: r.reason,
          status: r.status,
          date: r.requestedDate,
        }));

      case "commission":
        // Group by country
        const commMap: Record<string, { id: string; country: string; totalRevenue: number; commissionEarned: number; bookingsCount: number; avgRate: number }> = {};
        filteredTxs.forEach((tx) => {
          const key = tx.country ?? "Unknown";
          if (!commMap[key]) {
            commMap[key] = { id: key, country: key, totalRevenue: 0, commissionEarned: 0, bookingsCount: 0, avgRate: 0 };
          }
          commMap[key].totalRevenue += eur(tx.amount, tx.currency);
          commMap[key].commissionEarned += eur(tx.commissionAmount, tx.currency);
          commMap[key].bookingsCount += 1;
        });
        // Calculate average rate per country
        return Object.values(commMap).map((m) => ({
          ...m,
          avgRate: m.totalRevenue > 0 ? (m.commissionEarned / m.totalRevenue) * 100 : 0,
        }));

      default:
        return [];
    }
  }, [activeReport, filteredTxs, filteredPayouts, filteredRefunds, countryFilter, eur, eurRates]);

  // Dynamic columns based on active tab
  const tableColumns = useMemo((): Column<any>[] => {
    switch (activeReport) {
      case "revenue":
        return [
          { key: "period", label: "Month/Year", render: (r) => <span className="font-semibold text-slate-800">{r.period}</span> },
          { key: "bookingsCount", label: "Bookings", render: (r) => <span>{r.bookingsCount}</span> },
          { key: "gross", label: "Gross Revenue", align: "right", render: (r) => <span className="tabular font-medium">{formatCurrency(r.gross, "EUR")}</span> },
          { key: "voucherDiscounts", label: "Voucher Discounts", align: "right", render: (r) => (
            <span className="tabular font-medium text-amber-600">
              {r.voucherDiscounts > 0 ? `- ${formatCurrency(r.voucherDiscounts, "EUR")}` : "—"}
            </span>
          )},
          { key: "payout", label: "Provider Payouts", align: "right", render: (r) => <span className="tabular font-medium text-blue-600">{formatCurrency(r.payout, "EUR")}</span> },
          { key: "netRevenue", label: "Platform Net Revenue", align: "right", render: (r) => <span className="tabular font-bold text-slate-900">{formatCurrency(r.netRevenue, "EUR")}</span> },
          { key: "avgValue", label: "Avg Booking Value", align: "right", render: (r) => <span className="tabular font-medium">{formatCurrency(r.avgValue, "EUR")}</span> },
        ];
      case "payment":
        return [
          { key: "ref", label: "Booking Ref", render: (r) => <span className="font-mono font-medium text-primary">{r.reference}</span> },
          { key: "traveller", label: "Traveller", render: (r) => <span>{r.traveller}</span> },
          { key: "gateway", label: "Gateway", render: (r) => <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{r.gateway}</span> },
          { key: "voucherCode", label: "Voucher", render: (r) => (
            r.voucherCode ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                <Tag className="h-3 w-3" />
                {r.voucherCode}
              </span>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )
          )},
          { key: "voucherDiscount", label: "Discount", align: "right", render: (r) => (
            <span className={`tabular font-medium ${r.voucherDiscount > 0 ? "text-amber-600" : "text-slate-400"}`}>
              {r.voucherDiscount > 0 ? `-${formatEur(r.voucherDiscount, r.currency, eurRates) ?? formatCurrency(r.voucherDiscount, r.currency)}` : "—"}
            </span>
          )},
          { key: "date", label: "Date", render: (r) => <span className="text-xs text-slate-500">{formatDate(r.date)}</span> },
          { key: "amount", label: "Amount", align: "right", render: (r) => <span className="tabular font-semibold"><EurValue amount={r.amount} currency={r.currency} rates={eurRates} /></span> },
          { key: "status", label: "Status", render: (r) => <Badge label={r.status} status={r.status === "captured" ? "confirmed" : r.status === "failed" ? "cancelled_by_system" : r.status === "refunded" ? "suspended" : "pending_payment"} /> },
        ];
      case "payout":
        return [
          { key: "provider", label: "Provider Beneficiary", render: (r) => <span className="font-semibold text-slate-800">{r.providerName}</span> },
          { key: "completedCount", label: "Settled Count", render: (r) => <span>{r.completedCount} transfers</span> },
          { key: "pendingCount", label: "Pending/Scheduled", render: (r) => <span className="text-slate-500">{r.pendingCount} holded</span> },
          { key: "failedCount", label: "Failed", render: (r) => <span className={r.failedCount ? "text-danger font-medium" : "text-slate-400"}>{r.failedCount} failed</span> },
          { key: "totalPaid", label: "Total Paid Out", align: "right", render: (r) => <span className="tabular font-bold text-emerald-600">{formatCurrency(r.totalPaid, "EUR")}</span> },
        ];
      case "refund":
        return [
          { key: "ref", label: "Refund ID & Booking", render: (r) => <div><p className="font-semibold text-xs text-slate-400">{r.id}</p><p className="font-mono text-sm text-primary font-semibold">{r.reference}</p></div> },
          { key: "traveller", label: "Traveller", render: (r) => <span>{r.traveller}</span> },
          { key: "date", label: "Requested Date", render: (r) => <span className="text-xs text-slate-500">{formatDate(r.date)}</span> },
          { key: "reason", label: "Reason", render: (r) => <p className="text-xs text-slate-500 truncate max-w-[200px]" title={r.reason}>{r.reason}</p> },
          { key: "amount", label: "Refund Amount", align: "right", render: (r) => <span className="tabular font-bold text-danger"><EurValue amount={r.refundAmount} currency={r.currency} rates={eurRates} /></span> },
          { key: "status", label: "Status", render: (r) => <Badge label={r.status} status={r.status === "processed" ? "confirmed" : r.status === "approved" ? "confirmed" : r.status === "rejected" ? "cancelled_by_guest" : "pending_payment"} /> },
        ];
      case "commission":
        return [
          { key: "country", label: "Country", render: (r) => <span className="font-semibold text-slate-800">{r.country}</span> },
          { key: "bookingsCount", label: "Bookings", render: (r) => <span>{r.bookingsCount}</span> },
          { key: "totalRevenue", label: "Total Volume", align: "right", render: (r) => <span className="tabular font-medium">{formatCurrency(r.totalRevenue, "EUR")}</span> },
          { key: "avgRate", label: "Avg Rate", align: "right", render: (r) => <span className="tabular font-medium">{r.avgRate.toFixed(1)}%</span> },
          { key: "commissionEarned", label: "Commission Earned", align: "right", render: (r) => <span className="tabular font-bold text-blue-600">{formatCurrency(r.commissionEarned, "EUR")}</span> },
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
      headers = ["Period", "Bookings", "Gross Revenue", "Voucher Discounts", "Provider Payout", "Platform Net Revenue", "Avg Booking Value"];
      rows = reportTableData.map((r: any) => [r.period, r.bookingsCount, r.gross, r.voucherDiscounts, r.payout, r.netRevenue, r.avgValue]);
    } else if (activeReport === "payment") {
      headers = ["Booking Ref", "Traveller", "Gateway", "Voucher Code", "Discount", "Amount", "Currency", "Date", "Status"];
      rows = reportTableData.map((r: any) => [r.reference, r.traveller, r.gateway, r.voucherCode ?? "", r.voucherDiscount, r.amount, r.currency, r.date, r.status]);
    } else if (activeReport === "payout") {
      headers = ["Provider", "Settled Count", "Pending Count", "Failed Count", "Total Settled Amount"];
      rows = reportTableData.map((r: any) => [r.providerName, r.completedCount, r.pendingCount, r.failedCount, r.totalPaid]);
    } else if (activeReport === "refund") {
      headers = ["Refund ID", "Booking Ref", "Traveller", "Original Paid", "Refund Amount", "Reason", "Status", "Requested Date"];
      rows = reportTableData.map((r: any) => [r.id, r.reference, r.traveller, r.originalAmount, r.refundAmount, r.reason, r.status, r.date]);
    } else if (activeReport === "commission") {
      headers = ["Country", "Bookings Count", "Total Volume", "Avg Rate", "Commission Earned"];
      rows = reportTableData.map((r: any) => [r.country, r.bookingsCount, r.totalRevenue, r.avgRate, r.commissionEarned]);
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
        // Money flow: gross is the ACTUAL charge captured at booking time
        // (chargedAmount in EUR/XAF → EUR). Platform net revenue is gross minus
        // the provider payout (which includes full base + delivery + deposit
        // passed through to the provider). See billing.service.ts.
        const grossRevenue = filteredTxs.reduce(
          (s, t) => s + (chargedToEur(t.chargedAmount, t.chargedCurrency, eurRates) ?? eur(t.amount, t.currency)),
          0,
        );
        const totalPayout = filteredTxs.reduce(
          (s, t) => s + (toEurAtCharge(t.providerPayout, t.currency, t.chargedCurrency, t.chargedRate, eurRates) ?? 0),
          0,
        );
        const netRevenue = grossRevenue - totalPayout;
        return (
          <>
            <StatCard title="Gross Revenue" value={grossRevenue} currency="EUR" icon={<Euro className="text-emerald-600 h-4 w-4" />} iconBg="bg-emerald-100" />
            <StatCard title="Provider Payouts" value={totalPayout} currency="EUR" icon={<Landmark className="text-blue-600 h-4 w-4" />} iconBg="bg-blue-100" />
            <StatCard title="Platform Net Revenue" value={netRevenue} currency="EUR" icon={<TrendingUp className="text-emerald-600 h-4 w-4" />} iconBg="bg-emerald-100" />
          </>
        );

      case "payment":
        const attempts = filteredTxs.length;
        const successCount = filteredTxs.filter(t => t.paymentStatus === "captured").length;
        const failCount = filteredTxs.filter(t => t.paymentStatus === "failed").length;
        const successRate = attempts ? (successCount / (attempts - filteredTxs.filter(t => t.paymentStatus === "pending").length || 1)) * 100 : 100;
        const totalVoucherDiscounts = filteredTxs.reduce((sum, t) => sum + eur(t.voucherDiscount, t.currency), 0);
        return (
          <>
            <StatCard title="Payment Attempts" value={attempts} icon={<CreditCard className="text-indigo-600 h-4 w-4" />} iconBg="bg-indigo-100" />
            <StatCard title="Gateway Success Rate" value={successRate} icon={<BadgeCheck className="text-emerald-600 h-4 w-4" />} iconBg="bg-emerald-100" />
            <StatCard title="Total Voucher Discounts" value={totalVoucherDiscounts} currency="EUR" icon={<Tag className="text-amber-600 h-4 w-4" />} iconBg="bg-amber-100" />
          </>
        );

      case "payout":
        const settledAmount = filteredPayouts.filter((p: any) => p.status === "completed").reduce((sum: number, p: any) => sum + eur(p.amount, p.currency), 0);
        const pendingAmount = filteredPayouts.filter((p: any) => p.status === "scheduled").reduce((sum: number, p: any) => sum + eur(p.amount, p.currency), 0);
        const failedPayoutsCount = filteredPayouts.filter((p: any) => p.status === "failed").length;
        return (
          <>
            <StatCard title="Total Payouts Settled" value={settledAmount} currency="EUR" icon={<Landmark className="text-emerald-600 h-4 w-4" />} iconBg="bg-emerald-100" />
            <StatCard title="Awaiting Release Escrow" value={pendingAmount} currency="EUR" icon={<Clock className="text-amber-600 h-4 w-4" />} iconBg="bg-amber-100" />
            <StatCard title="Failed Bank Transfers" value={failedPayoutsCount} icon={<XCircle className="text-red-600 h-4 w-4" />} iconBg="bg-red-100" />
          </>
        );

      case "refund":
        const totRefunded = filteredRefunds.filter((r: any) => r.status === "processed").reduce((sum: number, r: any) => sum + eur(r.refundAmount, r.currency), 0);
        const pendingRefsCount = filteredRefunds.filter((r: any) => r.status === "pending_approval").length;
        const approvedRefsCount = filteredRefunds.filter((r: any) => r.status === "approved").length;
        return (
          <>
            <StatCard title="Total Cleared Refunds" value={totRefunded} currency="EUR" icon={<RotateCcw className="text-danger h-4 w-4" />} iconBg="bg-red-100" />
            <StatCard title="Claims Pending Review" value={pendingRefsCount} icon={<Clock className="text-amber-600 h-4 w-4" />} iconBg="bg-amber-100" />
            <StatCard title="Claims Approved (Escrow)" value={approvedRefsCount} icon={<BadgeCheck className="text-blue-600 h-4 w-4" />} iconBg="bg-blue-100" />
          </>
        );

      case "commission":
        const commEarned = filteredTxs.reduce((s, t) => s + eur(t.commissionAmount, t.currency), 0);
        const avgRate = commissionRules.find((r: any) => r.country === "Global")?.rate || 10;
        return (
          <>
            <StatCard title="Platform Commission Earned" value={commEarned} currency="EUR" icon={<TrendingUp className="text-blue-600 h-4 w-4" />} iconBg="bg-blue-100" />
            <StatCard title="Standard Global Rate" value={avgRate} icon={<Percent className="text-purple-600 h-4 w-4" />} iconBg="bg-purple-100" />
            <StatCard title="Active Country Overrides" value={commissionRules.filter((r: any) => r.country !== "Global").length} icon={<Globe className="text-indigo-600 h-4 w-4" />} iconBg="bg-indigo-100" />
          </>
        );

      default:
        return null;
    }
  }, [activeReport, filteredTxs, filteredPayouts, filteredRefunds, commissionRules, eur, eurRates]);

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
        <h1 className="text-2xl font-bold text-slate-900">Kainook Booking Platform</h1>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">
          Financial Report: {activeReport.toUpperCase()} Reports
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Filter: {countryFilter || "Global Countries Scope"}
        </p>
      </div>

      {/* Print timestamp footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-slate-300 text-center">
        <p className="text-[10px] text-slate-400">
          Generated on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} at {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
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
          loading={isReportsLoading}
          emptyTitle={`No report data matches selected filters`}
          emptyDescription={`Try widening your date ranges or verifying user scope variables.`}
          emptyIcon={<BarChart3 className="h-10 w-10 text-slate-300" />}
        />
      </Card>
    </div>
  );
}
