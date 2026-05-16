"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommissionRate {
  id: string;
  country: string;
  rate: number;
  setBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CommissionRatesResponse {
  defaultRate: number;
  rates: CommissionRate[];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommissionPage() {
  const qc = useQueryClient();

  const [form, setForm] = useState({ country: "", rate: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingCountry, setDeletingCountry] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<CommissionRatesResponse>({
    queryKey: ["commission-rates"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: CommissionRatesResponse }>("/admin/commission-rates");
      return res.data.data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const rateNum = parseFloat(form.rate);
      if (!form.country.trim() || form.country.trim().length !== 2) {
        throw new Error("Country code must be exactly 2 characters (e.g. KE, NG, ZA).");
      }
      if (isNaN(rateNum) || rateNum < 0 || rateNum > 30) {
        throw new Error("Rate must be a number between 0 and 30 (percent).");
      }
      await listingApi.post("/admin/commission-rates", {
        country: form.country.trim().toUpperCase(),
        rate: rateNum / 100, // API expects a decimal (0.05 = 5%)
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rates"] });
      setForm({ country: "", rate: "" });
      setFormError(null);
      setSuccessMsg("Commission rate saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setFormError(msg ?? (err as Error).message ?? "Failed to save rate.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (country: string) => {
      await listingApi.delete(`/admin/commission-rates/${country}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rates"] });
      setDeletingCountry(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setFormError(msg ?? "Failed to delete rate.");
      setDeletingCountry(null);
    },
  });

  const defaultRatePct = data ? (data.defaultRate * 100).toFixed(1) : "5.0";

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Commission Rates</h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage country-specific commission rates. Countries without a specific rate use the global default.
      </p>

      {/* Default rate banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6">
        <p className="text-sm font-medium text-blue-900">
          Global default rate: <span className="font-bold text-lg">{defaultRatePct}%</span>
        </p>
        <p className="text-xs text-blue-700 mt-0.5">
          Applied to all countries not listed below.
        </p>
      </div>

      {/* Add / edit form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Add or Update Country Rate</h2>
        <div className="flex gap-3 items-end">
          <div className="w-32">
            <FormField
              label="Country code"
              value={form.country}
              onChange={(e) => {
                setForm((p) => ({ ...p, country: e.target.value.toUpperCase().slice(0, 2) }));
                setFormError(null);
              }}
              placeholder="e.g. KE"
              maxLength={2}
            />
          </div>
          <div className="w-40">
            <FormField
              label="Rate (%)"
              type="number"
              value={form.rate}
              onChange={(e) => {
                setForm((p) => ({ ...p, rate: e.target.value }));
                setFormError(null);
              }}
              placeholder="e.g. 8"
              min="0"
              max="30"
              step="0.1"
            />
          </div>
          <div className="mb-4">
            <Button
              onClick={() => { setFormError(null); upsertMutation.mutate(); }}
              loading={upsertMutation.isPending}
              disabled={!form.country || !form.rate}
            >
              Save Rate
            </Button>
          </div>
        </div>
        {formError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
        )}
        {successMsg && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{successMsg}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Enter a percentage value (0–30). For example, enter <code>8</code> for 8%.
        </p>
      </div>

      {/* Rates table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Country</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rate</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Set by</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Last updated</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-red-400">Failed to load commission rates.</td>
              </tr>
            ) : !data?.rates.length ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  No country-specific rates set. All countries use the {defaultRatePct}% global default.
                </td>
              </tr>
            ) : data.rates.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold text-gray-900">{r.country}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{(r.rate * 100).toFixed(1)}%</span>
                  {r.rate * 100 > parseFloat(defaultRatePct) ? (
                    <span className="ml-2 text-xs text-orange-600">(above default)</span>
                  ) : r.rate * 100 < parseFloat(defaultRatePct) ? (
                    <span className="ml-2 text-xs text-green-600">(below default)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{r.setBy}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  {deletingCountry === r.country ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Sure?</span>
                      <button
                        onClick={() => deleteMutation.mutate(r.country)}
                        disabled={deleteMutation.isPending}
                        className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        onClick={() => setDeletingCountry(null)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setForm({ country: r.country, rate: (r.rate * 100).toFixed(1) })}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingCountry(r.country)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
