"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  RotateCcw, Search, Eye, Plus, Check, X, CreditCard, 
  AlertCircle, DollarSign, FileText, Info 
} from "lucide-react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal, ConfirmModal } from "@/components/modals/Modals";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useMockFinanceStore, type Refund, type Transaction } from "@/lib/mock-finance-store";
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

export default function RefundManagementPage() {
  const { user } = useAuthStore();
  const { 
    refunds, transactions, createRefund, 
    approveRefund, rejectRefund, processRefund 
  } = useMockFinanceStore();

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);

  // Initiate refund state
  const [isInitiating, setIsInitiating] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [customRefundAmount, setCustomRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Actions confirmations
  const [approveConfirm, setApproveConfirm] = useState<Refund | null>(null);
  const [processConfirm, setProcessConfirm] = useState<Refund | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<Refund | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter refunds based on scope & parameters
  const filteredRefunds = useMemo(() => {
    return refunds.filter((ref) => {
      // 1. Role Scope Filter
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(ref.country);
        if (!hasScope) return false;
      }

      // 2. Country Filter
      if (countryFilter && ref.country !== countryFilter) return false;

      // 3. Status Filter
      if (statusFilter && ref.status !== statusFilter) return false;

      // 4. Search Filter (match reference, guest name, refund ID)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesRef = ref.bookingReference.toLowerCase().includes(q);
        const matchesName = ref.travellerName.toLowerCase().includes(q);
        const matchesId = ref.id.toLowerCase().includes(q);
        if (!matchesRef && !matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [refunds, user, countryFilter, statusFilter, searchQuery]);

  // Paginated list
  const paginatedRefunds = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredRefunds.slice(start, start + limit);
  }, [filteredRefunds, page, limit]);

  // Find eligible transactions for refund (successful ones that aren't already refunded or fully escrowed for refund)
  const eligibleTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.status !== "successful") return false;
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(tx.country);
        if (!hasScope) return false;
      }
      // Check if there's already a processed/pending full refund
      const existingRefund = refunds.find(r => r.bookingId === tx.id && (r.status !== "rejected" && r.type === "full"));
      return !existingRefund;
    });
  }, [transactions, refunds, user]);

  const selectedTxDetails = useMemo(() => {
    return transactions.find((t) => t.id === selectedTxId);
  }, [selectedTxId, transactions]);

  // Max partial refund validator
  const maxRefundValue = useMemo(() => {
    if (!selectedTxDetails) return 0;
    // subtract any partial refunds already processed
    const alreadyRefunded = refunds
      .filter((r) => r.bookingId === selectedTxDetails.id && r.status === "processed")
      .reduce((sum, r) => sum + r.refundAmount, 0);
    return selectedTxDetails.amount - alreadyRefunded;
  }, [selectedTxDetails, refunds]);

  const canModifyRefunds = user?.role === "super_admin" || user?.role === "finance";

  // Actions Handlers
  const handleInitiateRefund = () => {
    if (!selectedTxDetails) return;
    const finalAmount = refundType === "full" ? selectedTxDetails.amount : parseFloat(customRefundAmount);
    
    if (isNaN(finalAmount) || finalAmount <= 0 || finalAmount > maxRefundValue) {
      alert(`Invalid refund amount. Must be between 0 and ${maxRefundValue}.`);
      return;
    }

    createRefund({
      bookingId: selectedTxDetails.id,
      bookingReference: selectedTxDetails.reference,
      travellerName: selectedTxDetails.travellerName,
      travellerEmail: selectedTxDetails.travellerEmail,
      originalAmount: selectedTxDetails.amount,
      refundAmount: finalAmount,
      currency: selectedTxDetails.currency,
      reason: refundReason,
      country: selectedTxDetails.country,
      type: refundType,
    });

    // Reset forms
    setIsInitiating(false);
    setSelectedTxId("");
    setRefundReason("");
    setCustomRefundAmount("");
  };

  const handleApprove = () => {
    if (!approveConfirm) return;
    setActionLoading(true);
    setTimeout(() => {
      approveRefund(approveConfirm.id);
      setApproveConfirm(null);
      setActionLoading(false);
    }, 1000);
  };

  const handleReject = () => {
    if (!rejectConfirm || !rejectionReason) return;
    setActionLoading(true);
    setTimeout(() => {
      rejectRefund(rejectConfirm.id, rejectionReason);
      setRejectConfirm(null);
      setRejectionReason("");
      setActionLoading(false);
    }, 1000);
  };

  const handleProcess = () => {
    if (!processConfirm) return;
    setActionLoading(true);
    setTimeout(() => {
      processRefund(processConfirm.id);
      setProcessConfirm(null);
      setActionLoading(false);
    }, 1200);
  };

  const columns: Column<Refund>[] = [
    {
      key: "id",
      label: "Refund ID",
      render: (r) => <span className="font-mono text-xs text-slate-400 font-semibold">{r.id}</span>,
    },
    {
      key: "ref",
      label: "Booking Ref",
      render: (r) => (
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{r.bookingReference}</span>
          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded ml-2">
            {r.country}
          </span>
        </div>
      ),
    },
    {
      key: "traveller",
      label: "Traveller",
      render: (r) => <span className="text-sm font-medium text-slate-900">{r.travellerName}</span>,
    },
    {
      key: "original",
      label: "Paid Total",
      align: "right",
      render: (r) => <span className="text-xs text-slate-500 tabular">{formatCurrency(r.originalAmount, r.currency)}</span>,
    },
    {
      key: "amount",
      label: "Refund Amount",
      align: "right",
      render: (r) => (
        <div className="text-right">
          <span className="font-bold text-sm text-danger tabular">{formatCurrency(r.refundAmount, r.currency)}</span>
          <span className="text-[10px] block text-slate-400 font-semibold uppercase">{r.type} Refund</span>
        </div>
      ),
    },
    {
      key: "date",
      label: "Requested Date",
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.requestedDate)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge 
          label={r.status === "pending_approval" ? "Pending Approval" : r.status} 
          status={r.status === "processed" ? "confirmed" : r.status === "approved" ? "confirmed" : r.status === "rejected" ? "cancelled_by_guest" : "pending_payment"} 
        />
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedRefund(r)}
            leftIcon={<Eye className="h-3 w-3" />}
          >
            Details
          </Button>

          {r.status === "pending_approval" && (
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={!canModifyRefunds}
                onClick={() => setApproveConfirm(r)}
                leftIcon={<Check className="h-3 w-3" />}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!canModifyRefunds}
                onClick={() => setRejectConfirm(r)}
                leftIcon={<X className="h-3 w-3" />}
              >
                Reject
              </Button>
            </>
          )}

          {r.status === "approved" && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!canModifyRefunds}
              onClick={() => setProcessConfirm(r)}
              leftIcon={<RotateCcw className="h-3 w-3 animate-spin-slow" />}
            >
              Process Fund Release
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
        title="Refund Management"
        description="Oversee guest cancel compensations, full booking reversals, and trigger payment gateway credit releases."
        action={
          <Button
            variant="primary"
            size="sm"
            disabled={!canModifyRefunds}
            onClick={() => setIsInitiating(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Initiate Refund
          </Button>
        }
      />

      {/* Filter bar */}
      <Card padding="none">
        <FilterBar
          search={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
          searchPlaceholder="Search booking ref, traveller name..."
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: statusFilter,
              onChange: (v) => { setStatusFilter(v); setPage(1); },
              options: [
                { value: "pending_approval", label: "Pending Approval" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "processed", label: "Processed" },
              ],
            },
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
          data={paginatedRefunds}
          loading={false}
          onRowClick={(r) => setSelectedRefund(r)}
          emptyTitle="No refunds recorded"
          emptyDescription="There are no refund records matching your selected query parameters."
          emptyIcon={<RotateCcw className="h-10 w-10 text-slate-300" />}
        />

        <Pagination
          page={page}
          limit={limit}
          total={filteredRefunds.length}
          onPageChange={setPage}
        />
      </Card>

      {/* Details drawer */}
      <SlideDrawer
        open={!!selectedRefund}
        onClose={() => setSelectedRefund(null)}
        title={`Refund Request: ${selectedRefund?.id}`}
        description="Verify booking logs, dispute reasons, and trigger bank clearance."
        width="md"
      >
        {selectedRefund && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Refund Amount</span>
                <span className="text-xl font-bold text-danger tracking-tight mt-0.5">
                  {formatCurrency(selectedRefund.refundAmount, selectedRefund.currency)}
                </span>
              </div>
              <Badge 
                label={selectedRefund.status} 
                status={selectedRefund.status === "processed" ? "confirmed" : selectedRefund.status === "approved" ? "confirmed" : selectedRefund.status === "rejected" ? "cancelled_by_guest" : "pending_payment"} 
              />
            </div>

            {/* Core details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Traveller / Claimant</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{selectedRefund.travellerName}</dd>
                <dd className="text-xs text-slate-500 font-mono">{selectedRefund.travellerEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Linked Booking Reference</dt>
                <dd className="font-semibold text-primary font-mono mt-0.5">{selectedRefund.bookingReference}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Refund Type</dt>
                <dd className="font-semibold uppercase text-xs text-slate-700 mt-0.5">{selectedRefund.type} Refund</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Original Total</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{formatCurrency(selectedRefund.originalAmount, selectedRefund.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Requested Date</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{formatDate(selectedRefund.requestedDate)}</dd>
              </div>
              {selectedRefund.processedDate && (
                <div>
                  <dt className="text-xs text-slate-400">Cleared Date</dt>
                  <dd className="font-semibold text-emerald-600 mt-0.5">{formatDate(selectedRefund.processedDate)}</dd>
                </div>
              )}
            </div>

            {/* Refund Reason */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Dispute / Cancellation Reason
              </span>
              <p className="text-xs text-slate-700 leading-relaxed italic">
                "{selectedRefund.reason}"
              </p>
            </div>

            {/* Rejection reason details */}
            {selectedRefund.status === "rejected" && selectedRefund.rejectionReason && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h6 className="font-bold text-xs uppercase tracking-wider text-red-900">Rejection Note</h6>
                  <p className="text-xs mt-1 text-red-700">{selectedRefund.rejectionReason}</p>
                </div>
              </div>
            )}

            {/* Document missing API endpoints */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              <div className="flex gap-2 items-start">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Missing API Dependencies Documented</p>
                  <p className="text-[11px] text-blue-700 mt-0.5 leading-snug font-mono">
                    POST /admin/refunds/request<br />
                    POST /admin/refunds/:id/approve<br />
                    POST /admin/refunds/:id/reject<br />
                    POST /admin/refunds/:id/process
                  </p>
                </div>
              </div>
            </div>

            {/* Actions panel */}
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              {selectedRefund.status === "pending_approval" && (
                <>
                  <Button
                    className="flex-1"
                    variant="primary"
                    disabled={!canModifyRefunds}
                    onClick={() => { setApproveConfirm(selectedRefund); setSelectedRefund(null); }}
                    leftIcon={<Check className="h-4 w-4" />}
                  >
                    Approve Request
                  </Button>
                  <Button
                    className="flex-1"
                    variant="danger"
                    disabled={!canModifyRefunds}
                    onClick={() => { setRejectConfirm(selectedRefund); setSelectedRefund(null); }}
                    leftIcon={<X className="h-4 w-4" />}
                  >
                    Reject Request
                  </Button>
                </>
              )}
              {selectedRefund.status === "approved" && (
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={!canModifyRefunds}
                  onClick={() => { setProcessConfirm(selectedRefund); setSelectedRefund(null); }}
                  leftIcon={<RotateCcw className="h-4 w-4 animate-spin-slow" />}
                >
                  Clear funds to Guest Gateway
                </Button>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Initiate Refund Request Modal */}
      <ActionModal
        open={isInitiating}
        onClose={() => { setIsInitiating(false); setSelectedTxId(""); setRefundReason(""); setCustomRefundAmount(""); }}
        title="Initiate Traveller Refund"
        description="Creates a refund request from an existing guest checkout session. Subject to Admin approval before gateway capture release."
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsInitiating(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleInitiateRefund}
              disabled={!selectedTxId || !refundReason || (refundType === "partial" && !customRefundAmount)}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            id="tx-booking"
            label="Select Booking Reference / Charge"
            value={selectedTxId}
            onChange={(e) => setSelectedTxId(e.target.value)}
            options={eligibleTransactions.map((tx) => ({
              value: tx.id,
              label: `${tx.reference} - ${tx.travellerName} (${formatCurrency(tx.amount, tx.currency)})`,
            }))}
            placeholder="Search successful bookings..."
            required
          />

          {selectedTxDetails && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1.5">
              <p className="font-semibold text-slate-800">Booking Summary</p>
              <p className="text-slate-500">Listing: <span className="font-semibold text-slate-700">{selectedTxDetails.listingName}</span></p>
              <p className="text-slate-500">Traveller: <span className="font-semibold text-slate-700">{selectedTxDetails.travellerName}</span></p>
              <p className="text-slate-500">Max Refundable Value: <span className="font-bold text-slate-700">{formatCurrency(maxRefundValue, selectedTxDetails.currency)}</span></p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-600 mb-1.5">Refund Option</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRefundType("full")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    refundType === "full" 
                      ? "bg-primary text-white border-primary" 
                      : "bg-white text-slate-700 border-border hover:bg-slate-50"
                  }`}
                >
                  Full Refund
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType("partial")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    refundType === "partial" 
                      ? "bg-primary text-white border-primary" 
                      : "bg-white text-slate-700 border-border hover:bg-slate-50"
                  }`}
                >
                  Partial Refund
                </button>
              </div>
            </div>

            {refundType === "partial" && (
              <Input
                id="partial-amount"
                label={`Custom Amount (${selectedTxDetails?.currency || "USD"})`}
                type="number"
                min="0.01"
                max={maxRefundValue}
                step="0.01"
                value={customRefundAmount}
                onChange={(e) => setCustomRefundAmount(e.target.value)}
                placeholder="e.g. 150.00"
                required
              />
            )}
          </div>

          <Textarea
            id="refund-desc"
            label="Refund Justification / Reason"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Provide cancellation details, check-in dispute information, or support agreements..."
            required
            rows={3}
          />
        </div>
      </ActionModal>

      {/* Approve Confirm Dialog */}
      <ConfirmModal
        open={!!approveConfirm}
        onClose={() => setApproveConfirm(null)}
        onConfirm={handleApprove}
        loading={actionLoading}
        title="Approve Refund Request"
        description={`Do you want to approve this refund request for ${formatCurrency(approveConfirm?.refundAmount || 0, approveConfirm?.currency)}? This authorizes the payout process.`}
        confirmLabel="Approve Request"
        variant="info"
      />

      {/* Process Confirm Dialog */}
      <ConfirmModal
        open={!!processConfirm}
        onClose={() => setProcessConfirm(null)}
        onConfirm={handleProcess}
        loading={actionLoading}
        title="Clear Credit to Gateway"
        description={`Are you sure you want to process this refund transaction? This will issue an API capture credit of ${formatCurrency(processConfirm?.refundAmount || 0, processConfirm?.currency)} to the guest's credit card.`}
        confirmLabel="Process Refund"
        variant="info"
      />

      {/* Reject Request Dialog */}
      <ActionModal
        open={!!rejectConfirm}
        onClose={() => { setRejectConfirm(null); setRejectionReason(""); }}
        title="Reject Refund Claim"
        description={`Rejecting refund request ${rejectConfirm?.id} for ${formatCurrency(rejectConfirm?.refundAmount || 0, rejectConfirm?.currency)}.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRejectConfirm(null)}>Cancel</Button>
            <Button 
              variant="danger" 
              size="sm" 
              onClick={handleReject} 
              disabled={!rejectionReason}
              loading={actionLoading}
            >
              Reject Claim
            </Button>
          </>
        }
      >
        <Textarea
          id="rejection-reason-input"
          label="Reason for Rejection"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="State why this refund request is rejected (e.g. past Flexible policy date)..."
          required
        />
      </ActionModal>
    </div>
  );
}
