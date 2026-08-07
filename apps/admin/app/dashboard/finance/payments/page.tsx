"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { 
  CreditCard, Search, ShieldAlert, Eye, RefreshCw, 
  CheckCircle2, XCircle, Info, Sparkles, HeartHandshake
} from "lucide-react";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { paymentPayoutApi } from "@/lib/payment-api";
import { roleScopePolicy, AdminScope } from "@/permissions/rbac";
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

export default function BookingPaymentsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Sync mounted state
  useEffect(() => {
    setMounted(true);
    // Read investigate URL param
    const investigate = searchParams.get("investigate");
    if (investigate === "true") {
      setStatus("failed");
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const res = await paymentPayoutApi.get(`/admin/payments`, {
        params: { page: "1", limit: "100" }, // Fetch max allowed records
      });
      return res.data;
    },
  });

  const payments = data?.data ?? [];

  // Country scope (country_manager / sales): only show records in assigned countries.
  const isCountryScoped = roleScopePolicy(user?.role as AdminRole) === AdminScope.CountryScoped;

  // Handle Search & Filter Logic
  const filteredPayments = useMemo(() => {
    return payments.filter((p: any) => {
      // 0. Country Scope Filter
      if (isCountryScoped) {
        const hasScope = user?.countryScope?.includes(p.countryCode ?? "");
        if (!hasScope) return false;
      }

      // 1. Status Filter
      if (status && p.status !== status) return false;

      // 2. Search Text Query (Match bookingId, id)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesBooking = p.bookingId.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        if (!matchesBooking && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [payments, status, searchQuery, isCountryScoped, user]);

  // Paginate the filtered results on the client side
  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredPayments.slice(start, start + limit);
  }, [filteredPayments, page, limit]);

  const total = filteredPayments.length;

  const columns: Column<any>[] = [
    {
      key: "displayId",
      label: "Payment ID",
      render: (t) => <span className="font-mono text-xs text-slate-400 font-semibold">{t.displayId ?? t.id}</span>,
    },
    {
      key: "bookingId",
      label: "Booking ID",
      render: (t) => (
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{t.bookingId}</span>
        </div>
      ),
    },
    {
      key: "gateway",
      label: "Gateway & Provider ID",
      render: (t) => (
        <div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
            {t.paymentProvider}
          </span>
          {t.providerPaymentId && (
            <p className="text-[11px] font-mono text-slate-400 mt-1 truncate max-w-[150px]" title={t.providerPaymentId}>
              {t.providerPaymentId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (t) => (
        <div className="text-right">
          <p className="font-bold text-sm tabular">{formatCurrency(Number(t.amount), t.currency)}</p>
        </div>
      ),
    },
    {
      key: "date",
      label: "Payment Date",
      render: (t) => <span className="text-xs text-slate-500">{formatDate(t.capturedAt ?? t.createdAt)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (t) => {
        const badgeStatus =
          t.status === "captured"
            ? "confirmed"
            : t.status === "refunded"
            ? "suspended"
            : t.status === "failed"
            ? "cancelled_by_system"
            : "pending_payment";
        return <Badge label={t.status} status={badgeStatus} />;
      },
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedTx(t)}
            leftIcon={<Eye className="h-3 w-3" />}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  // Helper step mapping for display drawer
  const getActiveStep = (status: string) => {
    if (status === "captured" || status === "refunded") return 3;
    if (status === "pending" || status === "initiated") return 2;
    if (status === "failed") return 2;
    return 1;
  };

  const CM_OPTIONS = useMemo(() => {
    if (roleScopePolicy(user?.role as AdminRole) === AdminScope.CountryScoped) {
      return COUNTRY_OPTIONS.filter((opt) => user?.countryScope?.includes(opt.value));
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
        title="Booking Payments"
        description="Monitor checkout transactions, gateway capture responses, and address unresolved payment failures."
      />

      {/* Info notice if investigating failures */}
      {status === "failed" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="font-semibold text-sm">Issue Investigation Mode Active</h5>
            <p className="text-xs text-amber-700 mt-1">
              Currently filtering results to failed checkout sessions. Inspect raw gateway events and force state recovery as needed.
            </p>
          </div>
          <button 
            onClick={() => setStatus("")} 
            className="ml-auto text-xs text-amber-800 underline hover:text-amber-950 font-medium"
          >
            Show All
          </button>
        </div>
      )}

      {/* Filters Card */}
      <Card padding="none">
        <FilterBar
          search={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
          searchPlaceholder="Search payment ID, booking ID..."
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "captured", label: "Captured" },
                { value: "pending", label: "Pending" },
                { value: "refunded", label: "Refunded" },
                { value: "failed", label: "Failed" },
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />

        <DataTable
          columns={columns}
          data={paginatedPayments}
          loading={isLoading}
          onRowClick={(tx) => setSelectedTx(tx)}
          emptyTitle="No payments found"
          emptyDescription="No transaction records matched your search parameters."
          emptyIcon={<CreditCard className="h-10 w-10 text-slate-300" />}
        />
        
        <Pagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {/* Transaction Details & Investigation Drawer */}
      <SlideDrawer
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title={`Transaction Details: ${selectedTx?.id}`}
        description={`Payment gateway records and status summary.`}
        width="md"
      >
        {selectedTx && (
          <div className="space-y-6">
            {/* Status indicator */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Payment Status</span>
                <span className="text-lg font-bold text-slate-900 uppercase tracking-tight mt-1 inline-block">
                  {selectedTx.status}
                </span>
              </div>
              <Badge 
                label={selectedTx.status} 
                status={selectedTx.status === "captured" ? "confirmed" : selectedTx.status === "failed" ? "cancelled_by_system" : selectedTx.status === "refunded" ? "suspended" : "pending_payment"} 
              />
            </div>

            {/* Core Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Traveller / Customer</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">Guest</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Associated Booking</dt>
                <dd className="font-semibold text-primary font-mono mt-0.5">ID: {selectedTx.bookingId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Gateway Provider</dt>
                <dd className="font-semibold text-slate-900 mt-0.5 capitalize">{selectedTx.paymentProvider}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Payment ID</dt>
                <dd className="font-semibold text-slate-900 mt-0.5 font-mono truncate max-w-[170px]" title={selectedTx.displayId ?? selectedTx.id}>
                  {selectedTx.displayId ?? selectedTx.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Internal ID</dt>
                <dd className="font-semibold text-slate-900 mt-0.5 font-mono truncate max-w-[170px]" title={selectedTx.id}>
                  {selectedTx.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Provider Payment ID</dt>
                <dd className="font-semibold text-slate-900 mt-0.5 font-mono truncate max-w-[170px]" title={selectedTx.providerPaymentId}>
                  {selectedTx.providerPaymentId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Card Brand / Last 4</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {selectedTx.cardBrand ? `${selectedTx.cardBrand} (Ending in ${selectedTx.cardLast4})` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Payment Date</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{formatDate(selectedTx.capturedAt ?? selectedTx.createdAt)}</dd>
              </div>
            </div>

            {/* Payment breakdowns */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-xs border border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">Financial Capture</p>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Paid By Guest</span>
                <span className="font-bold text-slate-900 tabular">{formatCurrency(Number(selectedTx.amount), selectedTx.currency)}</span>
              </div>
            </div>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
