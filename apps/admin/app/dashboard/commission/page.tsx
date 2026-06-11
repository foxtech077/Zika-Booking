"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Percent, Plus, Trash2, Globe, Calendar, Clock, Check, Info } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal, ActionModal } from "@/components/modals/Modals";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatDate } from "@/lib/utils";
import { useMockFinanceStore, type CommissionRule } from "@/lib/mock-finance-store";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";

const COUNTRY_OPTIONS = [
  { value: "MT", label: "Malta (MT)" },
  { value: "US", label: "United States (US)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "DE", label: "Germany (DE)" },
  { value: "FR", label: "France (FR)" },
  { value: "ES", label: "Spain (ES)" },
  { value: "IT", label: "Italy (IT)" },
  { value: "IN", label: "India (IN)" },
  { value: "CA", label: "Canada (CA)" },
];

export default function CommissionPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { 
    commissionRules, createCommissionRule, updateCommissionRule, 
    deleteCommissionRule, scheduleCommissionRule 
  } = useMockFinanceStore();

  const [mounted, setMounted] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [globalModal, setGlobalModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CommissionRule | null>(null);
  
  // Rule creation forms
  const [newCountry, setNewCountry] = useState("");
  const [newRate, setNewRate] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [globalRateInput, setGlobalRateInput] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Enforce permissions
  const canManage = canAccess(user?.role, "manage_commission");
  const isCountryManager = user?.role === "country_manager";

  // Fetch backend overrides
  const { data: apiData, isLoading: apiLoading } = useQuery({
    queryKey: ["admin-commission-rates"],
    queryFn: () => listingApi.get("/admin/commission-rates").then((r) => r.data.data ?? r.data),
    enabled: mounted,
  });

  // Merge backend values and local mock store rules
  const defaultRate = useMemo(() => {
    const localGlobal = commissionRules.find(r => r.country === "Global");
    return localGlobal ? localGlobal.rate : (apiData?.defaultRate ?? 10);
  }, [commissionRules, apiData]);

  const activeOverrides = useMemo(() => {
    // Return mock overrides if they exist, merged with any backend records
    const localOverrides = commissionRules.filter(r => r.country !== "Global" && !r.isScheduled);
    const backendRates = apiData?.rates ?? [];
    
    const merged: Record<string, CommissionRule> = {};
    // Put backend rates first
    backendRates.forEach((br: any) => {
      merged[br.country] = {
        id: `api-${br.country}`,
        country: br.country,
        rate: br.rate,
        setBy: br.setBy || "API Backend",
        updatedAt: br.updatedAt || new Date().toISOString(),
      };
    });
    // Overlay local overrides
    localOverrides.forEach((lo) => {
      merged[lo.country] = lo;
    });

    // Handle country scoping for country managers
    return Object.values(merged).filter((r) => {
      if (isCountryManager) {
        return user?.countryScope?.includes(r.country);
      }
      return true;
    });
  }, [commissionRules, apiData, isCountryManager, user]);

  const scheduledChanges = useMemo(() => {
    return commissionRules.filter((r) => r.isScheduled && r.effectiveDate).filter((r) => {
      if (isCountryManager) {
        return user?.countryScope?.includes(r.country);
      }
      return true;
    });
  }, [commissionRules, isCountryManager, user]);

  // Operations
  const handleSaveOverride = () => {
    if (!newCountry || !newRate || isNaN(parseFloat(newRate))) return;
    const rateVal = parseFloat(newRate);
    const changer = user?.name || "Admin";

    if (isScheduled) {
      if (!effectiveDate) {
        alert("Please select an effective date for the scheduled rule.");
        return;
      }
      scheduleCommissionRule({
        country: newCountry,
        rate: rateVal,
        setBy: changer,
        effectiveDate,
      });
    } else {
      createCommissionRule({
        country: newCountry,
        rate: rateVal,
        setBy: changer,
      });
      // Try posting to backend API as well if country override
      listingApi.post("/admin/commission-rates", { country: newCountry, rate: rateVal })
        .then(() => qc.invalidateQueries({ queryKey: ["admin-commission-rates"] }))
        .catch((e) => console.log("Backend API not connected: ", e.message));
    }

    setAddModal(false);
    setNewCountry("");
    setNewRate("");
    setIsScheduled(false);
    setEffectiveDate("");
  };

  const handleUpdateGlobal = () => {
    const rateVal = parseFloat(globalRateInput);
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) return;
    
    const globalRule = commissionRules.find(r => r.country === "Global");
    const changer = user?.name || "Admin";

    if (globalRule) {
      updateCommissionRule(globalRule.id, rateVal, changer);
    } else {
      createCommissionRule({
        country: "Global",
        rate: rateVal,
        setBy: changer,
      });
    }
    setGlobalModal(false);
    setGlobalRateInput("");
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    const changer = user?.name || "Admin";
    deleteCommissionRule(deleteConfirm.id, changer);

    // Try calling backend delete if not mock-only rule
    if (!deleteConfirm.id.startsWith("comm-")) {
      listingApi.delete(`/admin/commission-rates/${deleteConfirm.country}`)
        .then(() => qc.invalidateQueries({ queryKey: ["admin-commission-rates"] }))
        .catch((e) => console.log("Backend API error on delete: ", e.message));
    }

    setDeleteConfirm(null);
  };

  const overrideColumns: Column<CommissionRule>[] = [
    {
      key: "country",
      label: "Country Scope",
      render: (r) => (
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Globe className="h-4 w-4 text-slate-400" />
          <span>{r.country}</span>
        </div>
      ),
    },
    {
      key: "rate",
      label: "Commission Override Rate",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary tabular">{r.rate}%</span>
          {r.rate < defaultRate && <Badge label="Discount Rate" status="confirmed" />}
          {r.rate > defaultRate && <Badge label="Premium Rate" status="suspended" />}
        </div>
      ),
    },
    {
      key: "setBy",
      label: "Modified By",
      render: (r) => <span className="text-xs text-slate-600 font-medium">{r.setBy}</span>,
    },
    {
      key: "updated",
      label: "Effective Date",
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(r); }}
          disabled={!canManage}
          className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 disabled:opacity-30 transition-colors"
          title="Remove country override"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  const scheduledColumns: Column<CommissionRule>[] = [
    {
      key: "country",
      label: "Country",
      render: (r) => <span className="font-semibold text-slate-800">{r.country}</span>,
    },
    {
      key: "rate",
      label: "Target Rate",
      render: (r) => <span className="font-bold text-primary">{r.rate}%</span>,
    },
    {
      key: "effective",
      label: "Scheduled Release Date",
      render: (r) => (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(r.effectiveDate || "")}</span>
        </div>
      ),
    },
    {
      key: "setBy",
      label: "Scheduled By",
      render: (r) => <span className="text-xs text-slate-500">{r.setBy}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(r); }}
          disabled={!canManage}
          className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 disabled:opacity-30 transition-colors"
          title="Cancel scheduled change"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  const CM_OPTIONS = useMemo(() => {
    if (isCountryManager) {
      return COUNTRY_OPTIONS.filter((opt) => user?.countryScope?.includes(opt.value));
    }
    return COUNTRY_OPTIONS;
  }, [user, isCountryManager]);

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-screen-2xl">
      <SectionHeader
        title="Commission Settings"
        description="Configure flat global transaction commissions and customize country override schedules."
        action={
          <Button
            variant="primary"
            size="sm"
            disabled={!canManage}
            onClick={() => setAddModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Commission Rule
          </Button>
        }
      />

      {/* Global Default rate card - Hiden from Country Managers */}
      {!isCountryManager ? (
        <Card className="flex items-center justify-between bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 p-5 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 flex-shrink-0 text-primary">
              <Percent className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Global Default Rate</p>
              <p className="text-3xl font-extrabold text-primary tracking-tight mt-0.5">{defaultRate}%</p>
              <p className="text-xs text-slate-500 mt-1">
                Applied to checkout totals in all countries lacking explicit overrides.
              </p>
            </div>
          </div>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setGlobalRateInput(String(defaultRate)); setGlobalModal(true); }}
            >
              Update Global Rate
            </Button>
          )}
        </Card>
      ) : (
        <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl flex items-start gap-2.5">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h6 className="font-semibold text-xs uppercase tracking-wider text-blue-900">Country Manager Workspace Scope</h6>
            <p className="text-xs mt-1 text-blue-700">
              You possess view-only permissions for commission settings. Global platform rule edits are restricted to Super Admin and Finance roles.
            </p>
          </div>
        </div>
      )}

      {/* Overrides Table */}
      <Card padding="none" className="bg-white border border-border">
        <div className="p-5 border-b border-border">
          <CardHeader
            title="Active Country Overrides"
            description="Specific commission percentages which override the standard global platform rate."
          />
        </div>
        <DataTable
          columns={overrideColumns}
          data={activeOverrides}
          loading={apiLoading}
          emptyTitle="No country overrides"
          emptyDescription="All active countries currently utilize the default global flat rate."
          emptyIcon={<Globe className="h-10 w-10 text-slate-300" />}
        />
      </Card>

      {/* Scheduled Changes */}
      <Card padding="none" className="bg-white border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <CardHeader
            title="Scheduled Commission Changes"
            description="Upcoming commission rules that will take effect automatically on their effective dates."
          />
          <Clock className="h-5 w-5 text-amber-500" />
        </div>
        <DataTable
          columns={scheduledColumns}
          data={scheduledChanges}
          loading={false}
          emptyTitle="No scheduled adjustments"
          emptyDescription="There are no future commission rate modifications configured."
          emptyIcon={<Calendar className="h-10 w-10 text-slate-300" />}
        />
      </Card>

      {/* Missing API Documentation */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
        <div className="flex gap-2 items-start">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Missing API Dependencies Documented</p>
            <p className="text-[11px] text-blue-700 mt-0.5 leading-snug">
              Scheduled changes and global default overrides are maintained in client-side local storage. Full production rollout requires adding:
              <code className="bg-blue-100/60 px-1 py-0.5 rounded text-[10px] ml-1 font-mono">
                POST /admin/commission-rules/scheduled
              </code>
              and
              <code className="bg-blue-100/60 px-1 py-0.5 rounded text-[10px] ml-1 font-mono">
                PUT /admin/commission-rules/global-default
              </code>
            </p>
          </div>
        </div>
      </div>

      {/* Create / Edit Rule modal */}
      <ActionModal
        open={addModal}
        onClose={() => { setAddModal(false); setNewCountry(""); setNewRate(""); setIsScheduled(false); setEffectiveDate(""); }}
        title="Create Commission Rule"
        description="Establish custom rate rules for transaction captures."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleSaveOverride}
              disabled={!newCountry || !newRate || (isScheduled && !effectiveDate)}
            >
              Apply Rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            id="override-country"
            label="Target Country Scope"
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)}
            options={CM_OPTIONS}
            placeholder="Select a country..."
            required
          />

          <Input
            id="override-rate"
            label="Commission Percentage (%)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            placeholder="e.g. 12.5"
            required
          />

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="schedule-toggle"
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
              />
              <label htmlFor="schedule-toggle" className="text-xs font-semibold text-slate-700 select-none">
                Schedule for future release? (Effective Date override)
              </label>
            </div>

            {isScheduled && (
              <Input
                id="effective-date"
                label="Effective Date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            )}
          </div>
        </div>
      </ActionModal>

      {/* Global default edit modal */}
      <ActionModal
        open={globalModal}
        onClose={() => setGlobalModal(false)}
        title="Edit Global Default Rate"
        description="Updating the default flat commission. Applied globally unless overridden."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setGlobalModal(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleUpdateGlobal}
              disabled={!globalRateInput}
            >
              Update Default
            </Button>
          </>
        }
      >
        <Input
          id="global-default-input"
          label="Default Platform Rate (%)"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={globalRateInput}
          onChange={(e) => setGlobalRateInput(e.target.value)}
          placeholder="e.g. 10.0"
          required
        />
      </ActionModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Commission Override"
        description={`Confirm removing this commission rule for ${deleteConfirm?.country}? The country will revert back to utilizing the default global transaction rate.`}
        confirmLabel="Remove Rule"
        variant="warning"
      />
    </div>
  );
}
