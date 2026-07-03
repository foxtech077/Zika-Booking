"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Percent, Plus, Trash2, Globe } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, CustomDropdown } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal, ActionModal } from "@/components/modals/Modals";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatDate } from "@/lib/utils";
import { canAccess } from "@/permissions/rbac";
import type { CommissionRate, CommissionRatesResponse, AdminRole } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";

import { SYSTEM_COUNTRIES } from "@/lib/countries";

const fetchRates = () =>
  listingApi.get("/admin/commission-rates").then((r) => r.data.data ?? r.data);

const COUNTRY_OPTIONS = SYSTEM_COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.name} (${c.code})`,
}));

export default function CommissionPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const role = user?.role;
  const canManageCommission = role === "super_admin";

  const [addModal, setAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CommissionRate | null>(null);
  const [newCountry, setNewCountry] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newEffectiveFrom, setNewEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [newNotifyProviders, setNewNotifyProviders] = useState(false);
  const [newReason, setNewReason] = useState("");

  // Global rate edit states
  const [globalModal, setGlobalModal] = useState(false);
  const [globalRateInput, setGlobalRateInput] = useState("");
  const [globalEffectiveFrom, setGlobalEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [globalReason, setGlobalReason] = useState("");
  const [globalNotifyProviders, setGlobalNotifyProviders] = useState(false);
  const [globalApplyToAll, setGlobalApplyToAll] = useState(false);
  const [globalConfirmText, setGlobalConfirmText] = useState("");

  const { data, isLoading } = useQuery<CommissionRatesResponse>({
    queryKey: ["admin-commission-rates"],
    queryFn: fetchRates,
  });

  const rates: CommissionRate[] = data?.rates ?? [];
  const defaultRate: number = (data as any)?.globalRate != null ? (data as any).globalRate * 100 : (data?.defaultRate ?? 5);

  const filteredRates = useMemo(() => {
    if (role === "super_admin" || role === "admin" || role === "finance" || role === "support") {
      return rates;
    }
    if (role === "country_manager" || role === "sales") {
      return rates.filter((r) => user?.countryScope?.includes(r.country));
    }
    return [];
  }, [rates, role, user?.countryScope]);

  const upsertMut = useMutation({
    mutationFn: ({
      country,
      rate,
      effectiveFrom,
      notifyProviders,
      reason,
    }: {
      country: string;
      rate: number;
      effectiveFrom: string;
      notifyProviders: boolean;
      reason: string;
    }) =>
      listingApi.post("/admin/commission-rates", {
        country,
        rate: rate / 100, // Backend expects decimal representation (e.g. 0.125 for 12.5%)
        effectiveFrom,
        notifyProviders,
        reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-commission-rates"] });
      setAddModal(false);
      setNewCountry("");
      setNewRate("");
      setNewEffectiveFrom(new Date().toISOString().slice(0, 10));
      setNewNotifyProviders(false);
      setNewReason("");
    },
  });

  const updateGlobalMut = useMutation({
    mutationFn: (body: {
      rate: number;
      effectiveFrom: string;
      reason: string;
      applyToAll: boolean;
      notifyProviders: boolean;
    }) =>
      listingApi.post("/admin/commission-rates/global", {
        rate: body.rate / 100, // backend expects decimal
        effectiveFrom: body.effectiveFrom,
        reason: body.reason,
        applyToAll: body.applyToAll,
        notifyProviders: body.notifyProviders,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-commission-rates"] });
      setGlobalModal(false);
      setGlobalRateInput("");
      setGlobalEffectiveFrom(new Date().toISOString().slice(0, 10));
      setGlobalReason("");
      setGlobalNotifyProviders(false);
      setGlobalApplyToAll(false);
      setGlobalConfirmText("");
    },
  });



  const deleteMut = useMutation({
    mutationFn: (country: string) => listingApi.delete(`/admin/commission-rates/${country}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-commission-rates"] });
      setDeleteConfirm(null);
    },
  });

  const columns: Column<CommissionRate>[] = [
    {
      key: "country",
      label: "Country",
      render: (r) => {
        const found = SYSTEM_COUNTRIES.find((sc) => sc.code.toUpperCase() === r.country.toUpperCase());
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">{found?.flag ?? "🌐"}</span>
            <span className="font-medium text-slate-900">
              {found ? `${found.name} (${r.country})` : r.country}
            </span>
          </div>
        );
      },
    },
    {
      key: "rate",
      label: "Commission Rate",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-bold text-primary tabular">{r.rate}%</span>
          {r.rate < defaultRate && (
            <Badge label="Below Default" />
          )}
          {r.rate > defaultRate && (
            <Badge label="Above Default" status="suspended" />
          )}
        </div>
      ),
    },
    {
      key: "setBy",
      label: "Set By",
      render: (r) => <span className="text-sm text-slate-600">{r.setBy}</span>,
    },
    {
      key: "updated",
      label: "Last Updated",
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        canManageCommission ? (
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(r); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
            title="Remove override"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <SectionHeader
        title="Commission Rates"
        description="Configure platform commission per country"
        action={
          canManageCommission && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddModal(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Override
            </Button>
          )
        }
      />

      {/* Default rate card */}
      <Card className="flex items-center justify-between gap-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 flex-shrink-0">
            <Percent className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Global Default Rate</p>
            <p className="text-3xl font-bold text-primary">{defaultRate}%</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Applied to all countries without a custom override · {filteredRates.length} override{filteredRates.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        {canManageCommission && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setGlobalRateInput(String(defaultRate));
              setGlobalModal(true);
            }}
          >
            Edit Global Rate
          </Button>
        )}
      </Card>

      {/* Country overrides table */}
      <Card padding="none">
        <div className="p-5 border-b border-border">
          <CardHeader
            title="Country Overrides"
            description="These rates take precedence over the global default"
          />
        </div>
        <DataTable
          columns={columns}
          data={filteredRates}
          loading={isLoading}
          emptyTitle="No overrides configured"
          emptyDescription="All countries use the global default rate."
          emptyIcon={<Globe className="h-10 w-10" />}
        />
      </Card>

      {/* Add override modal */}
      <ActionModal
        open={addModal}
        onClose={() => {
          setAddModal(false);
          setNewCountry("");
          setNewRate("");
          setNewEffectiveFrom(new Date().toISOString().slice(0, 10));
          setNewNotifyProviders(false);
          setNewReason("");
        }}
        title="Add/Update Country Override"
        description="Set a custom commission rate for a specific country."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={upsertMut.isPending}
              onClick={() =>
                upsertMut.mutate({
                  country: newCountry,
                  rate: parseFloat(newRate),
                  effectiveFrom: newEffectiveFrom,
                  notifyProviders: newNotifyProviders,
                  reason: newReason,
                })
              }
              disabled={!newCountry || !newRate || isNaN(parseFloat(newRate)) || !newEffectiveFrom || !newReason.trim()}
            >
              Save Rate
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <CustomDropdown
            id="country"
            label="Country"
            value={newCountry}
            onChange={(val: any) => setNewCountry(val)}
            options={COUNTRY_OPTIONS}
            placeholder="Select country…"
            required
          />
          <Input
            id="rate"
            label="Commission Rate (%)"
            type="number"
            min="0"
            max="50"
            step="0.01"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            placeholder="e.g. 12.5"
            hint={`Default is ${defaultRate}%. Enter the override value (max 50%).`}
            required
          />
          <Input
            id="effectiveFrom"
            label="Effective From"
            type="date"
            required
            value={newEffectiveFrom}
            onChange={(e) => setNewEffectiveFrom(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
          />
          <div className="flex items-center gap-2 py-1">
            <input
              id="notifyProviders"
              type="checkbox"
              checked={newNotifyProviders}
              onChange={(e) => setNewNotifyProviders(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/25"
            />
            <label htmlFor="notifyProviders" className="text-sm font-medium text-slate-700 select-none">
              Notify Providers in this country
            </label>
          </div>
          <Textarea
            id="reason"
            label="Change Reason"
            required
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Explain the business reason for this rate change..."
            rows={2}
          />
        </div>
      </ActionModal>

      {/* Edit Global Commission Modal */} 
      <ActionModal
        open={globalModal}
        onClose={() => {
          setGlobalModal(false);
          setGlobalRateInput("");
          setGlobalEffectiveFrom(new Date().toISOString().slice(0, 10));
          setGlobalReason("");
          setGlobalNotifyProviders(false);
          setGlobalApplyToAll(false);
          setGlobalConfirmText("");
        }}
        title="Edit Global Default Commission Rate"
        description="Set or schedule a new platform-wide default commission rate. This will apply to all countries without custom overrides."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setGlobalModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateGlobalMut.isPending}
              onClick={() =>
                updateGlobalMut.mutate({
                  rate: parseFloat(globalRateInput),
                  effectiveFrom: globalEffectiveFrom,
                  reason: globalReason,
                  applyToAll: globalApplyToAll,
                  notifyProviders: globalNotifyProviders,
                })
              }
              disabled={
                !globalRateInput ||
                isNaN(parseFloat(globalRateInput)) ||
                parseFloat(globalRateInput) < 0 ||
                parseFloat(globalRateInput) > 50 ||
                !globalEffectiveFrom ||
                !globalReason.trim() ||
                globalConfirmText !== "CONFIRM"
              }
            >
              Update Global Rate
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            id="globalRate"
            label="New Global Rate (%)"
            type="number"
            min="0"
            max="50"
            step="0.01"
            value={globalRateInput}
            onChange={(e) => setGlobalRateInput(e.target.value)}
            placeholder="e.g. 5.0"
            hint={`Current default is ${defaultRate}%. (Max 50.0%)`}
            required
          />
          <Input
            id="globalEffectiveFrom"
            label="Effective From"
            type="date"
            required
            value={globalEffectiveFrom}
            onChange={(e) => setGlobalEffectiveFrom(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
          />
          
          <div className="flex items-center gap-2 py-1">
            <input
              id="globalApplyToAll"
              type="checkbox"
              checked={globalApplyToAll}
              onChange={(e) => setGlobalApplyToAll(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/25"
            />
            <label htmlFor="globalApplyToAll" className="text-sm font-medium text-slate-700 select-none">
              Apply to All Countries (Replace existing overrides)
            </label>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              id="globalNotifyProviders"
              type="checkbox"
              checked={globalNotifyProviders}
              onChange={(e) => setGlobalNotifyProviders(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/25"
            />
            <label htmlFor="globalNotifyProviders" className="text-sm font-medium text-slate-700 select-none">
              Notify all active Providers via Email
            </label>
          </div>

          <Textarea
            id="globalReason"
            label="Change Reason"
            required
            value={globalReason}
            onChange={(e) => setGlobalReason(e.target.value)}
            placeholder="Explain the business reason for adjusting the default rate..."
            hint="Logged to audit trail."
            rows={2}
          />

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800">Verification Required</p>
            <p className="text-xs text-amber-700">
              This action affects the platform-wide commission rate. Please type <strong>CONFIRM</strong> in uppercase to enable saving.
            </p>
            <Input
              id="globalConfirm"
              type="text"
              placeholder="CONFIRM"
              value={globalConfirmText}
              onChange={(e) => setGlobalConfirmText(e.target.value)}
              className="bg-white border-amber-300 focus:border-amber-500 focus:ring-amber-500/25"
            />
          </div>
        </div>
      </ActionModal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMut.mutate(deleteConfirm.country)}
        loading={deleteMut.isPending}
        title="Remove commission override"
        description={`Remove the custom rate for ${deleteConfirm?.country}? It will revert to the global default of ${defaultRate}%.`}
        variant="warning"
        confirmLabel="Remove Override"
      />
    </div>
  );
}