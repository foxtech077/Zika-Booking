"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Coins, Clock, Calendar, CheckCircle2, XCircle, 
  Search, Eye, Check, RefreshCw, AlertTriangle, Info 
} from "lucide-react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ConfirmModal } from "@/components/modals/Modals";
import { useMockFinanceStore, type Payout } from "@/lib/mock-finance-store";
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency } from "@/lib/utils";

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

export default function PayoutManagementPage() {
  const { user } = useAuthStore();
  const { payouts, approvePayout, retryPayout } = useMockFinanceStore();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Payout["status"]>("pending");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  
  // Modals state
  const [approveConfirm, setApproveConfirm] = useState<Payout | null>(null);
  const [retryConfirm, setRetryConfirm] = useState<Payout | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter payouts based on activeTab, countryScope and search
  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      // 1. Status Tab filter
      if (p.status !== activeTab) return false;

      // 2. Role Scope Filter
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(p.country);
        if (!hasScope) return false;
      }

      // 3. Country Filter
      if (countryFilter && p.country !== countryFilter) return false;

      // 4. Search Filter (match reference, provider, payout ID)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesRef = p.bookingReference.toLowerCase().includes(q);
        const matchesProvider = p.providerName.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        if (!matchesRef && !matchesProvider && !matchesId) return false;
      }

      return true;
    });
  }, [payouts, activeTab, user, countryFilter, searchQuery]);

  // Paginated data
  const limit = 10;
  const paginatedPayouts = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredPayouts.slice(start, start + limit);
  }, [filteredPayouts, page]);

  // Total summary by status for badge counts
  const tabCounts = useMemo(() => {
    const counts = { pending: 0, scheduled: 0, completed: 0, failed: 0 };
    payouts.forEach((p) => {
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(p.country);
        if (!hasScope) return;
      }
      counts[p.status]++;
    });
    return counts;
  }, [payouts, user]);

  // Check roles
  const canModifyPayouts = user?.role === "super_admin" || user?.role === "finance";

  const handleApprove = () => {
    if (!approveConfirm) return;
    setActionLoading(true);
    setTimeout(() => {
      approvePayout(approveConfirm.id, user?.name || "Super Admin");
      setApproveConfirm(null);
      setActionLoading(false);
    }, 1000);
  };

  const handleRetry = () => {
    if (!retryConfirm) return;
    setActionLoading(true);
    setTimeout(() => {
      retryPayout(retryConfirm.id);
      setRetryConfirm(null);
      setActionLoading(false);
    }, 1000);
  };

  const columns: Column<Payout>[] = [
    {
      key: "id",
      label: "Payout ID",
      render: (p) => <span className="font-mono text-xs text-slate-400 font-semibold">{p.id}</span>,
    },
    {
      key: "ref",
      label: "Booking Ref",
      render: (p) => (
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{p.bookingReference}</span>
          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded ml-2">
            {p.country}
          </span>
        </div>
      ),
    },
    {
      key: "provider",
      label: "Provider & Method",
      render: (p) => (
        <div>
          <p className="font-medium text-sm text-slate-900">{p.providerName}</p>
          <p className="text-xs text-slate-500">{p.method}</p>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (p) => <span className="font-bold text-sm tabular">{formatCurrency(p.amount, p.currency)}</span>,
    },
    {
      key: "date",
      label: activeTab === "completed" ? "Processed Date" : "Scheduled Date",
      render: (p) => (
        <span className="text-xs text-slate-500">
          {p.status === "completed" 
            ? formatDate(p.processedDate || p.scheduledDate)
            : formatDate(p.scheduledDate)
          }
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedPayout(p)}
            leftIcon={<Eye className="h-3 w-3" />}
          >
            Details
          </Button>

          {activeTab === "pending" && (
            <Button
              variant="primary"
              size="sm"
              disabled={!canModifyPayouts}
              onClick={() => setApproveConfirm(p)}
              leftIcon={<Check className="h-3 w-3" />}
            >
              Approve
            </Button>
          )}

          {activeTab === "failed" && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!canModifyPayouts}
              onClick={() => setRetryConfirm(p)}
              leftIcon={<RefreshCw className="h-3 w-3" />}
            >
              Retry
            </Button>
          )}
        </div>
      ),
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
        title="Payout Management"
        description="Verify, schedule, approve and retry payouts to accommodation and vehicle rental providers."
      />

      {/* Tabs list */}
      <div className="flex border-b border-border bg-white rounded-t-xl px-4 pt-3 gap-2">
        {([
          { key: "pending", label: "Pending Payouts", icon: Clock, count: tabCounts.pending, color: "text-amber-500" },
          { key: "scheduled", label: "Scheduled Payouts", icon: Calendar, count: tabCounts.scheduled, color: "text-blue-500" },
          { key: "completed", label: "Completed Payouts", icon: CheckCircle2, count: tabCounts.completed, color: "text-emerald-500" },
          { key: "failed", label: "Failed Payouts", icon: XCircle, count: tabCounts.failed, color: "text-red-500" },
        ] as const).map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all leading-none ${
                isActive 
                  ? "border-primary text-primary" 
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              aria-label={`${tab.label} (${tab.count})`}
            >
              <TabIcon className={`h-4 w-4 ${isActive ? "text-primary" : tab.color}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                isActive ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters Card */}
      <Card padding="none" className="rounded-t-none">
        <FilterBar
          search={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
          searchPlaceholder="Search booking ref, provider name..."
          filters={[
            {
              key: "country",
              label: "All Countries",
              value: countryFilter,
              onChange: (v) => { setCountryFilter(v); setPage(1); },
              options: CM_OPTIONS,
            },
          ]}
        />

        <DataTable
          columns={columns}
          data={paginatedPayouts}
          loading={false}
          onRowClick={(p) => setSelectedPayout(p)}
          emptyTitle={`No ${activeTab} payouts`}
          emptyDescription={`There are currently no payout records in ${activeTab} status matching filters.`}
          emptyIcon={<Coins className="h-10 w-10 text-slate-300" />}
        />

        <Pagination
          page={page}
          limit={limit}
          total={filteredPayouts.length}
          onPageChange={setPage}
        />
      </Card>

      {/* Details drawer */}
      <SlideDrawer
        open={!!selectedPayout}
        onClose={() => setSelectedPayout(null)}
        title={`Payout Details: ${selectedPayout?.id}`}
        description="Detailed bank transfer credentials and hold logs."
        width="md"
      >
        {selectedPayout && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Payout Amount</span>
                <span className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                  {formatCurrency(selectedPayout.amount, selectedPayout.currency)}
                </span>
              </div>
              <Badge 
                label={selectedPayout.status} 
                status={selectedPayout.status === "completed" ? "confirmed" : selectedPayout.status === "failed" ? "cancelled_by_system" : selectedPayout.status === "scheduled" ? "confirmed" : "pending_payment"} 
              />
            </div>

            {/* Core details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Provider Beneficiary</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{selectedPayout.providerName}</dd>
                <dd className="text-xs text-slate-500 font-mono">ID: {selectedPayout.providerId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Linked Booking Reference</dt>
                <dd className="font-semibold text-primary font-mono mt-0.5">{selectedPayout.bookingReference}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Settlement Method</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{selectedPayout.method}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Scheduled Date</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{formatDate(selectedPayout.scheduledDate)}</dd>
              </div>
              {selectedPayout.processedDate && (
                <div>
                  <dt className="text-xs text-slate-400">Settled On</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">{formatDate(selectedPayout.processedDate)}</dd>
                </div>
              )}
            </div>

            {/* Error alerts if failed */}
            {selectedPayout.status === "failed" && selectedPayout.failureReason && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h6 className="font-bold text-xs uppercase tracking-wider text-red-900">Payout Error Response</h6>
                  <p className="text-xs mt-1 text-red-700">{selectedPayout.failureReason}</p>
                </div>
              </div>
            )}

            {/* Escrow note */}
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 space-y-2 text-xs text-purple-800">
              <div className="flex gap-2 items-start">
                <Info className="h-4.5 w-4.5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Escrow Hold T+24 Period Guard</p>
                  <p className="mt-1 leading-relaxed text-[11px] text-purple-700">
                    Payouts are locked in escrow for 24 hours post guest check-in. The platform reserves these funds to handle property disputes or cancellations. Manual override releases the hold immediately.
                  </p>
                </div>
              </div>
            </div>

            {/* Documentation of missing API */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              <div className="flex gap-2 items-start">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Missing API Dependencies Documented</p>
                  <p className="text-[11px] text-blue-700 mt-0.5 leading-snug font-mono">
                    POST /admin/payouts/:id/approve<br />
                    POST /admin/payouts/:id/retry
                  </p>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              {selectedPayout.status === "pending" && (
                <Button
                  className="flex-1"
                  variant="primary"
                  disabled={!canModifyPayouts}
                  onClick={() => { setApproveConfirm(selectedPayout); setSelectedPayout(null); }}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Approve Settlement
                </Button>
              )}
              {selectedPayout.status === "failed" && (
                <Button
                  className="flex-1"
                  variant="secondary"
                  disabled={!canModifyPayouts}
                  onClick={() => { setRetryConfirm(selectedPayout); setSelectedPayout(null); }}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Retry Bank Transfer
                </Button>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Approve Payout Confirmation */}
      <ConfirmModal
        open={!!approveConfirm}
        onClose={() => setApproveConfirm(null)}
        onConfirm={handleApprove}
        loading={actionLoading}
        title="Confirm Payout Release"
        description={`Are you sure you want to approve this payout of ${formatCurrency(approveConfirm?.amount || 0, approveConfirm?.currency)} to ${approveConfirm?.providerName}? This will initiate an electronic funds transfer.`}
        confirmLabel="Initiate Transfer"
        variant="info"
      />

      {/* Retry Payout Confirmation */}
      <ConfirmModal
        open={!!retryConfirm}
        onClose={() => setRetryConfirm(null)}
        onConfirm={handleRetry}
        loading={actionLoading}
        title="Retry Failed Settlement"
        description={`Do you want to retry processing payout ${retryConfirm?.id} for ${formatCurrency(retryConfirm?.amount || 0, retryConfirm?.currency)}? The payout will revert to a scheduled state.`}
        confirmLabel="Retry Transfer"
        variant="warning"
      />
    </div>
  );
}
