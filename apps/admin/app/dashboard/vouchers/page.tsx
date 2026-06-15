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
  listingApi.get(`/admin/vouchers?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

export default function VouchersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isActive, setIsActive] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    code: "",
    activityScope: "universal" as string,
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    minOrderValue: "",
    maxDiscount: "",
    usageLimit: "",
    validFrom: "",
    validUntil: "",
  });

  const params = { ...(isActive ? { isActive } : {}), page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-vouchers", params],
    queryFn: () => fetchVouchers(params),
  });

  const vouchers: Voucher[] = data?.vouchers ?? [];
  const total: number = data?.total ?? 0;

  const createMut = useMutation({
    mutationFn: (body: any) => listingApi.post("/admin/vouchers", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setAddModal(false);
      setForm({ title: "", code: "", activityScope: "universal", discountType: "percentage", discountValue: "", minOrderValue: "", maxDiscount: "", usageLimit: "", validFrom: "", validUntil: "" });
    },
  });

  // TODO: Backend dependency — PATCH /admin/vouchers/:id is not yet implemented.
  // This mutation uses PUT /admin/vouchers/:id as the intended endpoint.
  // Once the backend adds a PUT or PATCH route for updating vouchers, remove the onError fallback.
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      listingApi.put(`/admin/vouchers/${id}`, { isActive }),
    onSuccess: () => {
      setToggleError(null);
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      if (status === 404) {
        setToggleError("Voucher toggle is not yet supported by the API. A backend update (PUT /admin/vouchers/:id) is required.");
      } else {
        setToggleError(error?.response?.data?.message ?? "Failed to update voucher status.");
      }
      // Auto-dismiss after 5 seconds
      setTimeout(() => setToggleError(null), 5000);
    },
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
      {/* Error banner for toggle failures */}
      {toggleError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <svg className="h-5 w-5 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="flex-1">{toggleError}</span>
          <button onClick={() => setToggleError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}
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
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={vouchers}
          loading={isLoading}
          emptyTitle="No vouchers found"
          emptyDescription="Create your first promotional voucher."
          emptyIcon={<Ticket className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
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
                activityScope: form.activityScope,
                discountType: form.discountType,
                discountValue: parseFloat(form.discountValue),
                minOrderValue: form.minOrderValue ? parseFloat(form.minOrderValue) : undefined,
                maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
                usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
                validFrom: form.validFrom,
                validUntil: form.validUntil,
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
              placeholder="Summer Sale 20% Off"
              hint="A descriptive name for this voucher"
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
            id="activity-scope"
            label="Activity Scope"
            value={form.activityScope}
            onChange={(e) => setForm((f) => ({ ...f, activityScope: e.target.value }))}
            options={[
              { value: "universal", label: "Universal (All)" },
              { value: "hotels", label: "Hotels" },
              { value: "apartments", label: "Apartments" },
              { value: "cars", label: "Cars" },
              { value: "hotels_apartments", label: "Hotels & Apartments" },
            ]}
          />
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
            id="min-order"
            label="Min. Order Value"
            type="number"
            value={form.minOrderValue}
            onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
            placeholder="0"
            hint="Leave empty for no minimum"
          />
          {form.discountType === "percentage" && (
            <Input
              id="max-discount"
              label="Max. Discount Amount"
              type="number"
              value={form.maxDiscount}
              onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
              placeholder="100"
              hint="Cap for percentage discounts"
            />
          )}
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
            id="valid-from"
            label="Valid From"
            type="datetime-local"
            value={form.validFrom}
            onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            required
          />
          <Input
            id="valid-until"
            label="Valid Until"
            type="datetime-local"
            value={form.validUntil}
            onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            required
          />
        </div>
      </ActionModal>
    </div>
  );
}
