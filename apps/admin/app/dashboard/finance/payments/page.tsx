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
import { useMockFinanceStore, type Transaction } from "@/lib/mock-finance-store";
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

export default function BookingPaymentsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { transactions, updateTransactionStatus } = useMockFinanceStore();

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("");
  const [gateway, setGateway] = useState("");
  const [country, setCountry] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync mounted state
  useEffect(() => {
    setMounted(true);
    // Read investigate URL param
    const investigate = searchParams.get("investigate");
    if (investigate === "true") {
      setStatus("failed");
    }
  }, [searchParams]);

  // Handle Search & Filter Logic
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Role Scope Filter
      if (user?.role === "country_manager") {
        const hasScope = user.countryScope?.includes(tx.country);
        if (!hasScope) return false;
      }

      // 2. Country Dropdown Filter
      if (country && tx.country !== country) return false;

      // 3. Status Filter
      if (status && tx.status !== status) return false;

      // 4. Gateway Filter
      if (gateway && tx.gateway !== gateway) return false;

      // 5. Search Text Query (Match reference, traveller, provider, transactionId)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesRef = tx.reference.toLowerCase().includes(q);
        const matchesTraveller = tx.travellerName.toLowerCase().includes(q) || tx.travellerEmail.toLowerCase().includes(q);
        const matchesProvider = tx.providerName.toLowerCase().includes(q);
        const matchesTxId = tx.transactionId.toLowerCase().includes(q);
        const matchesListing = tx.listingName.toLowerCase().includes(q);
        if (!matchesRef && !matchesTraveller && !matchesProvider && !matchesTxId && !matchesListing) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, user, country, status, gateway, searchQuery]);

  // Paginate transactions
  const limit = 10;
  const paginatedTxs = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredTxs.slice(start, start + limit);
  }, [filteredTxs, page]);

  // Actions
  const handleForceStatusSync = (id: string, newStatus: Transaction["status"]) => {
    setIsSyncing(true);
    setTimeout(() => {
      updateTransactionStatus(
        id, 
        newStatus, 
        `Manual recovery triggered by ${user?.name || "Admin"}. Status sync forced to ${newStatus}.`
      );
      setIsSyncing(false);
      // Refresh active drawer details
      const updated = transactions.find((t) => t.id === id);
      if (updated) {
        setSelectedTx({
          ...updated,
          status: newStatus,
          logs: [...updated.logs, `Manual recovery triggered by ${user?.name || "Admin"}. Status sync forced to ${newStatus}.`]
        });
      }
    }, 1200);
  };

  const columns: Column<Transaction>[] = [
    {
      key: "ref",
      label: "Reference",
      render: (t) => (
        <div>
          <span className="font-mono text-sm font-semibold text-primary">{t.reference}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded leading-none">
              {t.listingType}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">{t.country}</span>
          </div>
        </div>
      ),
    },
    {
      key: "traveller",
      label: "Traveller",
      render: (t) => (
        <div>
          <p className="font-medium text-sm text-slate-900">{t.travellerName}</p>
          <p className="text-xs text-slate-500">{t.travellerEmail}</p>
        </div>
      ),
    },
    {
      key: "provider",
      label: "Provider / Listing",
      render: (t) => (
        <div className="max-w-[200px]">
          <p className="font-medium text-sm text-slate-900 truncate">{t.listingName}</p>
          <p className="text-xs text-slate-500 truncate">By {t.providerName}</p>
        </div>
      ),
    },
    {
      key: "gateway",
      label: "Gateway & ID",
      render: (t) => (
        <div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {t.gateway}
          </span>
          <p className="text-[11px] font-mono text-slate-400 mt-1 truncate max-w-[120px]" title={t.transactionId}>
            {t.transactionId}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (t) => (
        <div className="text-right">
          <p className="font-bold text-sm tabular">{formatCurrency(t.amount, t.currency)}</p>
          <p className="text-[10px] text-slate-400">Fee: {t.commissionRate}%</p>
        </div>
      ),
    },
    {
      key: "date",
      label: "Payment Date",
      render: (t) => <span className="text-xs text-slate-500">{formatDate(t.date)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (t) => <Badge label={t.status} status={t.status === "successful" ? "confirmed" : t.status === "failed" ? "cancelled_by_system" : t.status === "refunded" ? "suspended" : "pending_payment"} />,
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
          {(t.status === "failed" || t.status === "pending") && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setSelectedTx(t)}
              leftIcon={<ShieldAlert className="h-3 w-3" />}
            >
              Investigate
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Helper step mapping for display drawer
  const getActiveStep = (status: Transaction["status"]) => {
    if (status === "successful") return 3;
    if (status === "pending") return 2;
    if (status === "failed") return 2;
    return 1;
  };

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
          searchPlaceholder="Search reference, guest, TX ID..."
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "successful", label: "Successful" },
                { value: "pending", label: "Pending" },
                { value: "refunded", label: "Refunded" },
                { value: "failed", label: "Failed" },
              ],
            },
            {
              key: "gateway",
              label: "All Gateways",
              value: gateway,
              onChange: (v) => { setGateway(v); setPage(1); },
              options: [
                { value: "Stripe", label: "Stripe" },
                { value: "PayPal", label: "PayPal" },
                { value: "Tara", label: "Tara" },
              ],
            },
            {
              key: "country",
              label: "All Countries",
              value: country,
              onChange: (v) => { setCountry(v); setPage(1); },
              options: CM_OPTIONS,
            },
          ]}
        />

        <DataTable
          columns={columns}
          data={paginatedTxs}
          loading={false}
          onRowClick={(tx) => setSelectedTx(tx)}
          emptyTitle="No payments found"
          emptyDescription="No transaction records matched your search parameters."
          emptyIcon={<CreditCard className="h-10 w-10 text-slate-300" />}
        />
        
        <Pagination
          page={page}
          limit={limit}
          total={filteredTxs.length}
          onPageChange={setPage}
        />
      </Card>

      {/* Transaction Details & Investigation Drawer */}
      <SlideDrawer
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title={`Transaction Details: ${selectedTx?.reference}`}
        description={`Payment gateway records and resolution panel.`}
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
                status={selectedTx.status === "successful" ? "confirmed" : selectedTx.status === "failed" ? "cancelled_by_system" : selectedTx.status === "refunded" ? "suspended" : "pending_payment"} 
              />
            </div>

            {/* Core Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Traveller / Customer</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{selectedTx.travellerName}</dd>
                <dd className="text-xs text-slate-500 font-mono">{selectedTx.travellerEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Associated Provider</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{selectedTx.providerName}</dd>
                <dd className="text-xs text-slate-500 font-mono">ID: {selectedTx.providerId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Reserved Listing</dt>
                <dd className="font-semibold text-slate-900 mt-0.5 truncate max-w-[170px]" title={selectedTx.listingName}>
                  {selectedTx.listingName}
                </dd>
                <dd className="text-xs text-slate-500 capitalize">{selectedTx.listingType}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Payment Date</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">{formatDate(selectedTx.date)}</dd>
              </div>
            </div>

            {/* Payment breakdowns */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-xs border border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">Financial Capture</p>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Paid By Guest</span>
                <span className="font-bold text-slate-900 tabular">{formatCurrency(selectedTx.amount, selectedTx.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Platform Commission ({selectedTx.commissionRate}%)</span>
                <span className="font-semibold text-blue-600 tabular">+ {formatCurrency(selectedTx.commissionAmount, selectedTx.currency)}</span>
              </div>
              <div className="border-t border-slate-200 my-1 pt-1.5 flex justify-between">
                <span className="text-slate-700 font-semibold">Net Provider Settlement</span>
                <span className="font-extrabold text-emerald-600 tabular">{formatCurrency(selectedTx.providerPayout, selectedTx.currency)}</span>
              </div>
            </div>

            {/* Gateway response log audit trail */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5">
                Gateway Event Logs
              </p>
              <div className="bg-slate-950 text-slate-300 font-mono text-[11px] p-3 rounded-lg overflow-y-auto max-h-48 space-y-1.5 scrollbar-thin">
                {selectedTx.logs.map((log, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <span className="text-slate-500 select-none">[{index + 1}]</span>
                    <span className="break-all">{log}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing API Dependency documentation */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              <div className="flex gap-2 items-start">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Missing API Endpoints Documented</p>
                  <p className="text-[11px] text-blue-700 mt-0.5 leading-snug">
                    Force recovery is simulated client-side. Integrating with live gateway logs requires adding:
                    <code className="bg-blue-100/60 px-1 py-0.5 rounded text-[10px] ml-1 font-mono">
                      GET /admin/payments/:id/gateway-logs
                    </code>
                    and
                    <code className="bg-blue-100/60 px-1 py-0.5 rounded text-[10px] ml-1 font-mono">
                      POST /admin/payments/:id/force-sync
                    </code>
                  </p>
                </div>
              </div>
            </div>

            {/* Investigation and Resolution Console */}
            {(selectedTx.status === "failed" || selectedTx.status === "pending") && (
              <div className="border border-red-100 bg-red-50/[0.05] p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-danger">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="font-bold text-xs uppercase tracking-wider">Operational Recovery Console</span>
                </div>
                
                <p className="text-xs text-slate-600">
                  {selectedTx.status === "failed" 
                    ? "This payment failed card authorizations. If the traveller paid via alternative methods or the webhook failed to trigger, you can force success synchronization."
                    : "This transaction is currently flagged as pending. If confirmation was confirmed out-of-band, trigger manual resolution."
                  }
                </p>

                {/* Only Super Admin or Finance can execute actions */}
                {user?.role === "super_admin" || user?.role === "finance" ? (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleForceStatusSync(selectedTx.id, "successful")}
                      loading={isSyncing}
                      leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    >
                      Force Successful Status
                    </Button>
                    {selectedTx.status === "pending" && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleForceStatusSync(selectedTx.id, "failed")}
                        loading={isSyncing}
                        leftIcon={<XCircle className="h-3.5 w-3.5" />}
                      >
                        Force Failed Status
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-danger font-medium bg-red-50 p-2.5 rounded border border-red-100 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      Read-only role access. Payout approvals and manual payment status overrides require **Super Admin** or **Finance** roles.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
