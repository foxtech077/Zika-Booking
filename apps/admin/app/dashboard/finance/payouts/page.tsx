"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Coins, Clock, Calendar, CheckCircle2, XCircle, 
  Eye, Check, RefreshCw, AlertTriangle, Info, X, Play, Hourglass, ExternalLink
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
import { formatDate, formatCurrency, cn, getStatusColor, slugToLabel } from "@/lib/utils";
import { useEurRates, EurValue, formatEur } from "@/lib/eur";
import { SYSTEM_COUNTRIES } from "@/lib/countries";
import { roleHasPermission, roleScopePolicy, AdminPermission, AdminScope } from "@/permissions/rbac";
import type { AdminRole } from "@/types/admin";

const COUNTRY_OPTIONS = SYSTEM_COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.name} (${c.code})`,
}));

export type PayoutStatus =
  | "pending"
  | "scheduled"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

export type PayoutFlowState =
  | "awaiting_checkout"
  | "awaiting_merchant_setup"
  | "awaiting_merchant_verification"
  | "merchant_inactive"
  | "booking_cancelled_or_refunded"
  | "manual_disbursement_required"
  | "ready_for_payout"
  | "paid"
  | "processing"
  | "failed"
  | "cancelled"
  | "unknown";

type PayoutTabKey = PayoutStatus;

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
  status: PayoutStatus;
  scheduledAt: string;
  processedAt?: string;
  providerPayoutId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  merchant?: Merchant;
  // Server-enriched transparent state (payment-service flow classification)
  flowState?: PayoutFlowState;
  flowLabel?: string;
  flowReason?: string;
}

// ── Flow-state helpers ─────────────────────────────────────────────────────────

function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function CopyableId({ value, tone = "muted" }: { value?: string | null; tone?: "muted" | "primary" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-slate-300">—</span>;
  const short = shortId(value);
  return (
    <button
      type="button"
      title={`${value}${copied ? " — copied" : " — click to copy"}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className={cn(
        "font-mono text-xs font-medium tabular-nums hover:underline underline-offset-2 cursor-pointer",
        tone === "primary" ? "text-primary" : "text-slate-500",
        copied && "text-emerald-600"
      )}
    >
      {copied ? "copied ✓" : short}
    </button>
  );
}

const FLOW_STATE_OPTIONS: { value: PayoutFlowState; label: string }[] = [
  { value: "awaiting_checkout", label: "Awaiting stay completion" },
  { value: "awaiting_merchant_setup", label: "Awaiting merchant payout setup" },
  { value: "awaiting_merchant_verification", label: "Awaiting merchant verification" },
  { value: "merchant_inactive", label: "Merchant inactive" },
  { value: "booking_cancelled_or_refunded", label: "Booking cancelled / refunded" },
  { value: "manual_disbursement_required", label: "Manual disbursement required" },
  { value: "ready_for_payout", label: "Ready for payout" },
];

function FlowStateChip({ state, label, reason }: { state?: PayoutFlowState; label?: string; reason?: string }) {
  if (!state) return null;
  const colorClass = getStatusColor(state);
  const display = label || slugToLabel(state);
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        colorClass
      )}
      title={reason ? `${display} — ${reason}` : display}
    >
      {display}
    </span>
  );
}

function methodLabel(method?: string | null): string {
  if (!method) return "manual";
  return method.replace(/_/g, " ");
}

