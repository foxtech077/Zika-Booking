"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Voucher {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderValue: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  redemptionCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

interface VouchersResponse {
  vouchers: Voucher[];
}

interface CreateVoucherBody {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minOrderValue: string;
  maxDiscount: string;
  usageLimit: string;
  validFrom: string;
  validUntil: string;
}

const EMPTY_FORM: CreateVoucherBody = {
  code: "",
  discountType: "percentage",
  discountValue: "",
  minOrderValue: "",
  maxDiscount: "",
  usageLimit: "",
  validFrom: "",
  validUntil: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isExpired(validUntil: string) {
  return new Date(validUntil) < new Date();
}

function statusBadge(v: Voucher) {
  if (!v.isActive) return { label: "Inactive", cls: "bg-gray-100 text-gray-600" };
  if (isExpired(v.validUntil)) return { label: "Expired", cls: "bg-red-100 text-red-700" };
  if (v.usageLimit !== null && v.usageCount >= v.usageLimit) return { label: "Exhausted", cls: "bg-orange-100 text-orange-700" };
  if (new Date(v.validFrom) > new Date()) return { label: "Scheduled", cls: "bg-blue-100 text-blue-700" };
  return { label: "Active", cls: "bg-green-100 text-green-700" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VouchersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateVoucherBody>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<VouchersResponse>({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: VouchersResponse }>("/admin/vouchers");
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const code = form.code.trim().toUpperCase();
      if (!code) throw new Error("Voucher code is required.");
      const discountValue = parseFloat(form.discountValue);
      if (isNaN(discountValue) || discountValue <= 0) throw new Error("Discount value must be greater than 0.");
      if (form.discountType === "percentage" && discountValue > 100) throw new Error("Percentage discount cannot exceed 100.");
      if (!form.validFrom || !form.validUntil) throw new Error("Valid from and valid until dates are required.");
      if (new Date(form.validUntil) <= new Date(form.validFrom)) throw new Error("Valid until must be after valid from.");

      const body: Record<string, unknown> = {
        code,
        discountType: form.discountType,
        discountValue,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: new Date(form.validUntil).toISOString(),
      };
      if (form.minOrderValue) body.minOrderValue = parseFloat(form.minOrderValue);
      if (form.maxDiscount) body.maxDiscount = parseFloat(form.maxDiscount);
      if (form.usageLimit) body.usageLimit = parseInt(form.usageLimit, 10);

      await listingApi.post("/admin/vouchers", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError(null);
      setSuccessMsg("Voucher created successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setFormError(msg ?? (err as Error).message ?? "Failed to create voucher.");
    },
  });

  function updateField(key: keyof CreateVoucherBody, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setFormError(null);
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
        <Button onClick={() => { setShowForm((v) => !v); setFormError(null); }}>
          {showForm ? "Cancel" : "Create Voucher"}
        </Button>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Create and manage discount vouchers for guests.
      </p>

      {successMsg && (
        <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5">{successMsg}</p>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">New Voucher</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField
              label="Voucher code"
              value={form.code}
              onChange={(e) => updateField("code", e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER25"
              maxLength={30}
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.discountType}
                onChange={(e) => updateField("discountType", e.target.value)}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <FormField
              label={`Discount value (${form.discountType === "percentage" ? "%" : "amount"})`}
              type="number"
              value={form.discountValue}
              onChange={(e) => updateField("discountValue", e.target.value)}
              placeholder={form.discountType === "percentage" ? "e.g. 15" : "e.g. 1000"}
              min="0"
              step="0.01"
            />
            <FormField
              label="Min order value (optional)"
              type="number"
              value={form.minOrderValue}
              onChange={(e) => updateField("minOrderValue", e.target.value)}
              placeholder="e.g. 5000"
              min="0"
            />
            {form.discountType === "percentage" && (
              <FormField
                label="Max discount cap (optional)"
                type="number"
                value={form.maxDiscount}
                onChange={(e) => updateField("maxDiscount", e.target.value)}
                placeholder="e.g. 2000"
                min="0"
              />
            )}
            <FormField
              label="Usage limit (optional)"
              type="number"
              value={form.usageLimit}
              onChange={(e) => updateField("usageLimit", e.target.value)}
              placeholder="Leave blank for unlimited"
              min="1"
            />
            <FormField
              label="Valid from"
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => updateField("validFrom", e.target.value)}
            />
            <FormField
              label="Valid until"
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => updateField("validUntil", e.target.value)}
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{formError}</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
            >
              Create Voucher
            </Button>
          </div>
        </div>
      )}

      {/* Vouchers table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Discount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Usage</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Valid period</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-red-400">Failed to load vouchers.</td>
              </tr>
            ) : !data?.vouchers.length ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  No vouchers yet. Create one above to get started.
                </td>
              </tr>
            ) : data.vouchers.map((v) => {
              const badge = statusBadge(v);
              return (
                <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-gray-900">{v.code}</p>
                    {v.minOrderValue !== null && (
                      <p className="text-xs text-gray-500">Min order: {v.minOrderValue}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {v.discountType === "percentage"
                        ? `${v.discountValue}%`
                        : `${v.discountValue} (fixed)`}
                    </p>
                    {v.maxDiscount !== null && (
                      <p className="text-xs text-gray-500">Cap: {v.maxDiscount}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">
                      {v.usageCount} / {v.usageLimit !== null ? v.usageLimit : "unlimited"}
                    </p>
                    {v.redemptionCount !== v.usageCount && (
                      <p className="text-xs text-gray-500">{v.redemptionCount} redemptions</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <p>{formatDate(v.validFrom)}</p>
                    <p className="text-xs text-gray-500">to {formatDate(v.validUntil)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
