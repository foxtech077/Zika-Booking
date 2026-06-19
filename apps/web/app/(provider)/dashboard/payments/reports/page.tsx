"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// ─── Dummy / Seed Data ────────────────────────────────────────────────────────
const MOCK_REVENUE_ITEMS = [
  { ref: "BK-9021", listing: "Luxury Oceanfront Villa", type: "instant", date: "2026-06-15", guest: "Alice Smith", gross: 1200, commissionRate: 15, status: "completed" },
  { ref: "BK-4321", listing: "Luxury Oceanfront Villa", type: "standard", date: "2026-06-10", guest: "Bob Jones", gross: 1000, commissionRate: 15, status: "completed" },
  { ref: "BK-8890", listing: "Charming Downtown Studio", type: "instant", date: "2026-06-08", guest: "Charlie Brown", gross: 450, commissionRate: 12, status: "completed" },
  { ref: "BK-7751", listing: "Cozy Mountain Cabin", type: "standard", date: "2026-05-28", guest: "Dana White", gross: 800, commissionRate: 15, status: "completed" },
  { ref: "BK-3112", listing: "Charming Downtown Studio", type: "standard", date: "2026-05-14", guest: "Evan Wright", gross: 600, commissionRate: 12, status: "completed" },
  { ref: "BK-5443", listing: "Cozy Mountain Cabin", type: "instant", date: "2026-05-02", guest: "Fiona Gallagher", gross: 950, commissionRate: 15, status: "pending" },
  { ref: "BK-2210", listing: "Luxury Oceanfront Villa", type: "instant", date: "2026-04-20", guest: "George Miller", gross: 2400, commissionRate: 15, status: "completed" },
  { ref: "BK-6789", listing: "Charming Downtown Studio", type: "standard", date: "2026-04-12", guest: "Hannah Abbott", gross: 500, commissionRate: 12, status: "completed" },
  { ref: "BK-1102", listing: "Cozy Mountain Cabin", type: "instant", date: "2026-04-03", guest: "Ian Malcolm", gross: 750, commissionRate: 15, status: "pending" },
];

const LISTING_OPTIONS = [
  { value: "all", label: "All Listings" },
  { value: "Luxury Oceanfront Villa", label: "Luxury Oceanfront Villa" },
  { value: "Charming Downtown Studio", label: "Charming Downtown Studio" },
  { value: "Cozy Mountain Cabin", label: "Cozy Mountain Cabin" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "may", label: "May 2026" },
  { value: "june", label: "June 2026" },
];

const BOOKING_TYPE_OPTIONS = [
  { value: "all", label: "All Booking Types" },
  { value: "instant", label: "Instant Bookings" },
  { value: "standard", label: "Standard Bookings" },
];

