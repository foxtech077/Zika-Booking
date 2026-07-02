"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronDown, ChevronUp, Download } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { formatDateTime, formatRelativeTime, slugToLabel } from "@/lib/utils";
import type { AuditLog } from "@/types/admin";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";
import { AccessDenied } from "@/components/ui/AccessDenied";

const fetchAudit = (params: Record<string, string>) =>
  api.get(`/admin/audit-logs?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

function DiffViewer({ oldVal, newVal }: { oldVal: string | null; newVal: string | null }) {
  let oldObj: any, newObj: any;
  try { oldObj = oldVal ? JSON.parse(oldVal) : null; } catch { oldObj = oldVal; }
  try { newObj = newVal ? JSON.parse(newVal) : null; } catch { newObj = newVal; }

  if (!oldObj && !newObj) return null;

  if (typeof oldObj !== "object" || typeof newObj !== "object") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-danger/5 rounded-lg p-3 text-xs font-mono text-danger-dark">
          <p className="font-semibold mb-1 text-danger">Before</p>
          <p>{oldVal ?? "—"}</p>
        </div>
        <div className="bg-success/5 rounded-lg p-3 text-xs font-mono text-success-dark">
          <p className="font-semibold mb-1 text-success">After</p>
          <p>{newVal ?? "—"}</p>
        </div>
      </div>
    );
  }

  const keys = Array.from(new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]));
  return (
    <div className="space-y-1.5">
      {keys.map((key) => {
        const ov = JSON.stringify(oldObj?.[key]);
        const nv = JSON.stringify(newObj?.[key]);
        const changed = ov !== nv;
        return (
          <div key={key} className={`flex gap-2 text-xs p-2 rounded-lg ${changed ? "bg-amber-50 border border-amber-100" : "bg-slate-50"}`}>
            <span className="text-slate-500 w-24 flex-shrink-0 font-medium">{key}</span>
            <div className="flex-1 font-mono">
              {changed ? (
                <>
                  <span className="text-danger-dark line-through">{ov}</span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span className="text-success-dark">{nv}</span>
                </>
              ) : (
                <span className="text-slate-600">{nv}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AuditPage() {
  const { user, _hasHydrated } = useAuthStore();

  if (_hasHydrated && !canAccess(user?.role as any, "view_audit")) {
    return <AccessDenied />;
  }

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const params = {
    ...(q ? { q } : {}),
    ...(role ? { role } : {}),
    ...(action ? { action } : {}),
    ...(startDate ? { from: `${startDate}T00:00:00.000Z` } : {}),
    ...(endDate ? { to: `${endDate}T23:59:59.999Z` } : {}),
    page: String(page),
    limit: String(limit)
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", params],
    queryFn: () => fetchAudit(params),
  });

  const logs: AuditLog[] = data?.logs ?? [];
  const total: number = data?.total ?? 0;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportParams = {
        ...(q ? { q } : {}),
        ...(role ? { role } : {}),
        ...(action ? { action } : {}),
        ...(startDate ? { from: `${startDate}T00:00:00.000Z` } : {}),
        ...(endDate ? { to: `${endDate}T23:59:59.999Z` } : {}),
        limit: "100000",
        page: "1"
      };

      const res = await fetchAudit(exportParams);
      const allLogs: AuditLog[] = res?.logs ?? [];

      if (allLogs.length === 0) {
        alert("No logs to export.");
        return;
      }

      const CSV_HEADERS = [
        "ID",
        "Timestamp",
        "Admin ID",
        "Admin Name",
        "Admin Email",
        "Role",
        "Action",
        "Target Type",
        "Target ID",
        "Old Value",
        "New Value",
        "IP Address"
      ];

      function escapeCsv(val: any): string {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }

      const rows = allLogs.map((l) => [
        l.id,
        l.timestamp,
        l.adminId,
        l.adminName ?? "",
        l.adminEmail ?? "",
        l.role,
        l.action,
        l.targetType ?? "",
        l.targetId ?? "",
        l.oldValue ?? "",
        l.newValue ?? "",
        l.ipAddress
      ].map(escapeCsv).join(","));

      const csvContent = [CSV_HEADERS.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export logs.");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Column<AuditLog>[] = [
    {
      key: "action",
      label: "Action",
      width: "200px",
      render: (l) => (
        <div>
          <p className="font-medium text-sm text-slate-900">{slugToLabel(l.action)}</p>
          {l.targetType && (
            <p className="text-xs text-slate-500 capitalize">{slugToLabel(l.targetType)}</p>
          )}
        </div>
      ),
    },
    {
      key: "admin",
      label: "Admin",
      render: (l) => (
        <div title={`User ID: ${l.adminId}`}>
          <p className="text-sm text-slate-900 font-medium">{l.adminName ?? "—"}</p>
          {l.adminEmail && <p className="text-xs text-slate-500">{l.adminEmail}</p>}
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{l.adminId.slice(0, 12) + "…"}</p>
          <Badge label={l.role} status={l.role} size="sm" className="mt-1" />
        </div>
      ),
    },
    {
      key: "target",
      label: "Target",
      render: (l) => (
        <span className="font-mono text-xs text-slate-500">
          {l.targetId?.slice(0, 12) ?? "—"}
        </span>
      ),
    },
    {
      key: "ip",
      label: "IP Address",
      render: (l) => (
        <span className="font-mono text-xs text-slate-500">{l.ipAddress}</span>
      ),
    },
    {
      key: "changed",
      label: "Has Changes",
      render: (l) => (
        l.oldValue || l.newValue ? (
          <Badge label="Yes" status="active" />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )
      ),
    },
    {
      key: "timestamp",
      label: "Timestamp",
      render: (l) => (
        <div>
          <p className="text-xs text-slate-700">{formatDateTime(l.timestamp)}</p>
          <p className="text-xs text-slate-400">{formatRelativeTime(l.timestamp)}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Audit Trail"
        description={`${total.toLocaleString()} recorded actions`}
      />

      <Card padding="none">
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search action…"
          filters={[
            {
              key: "role",
              label: "All Roles",
              value: role,
              onChange: (v) => { setRole(v); setPage(1); },
              options: [
                { value: "super_admin", label: "Super Admin" },
                { value: "admin", label: "Admin" },
                { value: "country_manager", label: "Country Manager" },
                { value: "sales", label: "Sales" },
                { value: "support", label: "Support" },
                { value: "finance", label: "Finance" },
              ],
            },
          ]}
          actions={
            user?.role === "super_admin" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                leftIcon={<Download className="h-4 w-4" />}
                loading={isExporting}
              >
                Export CSV
              </Button>
            )
          }
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        >
          <div className="flex items-center gap-2">
            <DatePicker
              placeholder="From Date"
              value={startDate}
              onChange={(val) => { setStartDate(val); setPage(1); }}
              className="w-40"
            />
            <span className="text-xs text-slate-400">to</span>
            <DatePicker
              placeholder="To Date"
              value={endDate}
              onChange={(val) => { setEndDate(val); setPage(1); }}
              minDate={startDate || undefined}
              className="w-40"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                Clear Dates
              </button>
            )}
          </div>
        </FilterBar>
        <DataTable
          columns={columns}
          data={logs}
          loading={isLoading}
          onRowClick={(l) => setSelected(l)}
          emptyTitle="No audit entries found"
          emptyIcon={<ClipboardList className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Audit detail drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? slugToLabel(selected.action) : "Audit Entry"}
        description={selected ? formatDateTime(selected.timestamp) : ""}
        width="md"
      >
        {selected && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["User ID", selected.adminId],
                ["User Name", selected.adminName ?? "—"],
                ["User Email", selected.adminEmail ?? "—"],
                ["Role", ""],
                ["IP Address", selected.ipAddress],
                ["Target Type", selected.targetType ? slugToLabel(selected.targetType) : "—"],
                ["Target ID", selected.targetId ?? "—"],
                ["Timestamp", formatDateTime(selected.timestamp)],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-slate-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-slate-900 text-sm">
                    {k === "Role" ? <Badge label={selected.role} status={selected.role} /> : String(v)}
                  </dd>
                </div>
              ))}
            </dl>

            {(selected.oldValue || selected.newValue) && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Changes</p>
                <DiffViewer oldVal={selected.oldValue} newVal={selected.newValue} />
              </div>
            )}
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
