"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  ShieldCheck,
  ShieldX,
  Eye,
  CheckCircle2,
  XCircle,
  CreditCard,
  Phone,
  Building2,
  Globe,
  Hash,
  Coins,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { paymentApi } from "@/lib/payment-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ConfirmModal } from "@/components/modals/Modals";
import { useAuthStore } from "@/stores/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { canAccess } from "@/permissions/rbac";
import { AccessDenied } from "@/components/ui/AccessDenied";

// -- Types ---------------------------------------------------------------------

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
  createdAt: string;
  updatedAt: string;
  payouts?: MerchantPayout[];
}

export interface MerchantPayout {
  id: string;
  bookingId: string;
  amount: number | string;
  currency: string;
  status: "scheduled" | "processing" | "paid" | "failed" | "cancelled";
  scheduledAt: string;
  processedAt?: string;
  createdAt: string;
}

// -- Helpers -------------------------------------------------------------------

function getPayoutMethodLabel(method: Merchant["payoutMethod"] | null | undefined): string {
  switch (method) {
    case "stripe_connect": return "Stripe Connect";
    case "mobile_money":   return "Mobile Money";
    case "bank_transfer":  return "Bank Transfer";
    default:               return "Manual";
  }
}

function getPayoutMethodIcon(method: Merchant["payoutMethod"] | null | undefined) {
  switch (method) {
    case "stripe_connect": return <CreditCard className="h-3.5 w-3.5 text-violet-500" />;
    case "mobile_money":   return <Phone className="h-3.5 w-3.5 text-emerald-500" />;
    case "bank_transfer":  return <Building2 className="h-3.5 w-3.5 text-blue-500" />;
    default:               return <Coins className="h-3.5 w-3.5 text-slate-400" />;
  }
}

function payoutStatusColor(status: MerchantPayout["status"]): string {
  switch (status) {
    case "paid":       return "text-emerald-700 bg-emerald-50 border border-emerald-100";
    case "scheduled":  return "text-blue-700 bg-blue-50 border border-blue-100";
    case "processing": return "text-amber-700 bg-amber-50 border border-amber-100";
    case "failed":     return "text-red-700 bg-red-50 border border-red-100";
    case "cancelled":  return "text-slate-500 bg-slate-50 border border-slate-100";
    default:           return "text-slate-500 bg-slate-50";
  }
}

// -- Merchant Detail Drawer ----------------------------------------------------

