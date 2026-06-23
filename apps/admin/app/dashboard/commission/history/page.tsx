"use client";

import { useState, useMemo, useEffect } from "react";
import { History, Search, Globe, Calendar, Info } from "lucide-react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useMockFinanceStore, type CommissionHistoryEntry } from "@/lib/mock-finance-store";
import { useAuthStore } from "@/stores/auth";
import { formatDate } from "@/lib/utils";

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
  const { commissionHistory } = useMockFinanceStore();

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

  // Filter history entries based on search query, date, country scope, and role scope
  const filteredHistory = useMemo(() => {
    return commissionHistory.filter((entry) => {
      // 1. Role Scope Filter for Country Manager
      if (user?.role === "country_manager" && entry.country !== "Global") {
        const hasScope = user.countryScope?.includes(entry.country);
        if (!hasScope) return false;
      }

      // 2. Country Dropdown Filter
      if (countryFilter && entry.country !== countryFilter) return false;

      // 3. Date Range Filter
      if (startDate && new Date(entry.effectiveDate) < new Date(startDate)) return false;
      if (endDate && new Date(entry.effectiveDate) > new Date(endDate)) return false;

      // 4. Search Filter (match changer, change reason)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesChanger = entry.changedBy.toLowerCase().includes(q);
        const matchesReason = entry.changeReason.toLowerCase().includes(q);
        const matchesCountry = entry.country.toLowerCase().includes(q);
        if (!matchesChanger && !matchesReason && !matchesCountry) return false;
      }

      return true;
    });
  }, [commissionHistory, user, countryFilter, startDate, endDate, searchQuery]);

  // Paginate records
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredHistory.slice(start, start + limit);
  }, [filteredHistory, page, limit]);

  const columns: Column<CommissionHistoryEntry>[] = [
    {
      key: "country",
      label: "Scope (Country)",
      render: (h) => (
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <span>{h.country}</span>
        </div>
      ),
    },
    {
      key: "rates",
      label: "Rate Transition",
      render: (h) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <span className="line-through text-slate-400 tabular">{h.previousRate}%</span>
          <span>→</span>
          <span className="text-primary font-bold text-sm tabular">{h.newRate}%</span>
        </div>
      ),
    },
    {
      key: "effectiveDate",
      label: "Effective Date",
      render: (h) => (
        <span className="text-xs text-slate-600 font-medium">
          {formatDate(h.effectiveDate)}
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
      render: (h) => <p className="text-xs text-slate-500 italic leading-snug">{h.changeReason}</p>,
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
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px]"
              aria-label="Start Effective Date"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="py-1.5 px-3 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[38px]"
              aria-label="End Effective Date"
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
          data={paginatedHistory}
          loading={false}
          emptyTitle="No audit logs recorded"
          emptyDescription="There are no commission history adjustments matching your active criteria."
          emptyIcon={<History className="h-10 w-10 text-slate-300" />}
        />

        <Pagination
          page={page}
          limit={limit}
          total={filteredHistory.length}
          onPageChange={setPage}
        />
      </Card>


    </div>
  );
}