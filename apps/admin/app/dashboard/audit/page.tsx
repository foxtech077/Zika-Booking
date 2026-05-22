"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { formatDateTime, formatRelativeTime, slugToLabel } from "@/lib/utils";
import type { AuditLog } from "@/types/admin";

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
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const params = { ...(q ? { q } : {}), ...(role ? { role } : {}), ...(action ? { action } : {}), page: String(page), limit: "20" };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", params],
    queryFn: () => fetchAudit(params),
  });

  const logs: AuditLog[] = data?.logs ?? [];
  const total: number = data?.total ?? 0;

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
        <div>
          <p className="text-sm text-slate-700">{l.adminName ?? l.adminId.slice(0, 12) + "…"}</p>
          <Badge label={l.role} status={l.role} size="sm" />
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
        />
        <DataTable
          columns={columns}
          data={logs}
          loading={isLoading}
          onRowClick={(l) => setSelected(l)}
          emptyTitle="No audit entries found"
          emptyIcon={<ClipboardList className="h-10 w-10" />}
        />
        <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
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
                ["Admin ID", selected.adminId.slice(0, 16) + "…"],
                ["Role", ""],
                ["IP Address", selected.ipAddress],
                ["Target Type", selected.targetType ? slugToLabel(selected.targetType) : "—"],
                ["Target ID", selected.targetId ? (selected.targetId.slice(0, 20) + "…") : "—"],
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
