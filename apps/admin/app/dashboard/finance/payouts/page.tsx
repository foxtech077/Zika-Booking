"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Coins, Clock, Calendar, CheckCircle2, XCircle, 
  Search, Eye, Check, RefreshCw, AlertTriangle, Info, X, Play
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ConfirmModal } from "@/components/modals/Modals";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { canAccess } from "@/permissions/rbac";
import { useMockFinanceStore } from "@/lib/mock-finance-store";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { useAlert } from "@/hooks/useAlert";
const COUNTRY_OPTIONS=[
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

export interface Merchant {
  id: string;
  userId: string;
  businessName: string | null;
  country: string | null;
  payoutMethod: "stripe_connect" | "mobile_money" | "bank_transfer" | "manual";
  stripeConnectAccountId: string | null;
  mobileMoneyNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  isVerified: boolean;
  isActive: boolean;
}

export interface Payout {
  id: string;
  merchantId: string;
  bookingId: string;
  providerId: string;
  amount: number | string;
  currency: string;
  status: "scheduled" | "processing" | "paid" | "failed" | "cancelled";
  scheduledAt: string;
  processedAt?: string;
  providerPayoutId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  merchant?: Merchant;
}

export default function PayoutManagementPage() {
  const { user, _hasHydrated } = useAuthStore();
  const qc = useQueryClient();

  if (_hasHydrated && !canAccess(user?.role as any, "view_finance")) {
    return <AccessDenied />;
  }

  const { approvePayout, retryPayout } = useMockFinanceStore();
  const { showAlert } = useAlert();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Payout["status"]>("scheduled");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  
  // Modals state
  const [markPaidConfirm, setMarkPaidConfirm] = useState<Payout | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Payout | null>(null);
  const [retryConfirm, setRetryConfirm] = useState<Payout | null>(null);
  const [providerPayoutIdInput, setProviderPayoutIdInput] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Query all payouts (limit=1000) so we can do accurate tab counts & local filters
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () =>
      listingApi.get("/admin/payouts", { params: { limit: "1000" } }).then((r) => {
        return r.data?.data ?? r.data ?? [];
      }),
  });

  const payouts: Payout[] = Array.isArray(data) ? data : [];

  // Filter payouts based on activeTab, countryScope and search
  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      // 1. Status Tab filter
      if (p.status !== activeTab) return false;

      // 2. Role Scope Filter (Country Manager)
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(p.merchant?.country ?? "");
        if (!hasScope) return false;
      }

      // 3. Country Filter
      if (countryFilter && p.merchant?.country !== countryFilter) return false;

      // 4. Search Filter (match bookingId, merchant name, providerId, payout ID)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesBooking = p.bookingId.toLowerCase().includes(q);
        const matchesMerchantName = (p.merchant?.businessName ?? "").toLowerCase().includes(q) || (p.merchant?.bankAccountName ?? "").toLowerCase().includes(q);
        const matchesProvider = p.providerId.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        if (!matchesBooking && !matchesMerchantName && !matchesProvider && !matchesId) return false;
      }

      return true;
    });
  }, [payouts, activeTab, user, countryFilter, searchQuery]);

  const [limit, setLimit] = useState(10);
  const paginatedPayouts = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredPayouts.slice(start, start + limit);
  }, [filteredPayouts, page, limit]);

  // Total summary by status for badge counts
  const tabCounts = useMemo(() => {
    const counts = { scheduled: 0, processing: 0, paid: 0, failed: 0, cancelled: 0 };
    payouts.forEach((p) => {
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(p.merchant?.country ?? "");
        if (!hasScope) return;
      }
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return counts;
  }, [payouts, user]);

  // Check roles
  const canModifyPayouts = user?.role === "super_admin" || user?.role === "finance";

  // Mutations
  const processNowMut = useMutation({
    mutationFn: () => listingApi.post("/admin/payouts/process-now"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      showAlert({ type: "success", title: "Payouts Processed", message: "Due payouts have been queued for processing." });
    },
    onError: () => {
      showAlert({ type: "error", title: "Error", message: "Unable to process payouts. Please try again." });
    },
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, providerPayoutId }: { id: string; providerPayoutId?: string }) =>
      listingApi.post(`/admin/payouts/${id}/mark-paid`, { providerPayoutId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setMarkPaidConfirm(null);
      setProviderPayoutIdInput("");
      showAlert({ type: "success", title: "Payout Marked as Paid", message: "The payout has been recorded as paid successfully." });
    },
    onError: () => {
      showAlert({ type: "error", title: "Error", message: "Unable to mark payout as paid. Please try again." });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/admin/payouts/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setCancelConfirm(null);
      showAlert({ type: "success", title: "Payout Cancelled", message: "The scheduled payout has been cancelled." });
    },
    onError: () => {
      showAlert({ type: "error", title: "Error", message: "Unable to cancel payout. Please try again." });
    },
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/admin/payouts/${id}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setRetryConfirm(null);
      showAlert({ type: "success", title: "Payout Retried", message: "The failed payout has been re-queued for processing." });
    },
    onError: () => {
      showAlert({ type: "error", title: "Error", message: "Unable to retry payout. Please try again." });
    },
  });

  const columns: Column<Payout>[] = [
    {
      key: "id",
      label: "Payout ID",
      render: (p) => <span className="font-mono text-xs text-slate-400 font-semibold">{p.id}</span>,
    },
    {
      key: "ref",
      label: "Booking ID",
      render: (p) => (
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{p.bookingId}</span>
          {p.merchant?.country && (
            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded ml-2">
              {p.merchant.country}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "provider",
      label: "Provider & Method",
      render: (p) => (
        <div>
          <p className="font-medium text-sm text-slate-900">
            {p.merchant?.businessName || p.merchant?.bankAccountName || `Provider (${p.providerId.slice(0, 8)})`}
          </p>
          <p className="text-xs text-slate-500 capitalize">{p.merchant?.payoutMethod?.replace("_", " ") || "manual"}</p>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (p) => <span className="font-bold text-sm tabular">{formatCurrency(Number(p.amount), p.currency)}</span>,
    },
    {
      key: "date",
      label: activeTab === "paid" ? "Processed Date" : "Scheduled Date",
      render: (p) => (
        <span className="text-xs text-slate-500">
          {p.status === "paid" 
            ? formatDate(p.processedAt || p.scheduledAt)
            : formatDate(p.scheduledAt)
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

          {(p.status === "scheduled" || p.status === "processing" || p.status === "failed") && (
            <Button
              variant="primary"
              size="sm"
              disabled={!canModifyPayouts}
              onClick={() => setMarkPaidConfirm(p)}
              leftIcon={<Check className="h-3 w-3" />}
            >
              Mark Paid
            </Button>
          )}

          {(p.status === "scheduled" || p.status === "processing" || p.status === "failed") && (
            <Button
              variant="danger"
              size="sm"
              disabled={!canModifyPayouts}
              onClick={() => setCancelConfirm(p)}
              leftIcon={<X className="h-3 w-3" />}
            >
              Cancel
            </Button>
          )}

          {p.status === "failed" && (
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
        action={
          canModifyPayouts && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => processNowMut.mutate()}
              loading={processNowMut.isPending}
              leftIcon={<Play className="h-4 w-4" />}
            >
              Process Due Payouts
            </Button>
          )
        }
      />

      {/* Tabs list */}
      <div className="flex border-b border-border bg-white rounded-t-xl px-4 pt-3 gap-2 overflow-x-auto">
        {([
          { key: "scheduled", label: "Scheduled Payouts", icon: Calendar, count: tabCounts.scheduled, color: "text-blue-500" },
          { key: "processing", label: "Processing Payouts", icon: Clock, count: tabCounts.processing, color: "text-amber-500" },
          { key: "paid", label: "Completed Payouts", icon: CheckCircle2, count: tabCounts.paid, color: "text-emerald-500" },
          { key: "failed", label: "Failed Payouts", icon: XCircle, count: tabCounts.failed, color: "text-red-500" },
          { key: "cancelled", label: "Cancelled Payouts", icon: XCircle, count: tabCounts.cancelled, color: "text-slate-400" },
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
          searchPlaceholder="Search booking, provider, business name..."
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
        />

        <DataTable
          columns={columns}
          data={paginatedPayouts}
          loading={isLoading}
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
                  {formatCurrency(Number(selectedPayout.amount), selectedPayout.currency)}
                </span>
              </div>
              <Badge 
                label={selectedPayout.status} 
                status={selectedPayout.status === "paid" ? "confirmed" : selectedPayout.status === "failed" ? "cancelled_by_system" : selectedPayout.status === "scheduled" ? "confirmed" : "pending_payment"} 
              />
            </div>

            {/* Core details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Provider Beneficiary</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {selectedPayout.merchant?.businessName || selectedPayout.merchant?.bankAccountName || "—"}
                </dd>
                <dd className="text-xs text-slate-500 font-mono">Provider ID: {selectedPayout.providerId}</dd>
                <dd className="text-xs text-slate-500 font-mono">Merchant ID: {selectedPayout.merchantId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Linked Booking ID</dt>
                <dd className="font-semibold text-primary font-mono mt-0.5">{selectedPayout.bookingId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Settlement Method</dt>
                <dd className="font-medium text-slate-800 mt-0.5 capitalize">
                  {selectedPayout.merchant?.payoutMethod?.replace("_", " ") || "manual"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Scheduled Date</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{formatDate(selectedPayout.scheduledAt)}</dd>
              </div>
              {selectedPayout.processedAt && (
                <div>
                  <dt className="text-xs text-slate-400">Settled On</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">{formatDate(selectedPayout.processedAt)}</dd>
                </div>
              )}
              {selectedPayout.providerPayoutId && (
                <div>
                  <dt className="text-xs text-slate-400">External Transaction Ref</dt>
                  <dd className="font-semibold font-mono text-slate-950 mt-0.5">{selectedPayout.providerPayoutId}</dd>
                </div>
              )}
            </div>

            {/* Merchant Bank / Mobile Money / Stripe Connect Credentials */}
            {selectedPayout.merchant && (
              <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Merchant Payment Credentials</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {selectedPayout.merchant.payoutMethod === "bank_transfer" && (
                    <>
                      <div>
                        <span className="text-slate-400 block">Bank Name</span>
                        <span className="font-semibold text-slate-800">{selectedPayout.merchant.bankName || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Account Name</span>
                        <span className="font-semibold text-slate-800">{selectedPayout.merchant.bankAccountName || "—"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block">Account Number / IBAN</span>
                        <span className="font-semibold font-mono text-slate-800">{selectedPayout.merchant.bankAccountNumber || "—"}</span>
                      </div>
                    </>
                  )}
                  {selectedPayout.merchant.payoutMethod === "mobile_money" && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Mobile Money Number</span>
                      <span className="font-semibold font-mono text-slate-800">{selectedPayout.merchant.mobileMoneyNumber || "—"}</span>
                    </div>
                  )}
                  {selectedPayout.merchant.payoutMethod === "stripe_connect" && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Stripe Connect Account ID</span>
                      <span className="font-semibold font-mono text-slate-800">{selectedPayout.merchant.stripeConnectAccountId || "—"}</span>
                    </div>
                  )}
                  {(!selectedPayout.merchant.payoutMethod || selectedPayout.merchant.payoutMethod === "manual") && (
                    <div className="col-span-2 text-slate-500 italic">No automated method configured. Manual dispatch required.</div>
                  )}
                </div>
              </div>
            )}

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

            {/* Drawer Actions */}
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              {(selectedPayout.status === "scheduled" || selectedPayout.status === "processing" || selectedPayout.status === "failed") && (
                <Button
                  className="flex-1"
                  variant="primary"
                  disabled={!canModifyPayouts}
                  onClick={() => { setMarkPaidConfirm(selectedPayout); setSelectedPayout(null); }}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Mark as Paid
                </Button>
              )}
              {(selectedPayout.status === "scheduled" || selectedPayout.status === "processing" || selectedPayout.status === "failed") && (
                <Button
                  className="flex-1"
                  variant="danger"
                  disabled={!canModifyPayouts}
                  onClick={() => { setCancelConfirm(selectedPayout); setSelectedPayout(null); }}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Cancel Payout
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
                  Retry Payout
                </Button>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Mark Paid Confirmation */}
      {markPaidConfirm && (
        <ConfirmModal
          open={!!markPaidConfirm}
          onClose={() => { setMarkPaidConfirm(null); setProviderPayoutIdInput(""); }}
          onConfirm={() => markPaidMut.mutate({ id: markPaidConfirm.id, providerPayoutId: providerPayoutIdInput })}
          loading={markPaidMut.isPending}
          title="Mark Payout as Paid"
          description={`Are you sure you want to manually mark this payout of ${formatCurrency(Number(markPaidConfirm.amount), markPaidConfirm.currency)} to ${markPaidConfirm.merchant?.businessName || "this provider"} as paid? This should be done after executing offline transfers.`}
          confirmLabel="Mark Paid"
          variant="info"
        >
          <div className="mt-4">
            <Input
              id="providerPayoutIdInput"
              label="Transaction/Bank Reference (Optional)"
              placeholder="e.g. TXN-9988123"
              value={providerPayoutIdInput}
              onChange={(e) => setProviderPayoutIdInput(e.target.value)}
            />
          </div>
        </ConfirmModal>
      )}

      {/* Cancel Confirmation */}
      {cancelConfirm && (
        <ConfirmModal
          open={!!cancelConfirm}
          onClose={() => setCancelConfirm(null)}
          onConfirm={() => cancelMut.mutate(cancelConfirm.id)}
          loading={cancelMut.isPending}
          title="Cancel Scheduled Payout"
          description={`Are you sure you want to cancel this scheduled payout of ${formatCurrency(Number(cancelConfirm.amount), cancelConfirm.currency)}? Cancelled payouts cannot be automatically processed.`}
          confirmLabel="Cancel Payout"
          variant="danger"
        />
      )}

      {/* Retry Confirmation */}
      {retryConfirm && (
        <ConfirmModal
          open={!!retryConfirm}
          onClose={() => setRetryConfirm(null)}
          onConfirm={() => retryMut.mutate(retryConfirm.id)}
          loading={retryMut.isPending}
          title="Retry Failed Settlement"
          description={`Do you want to retry processing payout ${retryConfirm.id} for ${formatCurrency(Number(retryConfirm.amount), retryConfirm.currency)}? The payout will revert to a scheduled state.`}
          confirmLabel="Retry Transfer"
          variant="warning"
        />
      )}
    </div>
  );
}
