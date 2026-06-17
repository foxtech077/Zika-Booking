"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { ActionModal } from "@/components/modals/Modals";
import { formatDate, formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Voucher } from "@/types/admin";

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

export default function VouchersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [isActive, setIsActive] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    maxDiscount: "",
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

  const params = { ...(isActive !== "" ? { isActive } : {}), page: String(page), limit: "20" };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-vouchers", params],
    queryFn: () => fetchVouchers(params),
  });

  const vouchers: Voucher[] = data?.vouchers ?? [];
  const total: number = data?.total ?? vouchers.length;

  const createMut = useMutation({
    mutationFn: (body: any) => listingApi.post("/admin/vouchers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setAddModal(false);
      setForm({
        title: "", code: "", discountType: "percentage", discountValue: "", maxDiscount: "", activityScope: "universal",
        countryScope: "", validFrom: "", validUntil: "", usageLimit: "",
        usagePerGuest: "", applicableTiers: [], autoAssign: false, isActive: true
      });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      listingApi.patch(`/admin/vouchers/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vouchers"] }),
  });

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
      key: "usage",
      label: "Usage",
      render: (v) => (
        <div>
          <p className="text-sm font-medium">
            {(v.usageCount ?? v.redemptionCount ?? 0).toLocaleString()}
            {v.usageLimit ? ` / ${v.usageLimit.toLocaleString()}` : ""}
          </p>
          {v.usageLimit && (
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-24">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(((v.usageCount ?? 0) / v.usageLimit) * 100, 100)}%` }}
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
        <button
          onClick={(e) => { e.stopPropagation(); toggleMut.mutate({ id: v.id, isActive: !v.isActive }); }}
          className={`p-1.5 rounded-lg transition-colors ${v.isActive ? "text-success hover:bg-success/5" : "text-slate-400 hover:bg-slate-100"}`}
          title={v.isActive ? "Deactivate" : "Activate"}
        >
          {v.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Vouchers"
        description={`${total.toLocaleString()} vouchers`}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Voucher
          </Button>
        }
      />

      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "isActive",
              label: "All Status",
              value: isActive,
              onChange: (v) => { setIsActive(v); setPage(1); },
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
          ]}
        />
        <DataTable
          columns={columns}
          data={vouchers}
          loading={isLoading}
          emptyTitle="No vouchers found"
          emptyDescription="Create your first promotional voucher."
          emptyIcon={<Ticket className="h-10 w-10" />}
        />
        <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
      </Card>

      {/* Create voucher modal */}
      <ActionModal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Create Voucher"
        description="Configure a new promotional voucher code."
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={createMut.isPending}
              onClick={() => createMut.mutate({
                title: form.title,
                code: form.code.toUpperCase(),
                discountType: form.discountType,
                discountValue: parseFloat(form.discountValue),
                maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
                activityScope: form.activityScope,
                countryScope: form.countryScope || undefined,
                validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
                validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
                usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
                usagePerGuest: form.usagePerGuest ? parseInt(form.usagePerGuest) : undefined,
                applicableTiers: form.applicableTiers.length > 0 ? form.applicableTiers : undefined,
                autoAssign: form.autoAssign,
                isActive: form.isActive,
              })}
              disabled={!form.title || !form.code || !form.discountValue || !form.validFrom || !form.validUntil}
            >
              Create Voucher
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
          <Select
            id="discount-type"
            label="Discount Type"
            value={form.discountType}
            onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as any }))}
            options={[
              { value: "percentage", label: "Percentage (%)" },
              { value: "fixed", label: "Fixed Amount" },
            ]}
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
          <Select
            id="activity-scope"
            label="Applicable For"
            value={form.activityScope}
            onChange={(e) => setForm((f) => ({ ...f, activityScope: e.target.value }))}
            options={[
              { value: "universal", label: "Universal" },
              { value: "hotels", label: "Hotels" },
              { value: "apartments", label: "Apartments" },
              { value: "cars", label: "Cars" },
              { value: "hotels_apartments", label: "Hotels & Apartments" },
            ]}
          />
          <Input
            id="country-scope"
            label="Country Scope"
            value={form.countryScope}
            onChange={(e) => setForm((f) => ({ ...f, countryScope: e.target.value }))}
            placeholder="e.g. US, GB (leave empty for Universal)"
          />
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
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="valid-from" className="block text-sm font-medium text-slate-700">Valid From <span className="text-danger ml-0.5">*</span></label>
              {form.validFrom && <button type="button" onClick={() => setForm((f) => ({ ...f, validFrom: "" }))} className="text-xs text-slate-400 hover:text-slate-600 focus:outline-none">Clear</button>}
            </div>
            <Input
              id="valid-from"
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="valid-until" className="block text-sm font-medium text-slate-700">Valid Until <span className="text-danger ml-0.5">*</span></label>
              {form.validUntil && <button type="button" onClick={() => setForm((f) => ({ ...f, validUntil: "" }))} className="text-xs text-slate-400 hover:text-slate-600 focus:outline-none">Clear</button>}
            </div>
            <Input
              id="valid-until"
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
              min={form.validFrom || undefined}
              required
            />
          </div>
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
    </div>
  );
}
