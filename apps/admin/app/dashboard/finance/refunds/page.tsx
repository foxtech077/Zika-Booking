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
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { paymentPayoutApi } from "@/lib/payment-api";
import { canAccess } from "@/permissions/rbac";
import type { AdminRole } from "@/types/admin";

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
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [selectedRefund, setSelectedRefund] = useState<any | null>(null);

  // Initiate refund state
  const [isInitiating, setIsInitiating] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [customRefundAmount, setCustomRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Actions confirmations
  const [approveConfirm, setApproveConfirm] = useState<any | null>(null);
  const [processConfirm, setProcessConfirm] = useState<any | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-refunds-pending"],
    queryFn: async () => {
      const res = await paymentPayoutApi.get(`/admin/refunds/pending`);
      return res.data;
    },
  });

  const refunds = data?.data ?? [];

  // Filter refunds based on scope & parameters
  const filteredRefunds = useMemo(() => {
    return refunds.filter((ref: any) => {
      // 1. Search Filter (match bookingId, reason, refund ID)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesBooking = ref.bookingId.toLowerCase().includes(q);
        const matchesReason = ref.reason?.toLowerCase().includes(q);
        const matchesId = ref.id.toLowerCase().includes(q);
        if (!matchesBooking && !matchesReason && !matchesId) return false;
      }

      return true;
    });
  }, [refunds, searchQuery]);

  const paginatedRefunds = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredRefunds.slice(start, start + limit);
  }, [filteredRefunds, page, limit]);

  // Stubs for compiling the initiate forms (which are hidden from actions)
  const eligibleTransactions: any[] = [];
  const selectedTxDetails = null;
  const maxRefundValue = 0;

  const canModifyRefunds = canAccess(user?.role as AdminRole, "manage_finance") || user?.role === "country_manager";

  const processMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "approve" | "deny"; reason?: string }) => {
      const res = await paymentPayoutApi.post(`/admin/refunds/${id}/process`, {
        action,
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
      setApproveConfirm(null);
      setRejectConfirm(null);
      setProcessConfirm(null);
      setSelectedRefund(null);
      setRejectionReason("");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message ?? err?.message ?? "Failed to process refund");
    }
  });

  const actionLoading = processMutation.isPending;

  // Actions Handlers
  const handleInitiateRefund = () => {
    // Hidden from UI
  };

  const handleApprove = () => {
    if (!approveConfirm) return;
    processMutation.mutate({ id: approveConfirm.id, action: "approve" });
  };

  const handleReject = () => {
    if (!rejectConfirm) return;
    processMutation.mutate({ id: rejectConfirm.id, action: "deny", reason: rejectionReason });
  };

  const handleProcess = () => {
    if (!processConfirm) return;
    processMutation.mutate({ id: processConfirm.id, action: "approve" });
  };

  const columns: Column<any>[] = [
    {
      key: "id",
      label: "Refund ID",
      render: (r) => <span className="font-mono text-xs text-slate-400 font-semibold">{r.id}</span>,
    },
    {
      key: "ref",
      label: "Booking ID",
      render: (r) => (
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{r.bookingId}</span>
        </div>
      ),
    },
    {
      key: "traveller",
      label: "Traveller",
      render: (r) => <span className="text-sm font-medium text-slate-900">Guest</span>,
    },
    {
      key: "original",
      label: "Paid Total",
      align: "right",
      render: (r) => <span className="text-xs text-slate-500 tabular">{formatCurrency(Number(r.payment?.amount ?? 0), r.currency)}</span>,
    },
    {
      key: "amount",
      label: "Refund Amount",
      align: "right",
      render: (r) => (
        <div className="text-right">
          <span className="font-bold text-sm text-danger tabular">{formatCurrency(Number(r.amount), r.currency)}</span>
          <span className="text-[10px] block text-slate-400 font-semibold uppercase">Refund</span>
        </div>
      ),
    },
    {
      key: "date",
      label: "Requested Date",
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge
          label={r.status === "pending" ? "Pending Approval" : r.status}
          status={r.status === "succeeded" ? "confirmed" : r.status === "failed" ? "cancelled_by_guest" : "pending_payment"}
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

          {r.status === "pending" && canModifyRefunds && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setApproveConfirm(r)}
                leftIcon={<Check className="h-3 w-3" />}
                loading={processMutation.isPending && approveConfirm?.id === r.id}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRejectConfirm(r)}
                leftIcon={<X className="h-3 w-3" />}
                loading={processMutation.isPending && rejectConfirm?.id === r.id}
              >
                Reject
              </Button>
            </>
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
      />

      {/* Filter bar */}
      <Card padding="none">
        <FilterBar
          search={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
          searchPlaceholder="Search booking ID, refund ID, reason..."
          filters={[]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />

        <DataTable
          columns={columns}
          data={paginatedRefunds}
          loading={isLoading}
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
                  {formatCurrency(Number(selectedRefund.amount), selectedRefund.currency)}
                </span>
              </div>
              <Badge
                label={selectedRefund.status === "pending" ? "Pending Approval" : selectedRefund.status}
                status={selectedRefund.status === "succeeded" ? "confirmed" : selectedRefund.status === "failed" ? "cancelled_by_guest" : "pending_payment"}
              />
            </div>

            {/* Core details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Traveller / Claimant</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">Guest</dd>
                <dd className="text-xs text-slate-500 font-mono">Payment ID: {selectedRefund.paymentId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Linked Booking ID</dt>
                <dd className="font-semibold text-primary font-mono mt-0.5">{selectedRefund.bookingId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Refund Type</dt>
                <dd className="font-semibold uppercase text-xs text-slate-700 mt-0.5">Refund</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Original Total</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{formatCurrency(Number(selectedRefund.payment?.amount ?? 0), selectedRefund.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Requested Date</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{formatDate(selectedRefund.createdAt)}</dd>
              </div>
              {selectedRefund.refundedAt && (
                <div>
                  <dt className="text-xs text-slate-400">Cleared Date</dt>
                  <dd className="font-semibold text-emerald-600 mt-0.5">{formatDate(selectedRefund.refundedAt)}</dd>
                </div>
              )}
            </div>

            {/* Refund Reason */}
            {selectedRefund.reason && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Dispute / Cancellation Reason
                </span>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  "{selectedRefund.reason}"
                </p>
              </div>
            )}

            {/* Rejection reason details */}
            {selectedRefund.status === "failed" && selectedRefund.failureReason && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h6 className="font-bold text-xs uppercase tracking-wider text-red-900">Rejection Note</h6>
                  <p className="text-xs mt-1 text-red-700">{selectedRefund.failureReason}</p>
                </div>
              </div>
            )}

            {/* Actions panel */}
            {canModifyRefunds && (
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                {selectedRefund.status === "pending" && (
                  <>
                    <Button
                      className="flex-1"
                      variant="primary"
                      onClick={() => { setApproveConfirm(selectedRefund); setSelectedRefund(null); }}
                      leftIcon={<Check className="h-4 w-4" />}
                      loading={processMutation.isPending && approveConfirm?.id === selectedRefund.id}
                    >
                      Approve Request
                    </Button>
                    <Button
                      className="flex-1"
                      variant="danger"
                      onClick={() => { setRejectConfirm(selectedRefund); setSelectedRefund(null); }}
                      leftIcon={<X className="h-4 w-4" />}
                      loading={processMutation.isPending && rejectConfirm?.id === selectedRefund.id}
                    >
                      Reject Request
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>

      {/* Approve Confirm Dialog */}
      <ConfirmModal
        open={!!approveConfirm}
        onClose={() => setApproveConfirm(null)}
        onConfirm={handleApprove}
        loading={actionLoading}
        title="Approve Refund Request"
        description={`Do you want to approve this refund request for ${formatCurrency(Number(approveConfirm?.amount || 0), approveConfirm?.currency)}? This authorizes the gateway capture release.`}
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
        description={`Are you sure you want to process this refund transaction? This will issue an API capture credit of ${formatCurrency(Number(processConfirm?.amount || 0), processConfirm?.currency)} to the guest's credit card.`}
        confirmLabel="Process Refund"
        variant="info"
      />

      {/* Reject Request Dialog */}
      <ActionModal
        open={!!rejectConfirm}
        onClose={() => { setRejectConfirm(null); setRejectionReason(""); }}
        title="Reject Refund Claim"
        description={`Rejecting refund request ${rejectConfirm?.id} for ${formatCurrency(Number(rejectConfirm?.amount || 0), rejectConfirm?.currency)}.`}
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