export default function PayoutManagementPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<PayoutTabKey>("pending");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [flowFilter, setFlowFilter] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  
  // Modals state
  const [markPaidConfirm, setMarkPaidConfirm] = useState<Payout | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Payout | null>(null);
  const [retryConfirm, setRetryConfirm] = useState<Payout | null>(null);
  const [providerPayoutIdInput, setProviderPayoutIdInput] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch the most recent payouts (the API caps the page at 100 rows) so we
  // can show tab counts and local filters. The payment service enriches each
  // row with a live flowState/flowLabel/flowReason.
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () =>
      listingApi.get("/admin/payouts", { params: { limit: "100" } }).then((r) => {
        return r.data?.data ?? r.data ?? [];
      }),
    staleTime: 15_000,
  });

  const payouts: Payout[] = Array.isArray(data) ? data : [];

  const eurRates = useEurRates(payouts.map((p) => p.currency));

  const isCountryScoped = roleScopePolicy(user?.role as AdminRole) === AdminScope.CountryScoped;

  // Filter payouts based on activeTab, countryScope and search
  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      // 1. Status Tab filter
      if (p.status !== activeTab) return false;

      // 2. Role Scope Filter (country_manager / sales)
      if (isCountryScoped) {
        const hasScope = user?.countryScope?.includes(p.merchant?.country ?? "");
        if (!hasScope) return false;
      }

      // 3. Country Filter
      if (countryFilter && p.merchant?.country !== countryFilter) return false;

      // 4. Flow-state filter (only surfaced on the pending tab)
      if (flowFilter && p.flowState !== flowFilter) return false;

      // 5. Search Filter (match bookingId, merchant name, providerId, payout ID)
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
  }, [payouts, activeTab, user, countryFilter, searchQuery, flowFilter, isCountryScoped]);

  const [limit, setLimit] = useState(10);
  const paginatedPayouts = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredPayouts.slice(start, start + limit);
  }, [filteredPayouts, page, limit]);

  // Total summary by status for badge counts
  const tabCounts = useMemo(() => {
    const counts = { pending: 0, scheduled: 0, processing: 0, paid: 0, failed: 0, cancelled: 0 };
    payouts.forEach((p) => {
      if (isCountryScoped) {
        const hasScope = user?.countryScope?.includes(p.merchant?.country ?? "");
        if (!hasScope) return;
      }
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return counts;
  }, [payouts, user]);

  // Check permissions (shared backend policy — admin + finance + super_admin)
  const canModifyPayouts = roleHasPermission(user?.role as AdminRole, AdminPermission.PayoutsManage);

  // Mutations
  const processNowMut = useMutation({
    mutationFn: () => listingApi.post("/admin/payouts/process-now"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    },
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, providerPayoutId }: { id: string; providerPayoutId?: string }) =>
      listingApi.post(`/admin/payouts/${id}/mark-paid`, { providerPayoutId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setMarkPaidConfirm(null);
      setProviderPayoutIdInput("");
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/admin/payouts/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setCancelConfirm(null);
    },
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/admin/payouts/${id}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setRetryConfirm(null);
    },
  });

  const columns: Column<Payout>[] = [
    {
      key: "id",
      label: "Payout",
      width: "110px",
      render: (p) => <CopyableId value={p.id} />,
    },
    {
      key: "ref",
      label: "Booking",
      width: "130px",
      render: (p) => {
        const countryCode = p.merchant?.country;
        const countryObj = countryCode
          ? SYSTEM_COUNTRIES.find((c) => c.code.toUpperCase() === countryCode.toUpperCase())
          : null;
        const countryLabel = countryObj
          ? `${countryObj.flag} ${countryObj.name} (${countryObj.code})`
          : (countryCode ?? "");
        return (
          <div className="flex items-center gap-1.5">
            <CopyableId value={p.bookingId} tone="primary" />
            {countryCode && (
              <span
                className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                title={countryLabel}
              >
                {countryObj ? `${countryObj.flag} ${countryObj.code}` : countryCode}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "provider",
      label: "Provider",
      width: "170px",
      render: (p) => (
        <div className="min-w-0">
          <p className="font-medium text-sm text-slate-900 truncate" title={p.merchant?.businessName || p.merchant?.bankAccountName || p.providerId}>
            {p.merchant?.businessName || p.merchant?.bankAccountName || `Provider ••${p.providerId.slice(-4)}`}
          </p>
          <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-500 capitalize">
            {methodLabel(p.merchant?.payoutMethod)}
          </span>
        </div>
      ),
    },
    {
      key: "flowState",
      label: "Current State",
      width: "190px",
      render: (p) => (
        <FlowStateChip state={p.flowState} label={p.flowLabel} reason={p.flowReason} />
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      width: "150px",
      render: (p) => (
        <div className="text-right tabular-nums">
          <EurValue amount={p.amount} currency={p.currency} rates={eurRates} />
        </div>
      ),
    },
    {
      key: "date",
      label: activeTab === "paid" ? "Processed" : activeTab === "pending" ? "Created" : "Scheduled",
      width: "110px",
      render: (p) => (
        <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
          {p.status === "paid"
            ? formatDate(p.processedAt || p.scheduledAt)
            : p.status === "pending"
              ? formatDate(p.createdAt)
              : formatDate(p.scheduledAt)
          }
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: "190px",
      render: (p) => (
        <div className="flex justify-end items-center gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedPayout(p)}
            leftIcon={<Eye className="h-3 w-3" />}
          >
            Details
          </Button>

          {/* Link to Merchant Management when the blocker is merchant-side */}
          {(p.flowState === "awaiting_merchant_setup" ||
            p.flowState === "awaiting_merchant_verification" ||
            p.flowState === "merchant_inactive") && (
            <a
              href={`/dashboard/finance/merchants`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
              title={p.flowReason}
            >
              <ExternalLink className="h-3 w-3" />
              Merchant
            </a>
          )}

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

          {(p.status === "scheduled" || p.status === "failed") && (
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
    if (isCountryScoped) {
      return COUNTRY_OPTIONS.filter((opt) => user?.countryScope?.includes(opt.value));
    }
    return COUNTRY_OPTIONS;
  }, [user, isCountryScoped]);

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
        description="Track every payout transparently — from booking confirmation to settlement — and unblock stuck payouts by resolving the current state."
        action={
          canModifyPayouts && activeTab === "scheduled" && (
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
          { key: "pending", label: "Pending Payouts", icon: Hourglass, count: tabCounts.pending, color: "text-amber-500" },
          { key: "scheduled", label: "Scheduled Payouts", icon: Calendar, count: tabCounts.scheduled, color: "text-blue-500" },
          { key: "processing", label: "Processing Payouts", icon: Clock, count: tabCounts.processing, color: "text-sky-500" },
          { key: "paid", label: "Completed Payouts", icon: CheckCircle2, count: tabCounts.paid, color: "text-emerald-500" },
          { key: "failed", label: "Failed Payouts", icon: XCircle, count: tabCounts.failed, color: "text-red-500" },
          { key: "cancelled", label: "Cancelled Payouts", icon: XCircle, count: tabCounts.cancelled, color: "text-slate-400" },
        ] as const).map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); setFlowFilter(""); }}
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
            ...(activeTab === "pending"
              ? [{
                  key: "flowState",
                  label: "All Pending States",
                  value: flowFilter,
                  onChange: (v: string) => { setFlowFilter(v as PayoutFlowState); setPage(1); },
                  options: FLOW_STATE_OPTIONS,
                }]
              : []),
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              loading={isFetching}
              leftIcon={<RefreshCw className="h-3 w-3" />}
            >
              Refresh
            </Button>
          }
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
                  <EurValue amount={selectedPayout.amount} currency={selectedPayout.currency} rates={eurRates} />
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge 
                  label={selectedPayout.status} 
                  status={selectedPayout.status === "paid" ? "confirmed" : selectedPayout.status === "failed" ? "cancelled_by_system" : selectedPayout.status === "pending" ? "pending" : selectedPayout.status === "scheduled" ? "confirmed" : "pending_payment"} 
                />
                {selectedPayout.flowState && (
                  <FlowStateChip state={selectedPayout.flowState} label={selectedPayout.flowLabel} />
                )}
              </div>
            </div>

            {/* Current-status explanation banner */}
            {selectedPayout.flowState && selectedPayout.flowReason && (
              <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <Info className="h-4.5 w-4.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h6 className="font-bold text-xs uppercase tracking-wider text-slate-700">Why is this payout here?</h6>
                  <p className="text-xs mt-1 text-slate-600 leading-relaxed">{selectedPayout.flowReason}</p>
                </div>
              </div>
            )}

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
                <dt className="text-xs text-slate-400">{selectedPayout.status === "pending" ? "Created Date" : selectedPayout.status === "paid" ? "Settled Date" : "Scheduled Date"}</dt>
                <dd className="font-medium text-slate-800 mt-0.5">
                  {selectedPayout.status === "pending"
                    ? formatDate(selectedPayout.createdAt)
                    : selectedPayout.status === "paid"
                      ? formatDate(selectedPayout.processedAt || selectedPayout.scheduledAt)
                      : formatDate(selectedPayout.scheduledAt)
                  }
                </dd>
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

            {/* Lifecycle note */}
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 space-y-2 text-xs text-purple-800">
              <div className="flex gap-2 items-start">
                <Info className="h-4.5 w-4.5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Payout lifecycle</p>
                  <p className="mt-1 leading-relaxed text-[11px] text-purple-700">
                    Payouts are created when a guest payment is confirmed. They disburse once the stay has completed (booking status
                    &quot;completed&quot;) and the merchant has a verified, configured payout method. Offline methods (bank transfer / mobile
                    money / manual) require an admin to execute the transfer and mark the payout paid. Until then, the current state
                    above explains exactly why this payout is where it is.
                  </p>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
              {(selectedPayout.flowState === "awaiting_merchant_setup" ||
                selectedPayout.flowState === "awaiting_merchant_verification" ||
                selectedPayout.flowState === "merchant_inactive") && (
                <a
                  href={`/dashboard/finance/merchants`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full"
                >
                  <Button className="w-full" variant="primary" leftIcon={<ExternalLink className="h-4 w-4" />}>
                    Review Merchant in Merchant Management
                  </Button>
                </a>
              )}
              <div className="flex gap-2">
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
                {selectedPayout.status === "pending" && (
                  <p className="text-xs text-slate-500 italic py-2">
                    This payout will disburse automatically once the state above is resolved. No manual action is required here.
                  </p>
                )}
              </div>
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
          description={`Are you sure you want to manually mark this payout of ${formatEur(markPaidConfirm.amount, markPaidConfirm.currency, eurRates) ?? formatCurrency(Number(markPaidConfirm.amount), markPaidConfirm.currency)} to ${markPaidConfirm.merchant?.businessName || "this provider"} as paid? This should be done after executing offline transfers.`}
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
          description={`Are you sure you want to cancel this scheduled payout of ${formatEur(cancelConfirm.amount, cancelConfirm.currency, eurRates) ?? formatCurrency(Number(cancelConfirm.amount), cancelConfirm.currency)}? Cancelled payouts cannot be automatically processed.`}
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
          description={`Do you want to retry processing payout ${retryConfirm.id} for ${formatEur(retryConfirm.amount, retryConfirm.currency, eurRates) ?? formatCurrency(Number(retryConfirm.amount), retryConfirm.currency)}? The payout will revert to a scheduled state.`}
          confirmLabel="Retry Transfer"
          variant="warning"
        />
      )}
    </div>
  );
}
