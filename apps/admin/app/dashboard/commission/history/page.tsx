"use client";

import { useState, useMemo, useEffect } from "react";
import { History, Search, Globe, Calendar, Info, Download } from "lucide-react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/auth";
import { formatDate } from "@/lib/utils";
import { DatePicker } from "@/components/ui/DatePicker";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";

interface CommissionHistoryEntry {
  id: string;
  scope: string;
  countryCode: string | null;
  oldRate: number;
  newRate: number;
  effectiveFrom: string;
  changedBy: string;
  changedByRole: string;
  reason: string;
  applyToAll: boolean;
  providersNotified: boolean;
  createdAt: string;
}

const COUNTRY_OPTIONS = [
  { value: "MT", label: "MT" },
  { value: "US", label: "US" },
  { value: "GB", label: "GB" },
  { value: "DE", label: "DE" },
  { value: "FR", label: "FR" },
  { value: "ES", label: "ES" },
  { value: "IT", label: "IT" },
  { value: "IN", label: "IN" },
  { value: "CA", label: "CA" },
];

export default function CommissionHistoryPage() {
  const { user } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch commission history from real API
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["admin-commission-history", page, limit, countryFilter, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      };
      if (countryFilter) params.country = countryFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await listingApi.get(`/admin/commission-rates/history?${new URLSearchParams(params)}`);
      return res.data.data;
    },
  });

  const commissionHistory: CommissionHistoryEntry[] = historyData?.history ?? [];
  const total = historyData?.pagination?.total ?? 0;

  // Client-side search filtering (server does date/country filtering)
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return commissionHistory;
    
    const q = searchQuery.toLowerCase();
    return commissionHistory.filter((entry) => {
      const matchesChangedBy = entry.changedBy?.toLowerCase().includes(q);
      const matchesReason = entry.reason?.toLowerCase().includes(q);
      const matchesCountry = entry.countryCode?.toLowerCase().includes(q);
      return matchesChangedBy || matchesReason || matchesCountry;
    });
  }, [commissionHistory, searchQuery]);

  const canExport = user?.role === "super_admin" || user?.role === "finance" || user?.role === "support";

  const handleExport = () => {
    const headers = ["Scope", "Previous Rate (%)", "New Rate (%)", "Effective Date", "Authorized By", "Reason", "Logged At"];
    const rows = filteredHistory.map(h => [
      h.countryCode ?? h.scope,
      h.oldRate,
      h.newRate,
      h.effectiveFrom,
      h.changedBy,
      `"${(h.reason ?? "").replace(/"/g, '""')}"`,
      h.createdAt
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "commission_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: Column<CommissionHistoryEntry>[] = [
    {
      key: "country",
      label: "Scope (Country)",
      render: (h) => (
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <span>{h.countryCode ?? h.scope}</span>
        </div>
      ),
    },
    {
      key: "rates",
      label: "Rate Transition",
      render: (h) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <span className="line-through text-slate-400 tabular">{(h.oldRate).toFixed(1)}%</span>
          <span>→</span>
          <span className="text-primary font-bold text-sm tabular">{(h.newRate).toFixed(1)}%</span>
        </div>
      ),
    },
    {
      key: "effectiveDate",
      label: "Effective Date",
      render: (h) => (
        <span className="text-xs text-slate-600 font-medium">
          {formatDate(h.effectiveFrom)}
        </span>
      ),
    },
    {
      key: "changedBy",
      label: "Authorized By",
      render: (h) => <span className="text-xs font-semibold text-slate-700">{h.changedBy}</span>,
    },
    {
      key: "reason",
      label: "Reason for Adjustment",
      render: (h) => <p className="text-xs text-slate-500 italic leading-snug">{h.reason}</p>,
    },
    {
      key: "createdAt",
      label: "Logged Timestamp",
      render: (h) => <span className="text-[11px] text-slate-400 font-medium">{formatDate(h.createdAt)}</span>,
    },
  ];

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
    <div className="space-y-5 max-w-screen-2xl">
      <SectionHeader
        title="Commission Audit History"
        description="Comprehensive log of default commission adjustments, country-specific rate overrides, and scheduled rule additions."
        action={
          canExport && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export CSV
            </Button>
          )
        }
      />

      {/* Filters card */}
      <Card padding="none">
        <FilterBar
          search={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
          searchPlaceholder="Search changer, reason, scope..."
          filters={[
            {
              key: "country",
              label: "All Countries",
              value: countryFilter,
              onChange: (v) => { setCountryFilter(v); setPage(1); },
              options: CM_OPTIONS,
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        >
          <div className="flex items-center gap-2">
            <DatePicker
              placeholder="From Date"
              value={startDate}
              onChange={(val) => { setStartDate(val); setPage(1); }}
              className="w-40"
            />
            <span className="text-xs text-slate-400">to</span>
            <DatePicker
              placeholder="To Date"
              value={endDate}
              onChange={(val) => { setEndDate(val); setPage(1); }}
              minDate={startDate || undefined}
              className="w-40"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xs"
              >
                Clear Dates
              </button>
            )}
          </div>
        </FilterBar>

        <DataTable
          columns={columns}
          data={filteredHistory}
          loading={isLoading}
          emptyTitle="No audit logs recorded"
          emptyDescription="There are no commission history adjustments matching your active criteria."
          emptyIcon={<History className="h-10 w-10 text-slate-300" />}
        />

        <Pagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
        />
      </Card>


    </div>
  );
}