export default function EarningsReportsPage() {
  const [listingFilter, setListingFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Filtered revenue items
  const filteredItems = useMemo(() => {
    return MOCK_REVENUE_ITEMS.filter((item) => {
      // 1. Listing Filter
      if (listingFilter !== "all" && item.listing !== listingFilter) return false;
      // 2. Booking Type Filter
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      // 3. Date Range Filter
      if (dateFilter === "30d") {
        const diff = Date.now() - new Date(item.date).getTime();
        if (diff > 30 * 24 * 60 * 60 * 1000) return false;
      } else if (dateFilter === "90d") {
        const diff = Date.now() - new Date(item.date).getTime();
        if (diff > 90 * 24 * 60 * 60 * 1000) return false;
      } else if (dateFilter === "may") {
        if (!item.date.startsWith("2026-05")) return false;
      } else if (dateFilter === "june") {
        if (!item.date.startsWith("2026-06")) return false;
      }
      return true;
    });
  }, [listingFilter, dateFilter, typeFilter]);

  // Financial Metrics recalculations
  const metrics = useMemo(() => {
    let gross = 0;
    let commission = 0;
    let pending = 0;
    let completed = 0;

    filteredItems.forEach((item) => {
      gross += item.gross;
      const comm = (item.gross * item.commissionRate) / 100;
      commission += comm;

      const net = item.gross - comm;
      if (item.status === "pending") {
        pending += net;
      } else {
        completed += net;
      }
    });

    return {
      grossRevenue: gross,
      commissionDeductions: commission,
      netRevenue: gross - commission,
      pendingPayouts: pending,
      completedPayouts: completed,
    };
  }, [filteredItems]);

  // Aggregate monthly data for chart
  const chartData = useMemo(() => {
    const months = ["2026-04", "2026-05", "2026-06"];
    return months.map((month) => {
      let gross = 0;
      let net = 0;
      let comm = 0;

      filteredItems.forEach((item) => {
        if (item.date.startsWith(month)) {
          gross += item.gross;
          const c = (item.gross * item.commissionRate) / 100;
          comm += c;
          net += item.gross - c;
        }
      });

      const label = new Date(month + "-02").toLocaleString("default", { month: "short" });
      return { month: label, "Gross Revenue": gross, "Net Revenue": net, "Commission": comm };
    });
  }, [filteredItems]);

  // PDF simulated export
  const handleExportPDF = () => {
    setExportingPDF(true);
    setTimeout(() => {
      setExportingPDF(false);
      triggerToast("PDF Report downloaded successfully!");
      // Download a dynamic text receipt file as a high fidelity simulation
      const content = `ZIKA BOOKING - FINANCIAL REPORT\n\nFilters:\n- Listing: ${listingFilter}\n- Date Range: ${dateFilter}\n- Booking Type: ${typeFilter}\n\nSummary:\n- Gross Revenue: $${metrics.grossRevenue}\n- Commission Deductions: $${metrics.commissionDeductions}\n- Net Revenue: $${metrics.netRevenue}\n- Pending Payouts: $${metrics.pendingPayouts}\n- Completed Payouts: $${metrics.completedPayouts}\n\nGenerated: ${new Date().toLocaleString()}`;
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `earnings_report_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 1500);
  };

  // Excel simulated export
  const handleExportExcel = () => {
    setExportingExcel(true);
    setTimeout(() => {
      setExportingExcel(false);
      triggerToast("Excel Sheet exported successfully!");
      // Download an actual CSV file
      let csv = "Booking Reference,Listing Name,Guest Name,Check-in Date,Booking Type,Gross Amount,Commission,Net Earnings,Status\n";
      filteredItems.forEach((item) => {
        const comm = (item.gross * item.commissionRate) / 100;
        const net = item.gross - comm;
        csv += `${item.ref},"${item.listing}","${item.guest}",${item.date},${item.type},${item.gross},${comm},${net},${item.status}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `earnings_report_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-lg border border-emerald-100 bg-emerald-50 text-emerald-800 animate-slide-in text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/payments">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>Back</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Earnings Reports</h1>
            <p className="mt-0.5 text-sm text-slate-500">Analyze your listing revenue breakdowns and export reports.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={<FileText />}
            loading={exportingPDF}
            onClick={handleExportPDF}
          >
            PDF Report
          </Button>
          <Button
            variant="outline"
            icon={<FileSpreadsheet />}
            loading={exportingExcel}
            onClick={handleExportExcel}
          >
            Excel Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-slate-800">Report Filters</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Listing"
            value={listingFilter}
            onChange={(e) => setListingFilter(e.target.value)}
            options={LISTING_OPTIONS}
          />
          <Select
            label="Date Range"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            options={DATE_RANGE_OPTIONS}
          />
          <Select
            label="Booking Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={BOOKING_TYPE_OPTIONS}
          />
        </div>
      </Card>

      {/* Revenue Information Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Gross Revenue", value: metrics.grossRevenue, tone: "bg-emerald-50 border-emerald-100 text-emerald-700" },
          { label: "Commission Deductions", value: metrics.commissionDeductions, tone: "bg-red-50 border-red-100 text-red-600" },
          { label: "Net Revenue", value: metrics.netRevenue, tone: "bg-green-700 text-white border-green-800" },
          { label: "Pending Payouts", value: metrics.pendingPayouts, tone: "bg-amber-50 border-amber-100 text-amber-700" },
          { label: "Completed Payouts", value: metrics.completedPayouts, tone: "bg-teal-50 border-teal-100 text-teal-700" },
        ].map((card) => (
          <div key={card.label} className={cn("rounded-2xl border p-4 shadow-sm", card.tone)}>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{card.label}</p>
            <p className="mt-2 text-xl font-bold">{formatCurrency(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Main Analysis grid */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Recharts Chart */}
        <Card>
          <SectionHeader title="Revenue Overview Chart" subtitle="Comparative breakdown across standard months" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Gross Revenue" fill="#047857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Net Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Commission" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Detailed Breakdown List */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">Filtered Bookings Details</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filteredItems.length} transactions included</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No bookings match active filters.</div>
            ) : (
              filteredItems.map((item) => {
                const comm = (item.gross * item.commissionRate) / 100;
                return (
                  <div key={item.ref} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.listing}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-slate-400">{item.ref}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-400">{formatDate(item.date)}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] capitalize text-slate-400 font-medium">{item.type}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(item.gross - comm)}</p>
                      <p className="text-[10px] text-red-500 mt-0.5">Fee: −{formatCurrency(comm)}</p>
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