function MerchantDetailDrawer({
  merchantId,
  open,
  onClose,
  onVerify,
  canManage,
}: {
  merchantId: string | null;
  open: boolean;
  onClose: () => void;
  onVerify: (merchant: Merchant) => void;
  canManage: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-merchant-detail", merchantId],
    queryFn: () =>
      paymentApi.get(`/admin/merchants/${merchantId}`).then((r) => r.data?.data ?? r.data),
    enabled: !!merchantId && open,
  });

  const merchant: Merchant | null = data ?? null;

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      title="Merchant Profile"
      description="Merchant payout credentials and linked payouts."
      width="lg"
    >
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {merchant && !isLoading && (
        <div className="space-y-6">
          {/* Header card */}
          <div className="flex items-start justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base leading-tight">
                  {merchant.businessName || merchant.bankAccountName || `Merchant ${merchant.id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{merchant.id}</p>
                {merchant.country && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-200 text-slate-600 font-semibold rounded px-1.5 py-0.5 mt-1">
                    <Globe className="h-3 w-3" /> {merchant.country}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {merchant.isVerified ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Unverified
                </span>
              )}
              {merchant.isActive ? (
                <span className="text-[10px] text-emerald-600 font-semibold">Active</span>
              ) : (
                <span className="text-[10px] text-slate-400 font-semibold">Inactive</span>
              )}
            </div>
          </div>

          {/* Profile details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-400 mb-0.5">User ID</dt>
              <dd className="font-mono text-xs text-slate-600">{merchant.userId}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 mb-0.5">Payout Method</dt>
              <dd className="flex items-center gap-1.5 font-semibold text-slate-800">
                {getPayoutMethodIcon(merchant.payoutMethod)}
                {getPayoutMethodLabel(merchant.payoutMethod)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 mb-0.5">Registered</dt>
              <dd className="text-slate-700">{formatDate(merchant.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 mb-0.5">Last Updated</dt>
              <dd className="text-slate-700">{formatDate(merchant.updatedAt)}</dd>
            </div>
          </div>

          {/* Payment Credentials */}
          <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Payment Credentials
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {merchant.payoutMethod === "bank_transfer" && (
                <>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Bank Name</span>
                    <span className="font-semibold text-slate-800">{merchant.bankName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Account Name</span>
                    <span className="font-semibold text-slate-800">{merchant.bankAccountName || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block mb-0.5">Account Number / IBAN</span>
                    <span className="font-semibold font-mono text-slate-800">{merchant.bankAccountNumber || "—"}</span>
                  </div>
                </>
              )}
              {merchant.payoutMethod === "mobile_money" && (
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">Mobile Money Number</span>
                  <span className="font-semibold font-mono text-slate-800">{merchant.mobileMoneyNumber || "—"}</span>
                </div>
              )}
              {merchant.payoutMethod === "stripe_connect" && (
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-0.5">Stripe Connect Account ID</span>
                  <span className="font-semibold font-mono text-violet-700">{merchant.stripeConnectAccountId || "—"}</span>
                </div>
              )}
              {(!merchant.payoutMethod || merchant.payoutMethod === "manual") && (
                <div className="col-span-2 text-slate-400 italic text-center py-2">
                  No automated payment method configured. Manual dispatch required.
                </div>
              )}
            </div>
          </div>

          {/* Linked Payout History */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              Linked Payout History
              <span className="ml-auto text-xs text-slate-400 font-normal">{merchant.payouts?.length ?? 0} records</span>
            </h3>
            {!merchant.payouts?.length ? (
              <div className="text-center text-sm text-slate-400 py-6 bg-slate-50 rounded-xl border border-slate-100">
                No payouts linked to this merchant yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {merchant.payouts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                        <Hash className="h-4 w-4 text-primary/60" />
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-700">{p.bookingId}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatDate(p.scheduledAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {formatCurrency(Number(p.amount), p.currency)}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${payoutStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drawer actions */}
          {canManage && (
            <div className="pt-4 border-t border-slate-100">
              <Button
                className="w-full"
                variant={merchant.isVerified ? "danger" : "primary"}
                onClick={() => onVerify(merchant)}
                leftIcon={merchant.isVerified
                  ? <ShieldX className="h-4 w-4" />
                  : <ShieldCheck className="h-4 w-4" />
                }
              >
                {merchant.isVerified ? "Unverify Merchant" : "Verify Merchant"}
              </Button>
            </div>
          )}
        </div>
      )}
    </SlideDrawer>
  );
}

// -- Main Page -----------------------------------------------------------------

export default function MerchantManagementPage() {
  const { user, _hasHydrated } = useAuthStore();
  const qc = useQueryClient();

  if (_hasHydrated && !canAccess(user?.role as any, "view_merchants")) {
    return <AccessDenied />;
  }

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "true" | "false">("");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Merchant | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const canManage = user?.role === "super_admin" || user?.role === "finance";

  const { data, isLoading } = useQuery({
    queryKey: ["admin-merchants", verifiedFilter],
    queryFn: () => {
      const params: Record<string, string> = { limit: "200" };
      if (verifiedFilter !== "") params.verified = verifiedFilter;
      return paymentApi.get("/admin/merchants", { params }).then((r) => r.data?.data ?? r.data ?? []);
    },
  });

  const allMerchants: Merchant[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    if (!searchQuery) return allMerchants;
    const q = searchQuery.toLowerCase();
    return allMerchants.filter((m) =>
      (m.businessName ?? "").toLowerCase().includes(q) ||
      (m.bankAccountName ?? "").toLowerCase().includes(q) ||
      (m.country ?? "").toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.userId.toLowerCase().includes(q)
    );
  }, [allMerchants, searchQuery]);

  const paginated = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  const verifiedCount = allMerchants.filter((m) => m.isVerified).length;
  const unverifiedCount = allMerchants.filter((m) => !m.isVerified).length;

  const verifyMut = useMutation({
    mutationFn: ({ id, isVerified }: { id: string; isVerified: boolean }) =>
      paymentApi.patch(`/admin/merchants/${id}/verify`, { isVerified }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-merchants"] });
      qc.invalidateQueries({ queryKey: ["admin-merchant-detail", verifyTarget?.id] });
      setVerifyTarget(null);
      setSelectedMerchantId(null);
    },
  });

  const columns: Column<Merchant>[] = [
    {
      key: "merchant",
      label: "Merchant",
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0">
            <Store className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-900">
              {m.businessName || m.bankAccountName || `Merchant (${m.id.slice(0, 8)})`}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">{m.id.slice(0, 16)}…</p>
          </div>
        </div>
      ),
    },
    {
      key: "country",
      label: "Country",
      render: (m) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
          <Globe className="h-3 w-3" /> {m.country || "—"}
        </span>
      ),
    },
    {
      key: "method",
      label: "Payout Method",
      render: (m) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-700">
          {getPayoutMethodIcon(m.payoutMethod)}
          <span>{getPayoutMethodLabel(m.payoutMethod)}</span>
        </div>
      ),
    },
    {
      key: "verified",
      label: "Verification",
      render: (m) =>
        m.isVerified ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
            <XCircle className="h-3 w-3" /> Unverified
          </span>
        ),
    },
    {
      key: "active",
      label: "Status",
      render: (m) => (
        <Badge
          label={m.isActive ? "Active" : "Inactive"}
          status={m.isActive ? "confirmed" : "cancelled_by_system"}
        />
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (m) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedMerchantId(m.id)}
            leftIcon={<Eye className="h-3 w-3" />}
          >
            View
          </Button>
          {canManage && (
            <Button
              variant={m.isVerified ? "danger" : "primary"}
              size="sm"
              onClick={() => setVerifyTarget(m)}
              leftIcon={m.isVerified
                ? <ShieldX className="h-3 w-3" />
                : <ShieldCheck className="h-3 w-3" />
              }
            >
              {m.isVerified ? "Unverify" : "Verify"}
            </Button>
          )}
        </div>
      ),
    },
  ];

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
        title="Merchant Management"
        description="View and verify merchant payout profiles. Verification enables automated payouts."
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Total Merchants</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{allMerchants.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{verifiedCount}</p>
          <p className="text-xs text-emerald-500 mt-0.5">Automated payouts enabled</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Awaiting Verification
          </p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{unverifiedCount}</p>
          <p className="text-xs text-amber-500 mt-0.5">Manual payout only</p>
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        <FilterBar
          search={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
          searchPlaceholder="Search by business name, country, merchant ID…"
          filters={[
            {
              key: "verified",
              label: "All Verification Status",
              value: verifiedFilter,
              onChange: (v) => { setVerifiedFilter(v as "" | "true" | "false"); setPage(1); },
              options: [
                { value: "true",  label: "Verified" },
                { value: "false", label: "Unverified" },
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />

        <DataTable
          columns={columns}
          data={paginated}
          loading={isLoading}
          onRowClick={(m) => setSelectedMerchantId(m.id)}
          emptyTitle="No merchants found"
          emptyDescription="No merchant profiles match your current filters."
          emptyIcon={<Store className="h-10 w-10 text-slate-300" />}
        />

        <Pagination
          page={page}
          limit={limit}
          total={filtered.length}
          onPageChange={setPage}
        />
      </Card>

      {/* Merchant Detail Drawer */}
      <MerchantDetailDrawer
        merchantId={selectedMerchantId}
        open={!!selectedMerchantId}
        onClose={() => setSelectedMerchantId(null)}
        onVerify={(m) => { setVerifyTarget(m); setSelectedMerchantId(null); }}
        canManage={canManage}
      />

      {/* Verify / Unverify Confirmation Modal */}
      {verifyTarget && (
        <ConfirmModal
          open={!!verifyTarget}
          onClose={() => setVerifyTarget(null)}
          onConfirm={() => verifyMut.mutate({ id: verifyTarget.id, isVerified: !verifyTarget.isVerified })}
          loading={verifyMut.isPending}
          title={verifyTarget.isVerified ? "Unverify Merchant" : "Verify Merchant"}
          description={
            verifyTarget.isVerified
              ? `Unverifying "${verifyTarget.businessName || verifyTarget.id}" will disable automated payouts. Any scheduled payouts will need to be processed manually.`
              : `Verifying "${verifyTarget.businessName || verifyTarget.id}" will enable automated payouts for this merchant. Ensure their payment credentials have been reviewed and confirmed.`
          }
          confirmLabel={verifyTarget.isVerified ? "Unverify" : "Verify & Enable Payouts"}
          variant={verifyTarget.isVerified ? "danger" : "info"}
        />
      )}
    </div>
  );
}
