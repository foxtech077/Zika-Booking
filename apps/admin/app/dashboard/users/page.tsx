"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, ShieldOff, ShieldCheck, Ban, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { PlatformUser } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";

const fetchUsers = (params: Record<string, string>) =>
  api.get("/admin/users", { params }).then((r) => r.data.data ?? r.data);

export default function UsersPage() {
  const { user, _hasHydrated } = useAuthStore();
  const isCountryManager = user?.role === "country_manager";
  const scopedCountries = isCountryManager ? (user?.countryScope ?? []) : [];
  const limit = 20;

  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [userType, setUserType] = useState("");
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [confirm, setConfirm] = useState<{ action: "suspend" | "reinstate" | "ban"; user: PlatformUser } | null>(null);
  const [reason, setReason] = useState("");

  const params = { q, status, userType, page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, limit, q, status, userType, scopedCountries.join(",")],
    queryFn: () => fetchUsers(params),
    enabled: _hasHydrated && (!isCountryManager || scopedCountries.length > 0),
  });

  const rawUsers: PlatformUser[] = data?.users ?? [];
  const scopedUsers = scopedCountries.length > 0
    ? rawUsers.filter((u) => u.country && scopedCountries.some((c) => c.toUpperCase() === u.country?.toUpperCase()))
    : rawUsers;
  const users: PlatformUser[] = scopedCountries.length > 0
    ? scopedUsers.slice((page - 1) * limit, page * limit)
    : scopedUsers;
  const total: number = scopedCountries.length > 0 ? scopedUsers.length : (data?.total ?? 0);

  const mutate = useMutation({
    mutationFn: ({ action, id }: { action: string; id: string }) => {
      const needsReason = action === "ban" || action === "suspend";
      return api.patch(`/admin/users/${id}/${action}`, needsReason ? { reason } : undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirm(null);
      setReason("");
    },
  });

  const columns: Column<PlatformUser>[] = [
    {
      key: "user",
      label: "User",
      width: "280px",
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 text-sm truncate">
              {u.firstName} {u.lastName}
            </p>
            <p className="text-xs text-slate-500 truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (u) => <Badge label={u.status} status={u.status} />,
    },
    {
      key: "type",
      label: "Type",
      render: (u) => (
        <span className="text-xs text-slate-600 font-medium capitalize">{u.userType}</span>
      ),
    },
    {
      key: "tier",
      label: "Loyalty",
      render: (u) => (
        <span className="text-xs text-slate-500 capitalize">
          {u.currentTier ?? "—"} · {(u.loyaltyPoints ?? 0).toLocaleString()} pts
        </span>
      ),
    },
    {
      key: "verified",
      label: "Verified",
      render: (u) => (
        <span className={`text-xs font-medium ${u.emailVerified ? "text-success" : "text-slate-400"}`}>
          {u.emailVerified ? "✓ Yes" : "No"}
        </span>
      ),
    },
    {
      key: "joined",
      label: "Joined",
      render: (u) => <span className="text-xs text-slate-500">{formatDate(u.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      width: "120px",
      align: "right",
      render: (u) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelected(u)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            title="View"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {u.status === "active" && (
            <button
              onClick={() => setConfirm({ action: "suspend", user: u })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-warning hover:bg-warning/5 transition-colors"
              title="Suspend"
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </button>
          )}
          {u.status === "suspended" && (
            <button
              onClick={() => setConfirm({ action: "reinstate", user: u })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-success hover:bg-success/5 transition-colors"
              title="Reinstate"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          )}
          {u.status !== "banned" && (
            <button
              onClick={() => setConfirm({ action: "ban", user: u })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
              title="Ban"
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Users"
        description={`${total.toLocaleString()} registered users`}
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="h-4 w-4" />
            <span>Platform Users</span>
          </div>
        }
      />

      <Card padding="none">
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search name or email…"
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "active", label: "Active" },
                { value: "pending_verification", label: "Pending" },
                { value: "suspended", label: "Suspended" },
                { value: "banned", label: "Banned" },
              ],
            },
            {
              key: "userType",
              label: "All Types",
              value: userType,
              onChange: (v) => { setUserType(v); setPage(1); },
              options: [
                { value: "guest", label: "Guest" },
                { value: "provider", label: "Provider" },
              ],
            },
          ]}
        />
        <DataTable
          columns={columns}
          data={users}
          loading={isLoading}
          onRowClick={(u) => setSelected(u)}
          emptyTitle="No users found"
          emptyDescription="Try adjusting your search or filters."
          emptyIcon={<Users className="h-10 w-10" />}
        />
        <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
      </Card>

      {/* User detail drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.firstName} ${selected.lastName}` : ""}
        description={selected?.email}
        width="sm"
        footer={
          selected && (
            <div className="flex gap-2">
              {selected.status === "active" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setConfirm({ action: "suspend", user: selected }); setSelected(null); }}
                  leftIcon={<ShieldOff className="h-3.5 w-3.5" />}
                >
                  Suspend
                </Button>
              )}
              {selected.status === "suspended" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { setConfirm({ action: "reinstate", user: selected }); setSelected(null); }}
                  leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}
                >
                  Reinstate
                </Button>
              )}
              {selected.status !== "banned" && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { setConfirm({ action: "ban", user: selected }); setSelected(null); }}
                  leftIcon={<Ban className="h-3.5 w-3.5" />}
                >
                  Ban
                </Button>
              )}
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Avatar name={`${selected.firstName} ${selected.lastName}`} size="lg" />
              <div>
                <p className="font-semibold text-slate-900">{selected.firstName} {selected.lastName}</p>
                <p className="text-sm text-slate-500">{selected.email}</p>
                <div className="flex gap-2 mt-1.5">
                  <Badge label={selected.status} status={selected.status} />
                  <Badge label={selected.userType} />
                </div>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ["User ID", selected.id],
                ["Email Verified", selected.emailVerified ? "✓ Verified" : "Not verified"],
                ["Loyalty Tier", selected.currentTier],
                ["Loyalty Points", (selected.loyaltyPoints ?? 0).toLocaleString()],
                ["Business", selected.businessName ?? "—"],
                ["Country", selected.country ?? "—"],
                ["Joined", formatDate(selected.createdAt, "MMM d, yyyy")],
                ["Last Updated", formatRelativeTime(selected.updatedAt)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4">
                  <dt className="text-slate-500 flex-shrink-0">{k}</dt>
                  <dd className="text-slate-900 font-medium text-right truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </SlideDrawer>

      {/* Confirm action modal */}
      {(() => {
        const needsReason = confirm?.action === "ban" || confirm?.action === "suspend";
        const canSubmit = !needsReason || reason.trim().length > 0;
        return (
          <ConfirmModal
            open={!!confirm}
            onClose={() => { setConfirm(null); setReason(""); }}
            onConfirm={() => confirm && canSubmit && mutate.mutate({ action: confirm.action, id: confirm.user.id })}
            loading={mutate.isPending}
            title={`${confirm?.action === "ban" ? "Ban" : confirm?.action === "suspend" ? "Suspend" : "Reinstate"} user`}
            description={`Are you sure you want to ${confirm?.action} ${confirm?.user.firstName} ${confirm?.user.lastName}? This action will take effect immediately.`}
            variant={confirm?.action === "ban" ? "danger" : confirm?.action === "suspend" ? "warning" : "info"}
            confirmLabel={confirm?.action === "ban" ? "Ban user" : confirm?.action === "suspend" ? "Suspend" : "Reinstate"}
          >
            {needsReason && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  rows={3}
                  placeholder={confirm?.action === "ban" ? "State reason for permanent ban…" : "State reason for suspension…"}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                />
                {!canSubmit && (
                  <p className="mt-1 text-xs text-danger">A reason is required.</p>
                )}
              </div>
            )}
          </ConfirmModal>
        );
      })()}
    </div>
  );
}
