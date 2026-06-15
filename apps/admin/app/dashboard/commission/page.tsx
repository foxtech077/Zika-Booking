"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Percent, Plus, Trash2, Globe } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal, ActionModal } from "@/components/modals/Modals";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatDate } from "@/lib/utils";
import type { CommissionRate, CommissionRatesResponse } from "@/types/admin";

const fetchRates = () =>
  listingApi.get("/admin/commission-rates").then((r) => r.data.data ?? r.data);

const COUNTRY_OPTIONS = [
  "MT", "US", "GB", "DE", "FR", "ES", "IT", "AE", "AU", "CA", "JP", "SG", "NL", "BE", "SE",
].map((c) => ({ value: c, label: c }));

export default function CommissionPage() {
  const qc = useQueryClient();
  const [addModal, setAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CommissionRate | null>(null);
  const [newCountry, setNewCountry] = useState("");
  const [newRate, setNewRate] = useState("");

  const { data, isLoading } = useQuery<CommissionRatesResponse>({
    queryKey: ["admin-commission-rates"],
    queryFn: fetchRates,
  });

  const rates: CommissionRate[] = data?.rates ?? [];
  const defaultRate: number = data?.defaultRate ?? 10;

  const upsertMut = useMutation({
    mutationFn: ({ country, rate }: { country: string; rate: number }) =>
      listingApi.post("/admin/commission-rates", { country, rate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-commission-rates"] });
      setAddModal(false);
      setNewCountry("");
      setNewRate("");
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
      render: (r) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-900">{r.country}</span>
        </div>
      ),
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
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(r); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
          title="Remove override"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <SectionHeader
        title="Commission Rates"
        description="Configure platform commission per country"
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Override
          </Button>
        }
      />

      {/* Default rate card */}
      <Card className="flex items-center gap-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 flex-shrink-0">
          <Percent className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">Global Default Rate</p>
          <p className="text-3xl font-bold text-primary">{defaultRate}%</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Applied to all countries without a custom override · {rates.length} override{rates.length !== 1 ? "s" : ""} configured
          </p>
        </div>
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
          data={rates}
          loading={isLoading}
          emptyTitle="No overrides configured"
          emptyDescription="All countries use the global default rate."
          emptyIcon={<Globe className="h-10 w-10" />}
        />
      </Card>

      {/* Add override modal */}
      <ActionModal
        open={addModal}
        onClose={() => { setAddModal(false); setNewCountry(""); setNewRate(""); }}
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
              onClick={() => upsertMut.mutate({ country: newCountry, rate: parseFloat(newRate) })}
              disabled={!newCountry || !newRate || isNaN(parseFloat(newRate))}
            >
              Save Rate
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            id="country"
            label="Country"
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)}
            options={COUNTRY_OPTIONS}
            placeholder="Select country…"
            required
          />
          <Input
            id="rate"
            label="Commission Rate (%)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            placeholder="e.g. 12.5"
            hint={`Default is ${defaultRate}%. Enter the override value.`}
            required
          />
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
