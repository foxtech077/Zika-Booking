"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, ToggleLeft, ToggleRight, Trash2, Edit2 } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, CustomDropdown } from "@/components/ui/Input";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { ActionModal, ConfirmModal } from "@/components/modals/Modals";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { formatDate, formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Voucher } from "@/types/admin";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";

countries.registerLocale(enLocale);
function codeToFlag(code: string) {
  return code.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}
const COUNTRY_OPTIONS = [
  { value: "all", label: "🌍 All Countries" },
  ...Object.keys(countries.getAlpha2Codes()).map((c) => ({
    value: c,
    label: `${codeToFlag(c)} ${countries.getName(c, "en")} (${c})`,
  })),
];
const fetchVouchers = (params: Record<string, string>) =>
  listingApi.get(`/admin/vouchers?${new URLSearchParams(params)}`).then((r) => {
    // ── DEBUG: Temporary logging — remove before production ──────────────────
    console.group(`[Vouchers] Fetch — isActive=${params.isActive ?? "(all)"}`);
    console.log("Params sent:", params);
    console.log("Raw r.data:", r.data);
    // Unwrap envelope: { success, data: { vouchers, total } } or { success, data: [...] }
    const body = r.data?.data ?? r.data;
    console.log("Unwrapped body:", body);
    const vouchers: any[] = body?.vouchers ?? (Array.isArray(body) ? body : []);
    const total: number = body?.total ?? body?.count ?? body?.pagination?.total ?? vouchers.length;
    console.log(`Resolved vouchers (${vouchers.length}):`, vouchers);
    console.log("Resolved total:", total);
    console.groupEnd();
    // ─────────────────────────────────────────────────────────────────────────
    return { vouchers, total };
  });

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default function VouchersPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const role = user?.role;
  const todayYMD = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  const canCreateVoucher = role === "super_admin";
  const hasManagePermission = canAccess(role, "manage_vouchers");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [selected, setSelected] = useState<Voucher | null>(null);
  const [form, setForm] = useState({
    id: "",
    title: "",
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    maxDiscount: "",
    minOrderValue: "",
    activityScope: "universal",
    countryScope: "",
    validFrom: "",
    validUntil: "",
    usageLimit: "",
    usagePerGuest: "",
    applicableTiers: [] as string[],
    autoAssign: false,
    isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vouchers", page, limit, statusFilter],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      };
      if (statusFilter) {
        params.status = statusFilter;
      }
      return fetchVouchers(params);
    },
  });

  const vouchersList: Voucher[] = data?.vouchers ?? [];
  const total = data?.total ?? 0;

  const [editModal, setEditModal] = useState(false);

  const createMut = useMutation({
    mutationFn: (body: any) => listingApi.post("/admin/vouchers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setAddModal(false);
      setForm({
        id: "", title: "", code: "", discountType: "percentage", discountValue: "", maxDiscount: "", minOrderValue: "", activityScope: "universal",
        countryScope: "", validFrom: "", validUntil: "", usageLimit: "",
        usagePerGuest: "", applicableTiers: [], autoAssign: false, isActive: true
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      listingApi.patch(`/admin/vouchers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setEditModal(false);
      setSelected(null);
      setForm({
        id: "", title: "", code: "", discountType: "percentage", discountValue: "", maxDiscount: "", minOrderValue: "", activityScope: "universal",
        countryScope: "", validFrom: "", validUntil: "", usageLimit: "",
        usagePerGuest: "", applicableTiers: [], autoAssign: false, isActive: true
      });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message ?? err?.message ?? "Failed to update voucher");
    }
  });

  const openEdit = (v: Voucher, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Parse ISO dates back to YYYY-MM-DD
    const parseDateLocal = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      return `${yyyy}-${mm}-${dd}`;
    };

    setForm({
      id: v.id,
      title: v.title || "",
      code: v.code || "",
      discountType: v.discountType,
      discountValue: String(v.discountValue || ""),
      maxDiscount: String(v.maxDiscount || ""),
      minOrderValue: String(v.minOrderValue || ""),
      activityScope: v.activityScope || "universal",
      countryScope: v.countryScope || "",
      validFrom: parseDateLocal(v.validFrom),
      validUntil: parseDateLocal(v.validUntil),
      usageLimit: String(v.usageLimit || ""),
      usagePerGuest: String(v.usageLimitPerGuest || ""),
      applicableTiers: v.applicableTiers ?? [],
      autoAssign: v.autoAssign ?? false,
      isActive: v.isActive ?? true,
    });
    setAddModal(false);
    setEditModal(true);
  };

  const handleCancel = () => {
    setAddModal(false);
    setEditModal(false);
    setForm({
      id: "", title: "", code: "", discountType: "percentage", discountValue: "", maxDiscount: "", minOrderValue: "", activityScope: "universal",
      countryScope: "", validFrom: "", validUntil: "", usageLimit: "",
      usagePerGuest: "", applicableTiers: [], autoAssign: false, isActive: true
    });
  };

  const handleSave = () => {
    const payload = {
      title: form.title,
      code: form.code.toUpperCase(),
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
      minOrderValue: form.minOrderValue ? parseFloat(form.minOrderValue) : null,
      activityScope: form.activityScope,
      countryScope: form.countryScope ? form.countryScope : null,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
      usageLimitPerGuest: form.usagePerGuest ? parseInt(form.usagePerGuest) : 1,
      applicableTiers: form.applicableTiers.length > 0 ? form.applicableTiers : [],
      autoAssign: form.autoAssign,
      isActive: form.isActive,
    };

    if (editModal) {
      updateMut.mutate({ id: form.id, body: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<Voucher | null>(null);

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      listingApi.patch(`/admin/vouchers/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vouchers"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => listingApi.delete(`/admin/vouchers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setDeleteConfirm(null);
      setSelected(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message ?? err?.message ?? "Failed to delete voucher");
    }
  });

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteMut.mutate(deleteConfirm.id);
  };

  const columns: Column<Voucher>[] = [
    {
      key: "code",
      label: "Code",
      render: (v) => (
        <div>
          <span className="font-mono font-bold text-sm tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
            {v.code}
          </span>
        </div>
      ),
    },
    {
      key: "discount",
      label: "Discount",
      render: (v) => (
        <div>
          <p className="font-semibold text-slate-900">
            {v.discountType === "percentage"
              ? `${v.discountValue}% off`
              : formatCurrency(v.discountValue, "USD")}
          </p>
          {v.minOrderValue && (
            <p className="text-xs text-slate-500">
              Min. order: {formatCurrency(v.minOrderValue, "USD")}
            </p>
          )}
          {v.maxDiscount && v.discountType === "percentage" && (
            <p className="text-xs text-slate-500">
              Max. discount: {formatCurrency(v.maxDiscount, "USD")}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "applicableFor",
      label: "Applicable For",
      render: (v) => {
        const labels: Record<string, string> = {
          universal: "Universal",
          hotels: "Hotels",
          apartments: "Apartments",
          cars: "Cars",
          hotels_apartments: "Hotels & Apartments",
        };
        return <span className="capitalize text-sm text-slate-700">{labels[v.activityScope || "universal"] || v.activityScope}</span>;
      },
    },
    {
      key: "countries",
      label: "Applicable Countries",
      render: (v) => {
        if (!v.countryScope) return <span className="text-sm text-slate-700">🌍 All Countries</span>;
        const countryName = countries.getName(v.countryScope, "en");
        return (
          <span className="text-sm text-slate-700">
            {codeToFlag(v.countryScope)} {countryName ? `${countryName} (${v.countryScope.toUpperCase()})` : v.countryScope.toUpperCase()}
          </span>
        );
      },
    },
    {
      key: "applicableTiers",
      label: "Applicable Tiers",
      render: (v) => {
        const tiers = v.applicableTiers ?? [];
        if (tiers.length === 0) return <span className="text-sm text-slate-500">All Tiers</span>;
        const tierColors: Record<string, string> = {
          bronze: "bg-orange-100 text-orange-700",
          silver: "bg-slate-100 text-slate-700",
          gold: "bg-amber-100 text-amber-700",
          diamond: "bg-blue-100 text-blue-700 border-blue-200",
        };
        return (
          <div className="flex flex-wrap gap-1">
            {tiers.map((tier) => (
              <span key={tier} className={`inline-flex items-center rounded-full font-medium px-2 py-0.5 text-xs capitalize ${tierColors[tier] ?? "bg-slate-100 text-slate-600"}`}>
                {tier}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "usage",
      label: "Usage",
      render: (v) => (
        <div>
          <p className="text-sm font-medium">
            {(v.redemptionCount ?? v.usageCount ?? 0).toLocaleString()}
            {v.usageLimit ? ` / ${v.usageLimit.toLocaleString()}` : ""}
          </p>
          {v.usageLimit && (
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-24">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(((v.redemptionCount ?? v.usageCount ?? 0) / v.usageLimit) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "validity",
      label: "Validity",
      render: (v) => (
        <div className="text-xs text-slate-600">
          <p>{formatDate(v.validFrom)} →</p>
          <p>{formatDate(v.validUntil)}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <Badge label={v.isActive ? "Active" : "Inactive"} status={v.isActive ? "active" : "deactivated"} />
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (v) => (
        <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {hasManagePermission && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); toggleMut.mutate({ id: v.id, isActive: !v.isActive }); }}
                className={`p-1.5 rounded-lg transition-colors ${v.isActive ? "text-success hover:bg-success/5" : "text-slate-400 hover:bg-slate-100"}`}
                title={v.isActive ? "Deactivate" : "Activate"}
              >
                {v.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <button
                onClick={(e) => openEdit(v, e)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors"
                title="Edit Voucher"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(v);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
                title="Delete Voucher"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Vouchers"
        description={`${total.toLocaleString()} vouchers`}
        action={
          canCreateVoucher && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddModal(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Voucher
            </Button>
          )
        }
      />

      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: statusFilter,
              onChange: (v) => { setStatusFilter(v); setPage(1); },
              options: [
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "expired", label: "Expired" },
                { value: "exhausted", label: "Exhausted" },
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={vouchersList}
          loading={isLoading}
          onRowClick={(v) => setSelected(v)}
          emptyTitle="No vouchers found"
          emptyDescription="Create your first promotional voucher."
          emptyIcon={<Ticket className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Voucher Details Drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Voucher Details: ${selected?.code}`}
        description={selected?.title || "Voucher configuration and usage details"}
        width="md"
      >
        {selected && (
          <div className="space-y-6">
            {/* General Info */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Configuration Details</h3>
              <InfoRow label="Title" value={selected.title || "—"} />
              <InfoRow label="Voucher Code" value={<span className="font-mono font-bold text-sm tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{selected.code}</span>} />
              <InfoRow label="Discount Type" value={<span className="capitalize">{selected.discountType}</span>} />
              <InfoRow label="Discount Value" value={selected.discountType === "percentage" ? `${selected.discountValue}%` : formatCurrency(selected.discountValue, "USD")} />
              {selected.discountType === "percentage" && selected.maxDiscount && (
                <InfoRow label="Max Discount Amount" value={formatCurrency(selected.maxDiscount, "USD")} />
              )}
              {selected.minOrderValue && (
                <InfoRow label="Min Order Value" value={formatCurrency(selected.minOrderValue, "USD")} />
              )}
            </div>

            {/* Eligibility & Target */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Target & Eligibility</h3>
              <InfoRow
                label="Applicable For"
                value={(() => {
                  const labels: Record<string, string> = {
                    universal: "Universal (All Categories)",
                    hotels: "Hotels Only",
                    apartments: "Apartments Only",
                    cars: "Car Rentals Only",
                    hotels_apartments: "Hotels & Apartments",
                  };
                  return labels[selected.activityScope || "universal"] || selected.activityScope;
                })()}
              />
              <InfoRow
                label="Applicable Countries"
                value={
                  selected.countryScope ? (
                    <span>
                      {codeToFlag(selected.countryScope)} {countries.getName(selected.countryScope, "en")} ({selected.countryScope.toUpperCase()})
                    </span>
                  ) : (
                    "🌍 All Countries"
                  )
                }
              />
              <InfoRow
                label="Applicable Tiers"
                value={
                  selected.applicableTiers && selected.applicableTiers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selected.applicableTiers.map((tier) => {
                        const tierColors: Record<string, string> = {
                          bronze: "bg-orange-100 text-orange-700",
                          silver: "bg-slate-100 text-slate-700",
                          gold: "bg-amber-100 text-amber-700",
                          diamond: "bg-blue-100 text-blue-700 border-blue-200",
                        };
                        return (
                          <span key={tier} className={`inline-flex items-center rounded-full font-medium px-2 py-0.5 text-xs capitalize ${tierColors[tier] ?? "bg-slate-100 text-slate-600"}`}>
                            {tier}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    "All Tiers"
                  )
                }
              />
              <InfoRow label="Auto Assign" value={selected.autoAssign ? "Enabled" : "Disabled"} />
              <InfoRow label="Status" value={<Badge label={selected.isActive ? "Active" : "Inactive"} status={selected.isActive ? "active" : "deactivated"} />} />
            </div>

            {/* Limits & Validity */}
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Usage & Validity</h3>
              <InfoRow label="Usage Limit" value={selected.usageLimit ? `${selected.usageLimit.toLocaleString()} total redemptions` : "Unlimited"} />
              <InfoRow label="Usage Per Guest" value={selected.usageLimitPerGuest ? `${selected.usageLimitPerGuest.toLocaleString()} per user` : "Unlimited"} />
              <InfoRow label="Max Redemptions Per User" value={selected.usageLimitPerGuest ? `${selected.usageLimitPerGuest.toLocaleString()} times` : "Unlimited"} />
              <InfoRow label="Redeemed Count" value={`${(selected.redemptionCount ?? selected.usageCount ?? 0).toLocaleString()} times`} />
              <InfoRow label="Valid From" value={formatDate(selected.validFrom)} />
              <InfoRow label="Valid Until" value={formatDate(selected.validUntil)} />
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Create / Edit voucher modal */}
      <ActionModal
        open={addModal || editModal}
        onClose={handleCancel}
        title={editModal ? "Edit Voucher" : "Create Voucher"}
        description={editModal ? "Update promotional voucher configuration." : "Configure a new promotional voucher code."}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={handleCancel}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={createMut.isPending || updateMut.isPending}
              onClick={handleSave}
              disabled={!form.title || !form.code || !form.discountValue || !form.validFrom || !form.validUntil}
            >
              {editModal ? "Save Changes" : "Create Voucher"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              id="voucher-title"
              label="Voucher Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Summer Special 20%"
              required
            />
          </div>
          <div className="col-span-2">
            <Input
              id="voucher-code"
              label="Voucher Code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="SUMMER20"
              className="font-mono uppercase tracking-wider"
              required
            />
          </div>
          <CustomDropdown
            id="discount-type"
            label="Discount Type"
            placeholder="Select discount type..."
            options={[
              { value: "percentage", label: "Percentage (%)" },
              { value: "fixed", label: "Fixed Amount" },
            ]}
            value={form.discountType}
            onChange={(val: any) => setForm((f) => ({ ...f, discountType: val as "percentage" | "fixed" }))}
          />
          <Input
            id="discount-value"
            label={form.discountType === "percentage" ? "Discount %" : "Discount Amount"}
            type="number"
            value={form.discountValue}
            onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
            placeholder={form.discountType === "percentage" ? "20" : "50"}
            required
          />
          <Input
            id="max-discount"
            label="Max Discount Amount"
            type="number"
            value={form.maxDiscount}
            onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
            placeholder="e.g. 100"
            hint="Only for percentage discounts"
            disabled={form.discountType !== "percentage"}
          />
          <Input
            id="min-order-value"
            label="Min Order Value"
            type="number"
            value={form.minOrderValue}
            onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
            placeholder="e.g. 50"
            hint="Minimum spend required"
          />
          <CustomDropdown
            id="activity-scope"
            label="Applicable For"
            placeholder="Select application scope..."
            options={[
              { value: "universal", label: "Universal" },
              { value: "hotels", label: "Hotels" },
              { value: "apartments", label: "Apartments" },
              { value: "cars", label: "Cars" },
              { value: "hotels_apartments", label: "Hotels & Apartments" },
            ]}
            value={form.activityScope}
            onChange={(val: any) => setForm((f) => ({ ...f, activityScope: val }))}
          />


          <div className="col-span-2">
            <CustomDropdown
              id="country-scope"
              label="Country Scope"
              placeholder="Select country scope..."
              options={COUNTRY_OPTIONS}
              value={form.countryScope || "all"}
              onChange={(val: any) =>
                setForm((f) => ({
                  ...f,
                  countryScope: val === "all" ? "" : val,
                }))
              }
              variant="blue"
            />
          </div>
          <Input
            id="usage-limit"
            label="Usage Limit"
            type="number"
            value={form.usageLimit}
            onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
            placeholder="100"
            hint="Leave empty for unlimited"
          />
          <Input
            id="usage-per-guest"
            label="Usage Per Guest"
            type="number"
            value={form.usagePerGuest}
            onChange={(e) => setForm((f) => ({ ...f, usagePerGuest: e.target.value }))}
            placeholder="1"
            hint="Max redemptions per user"
          />
          <DatePicker
            id="valid-from"
            label="Valid From"
            placeholder="Select start date"
            value={form.validFrom}
            onChange={(val) => setForm((f) => ({ ...f, validFrom: val }))}
            minDate={todayYMD}
            required
          />
          <DatePicker
            id="valid-until"
            label="Valid Until"
            placeholder="Select end date"
            value={form.validUntil}
            onChange={(val) => setForm((f) => ({ ...f, validUntil: val }))}
            minDate={form.validFrom || todayYMD}
            required
          />
          <div className="col-span-2">
            <p className="block text-sm font-medium text-slate-700 mb-1">Applicable Tiers</p>
            <div className="flex gap-4">
              {["bronze", "silver", "gold", "diamond"].map((tier) => (
                <label key={tier} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.applicableTiers.includes(tier)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm((f) => ({ ...f, applicableTiers: [...f.applicableTiers, tier] }));
                      } else {
                        setForm((f) => ({ ...f, applicableTiers: f.applicableTiers.filter((t) => t !== tier) }));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm capitalize text-slate-700">{tier}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2 flex gap-6 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoAssign}
                onChange={(e) => setForm((f) => ({ ...f, autoAssign: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700">Auto Assign</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700">Active Status</span>
            </label>
          </div>
        </div>
      </ActionModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Voucher"
        description={`Are you sure you want to permanently delete the voucher "${deleteConfirm?.code}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  );
}
