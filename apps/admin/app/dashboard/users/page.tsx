"use client";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "pending_verification" | "active" | "suspended" | "banned";
  userType: "traveller" | "provider";
  emailVerified: boolean;
  oauthProvider: string | null;
  currentTier: string;
  createdAt: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

type Action = "suspend" | "ban" | "reinstate";

const STATUS_BADGE: Record<AdminUser["status"], string> = {
  active: "bg-green-100 text-green-700",
  pending_verification: "bg-yellow-100 text-yellow-700",
  suspended: "bg-orange-100 text-orange-700",
  banned: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<AdminUser["status"], string> = {
  active: "Active",
  pending_verification: "Pending",
  suspended: "Suspended",
  banned: "Banned",
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Dialog state
  const [dialog, setDialog] = useState<{ user: AdminUser; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["admin-users", debouncedSearch, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get<{ data: UsersResponse }>(`/admin/users?${params}`);
      return res.data.data;
    },
  });

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    // Debounce: update after 350ms idle
    const id = setTimeout(() => setDebouncedSearch(val), 350);
    return () => clearTimeout(id);
  }, []);

  const actionMutation = useMutation({
    mutationFn: async ({ user, action, reason }: { user: AdminUser; action: Action; reason?: string }) => {
      if (action === "reinstate") {
        await api.patch(`/admin/users/${user.id}/reinstate`);
      } else {
        await api.patch(`/admin/users/${user.id}/${action}`, { reason });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDialog(null);
      setReason("");
      setDialogError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setDialogError(msg ?? "Action failed. Please try again.");
    },
  });

  function openDialog(user: AdminUser, action: Action) {
    setDialog({ user, action });
    setReason("");
    setDialogError(null);
  }

  function closeDialog() {
    setDialog(null);
    setReason("");
    setDialogError(null);
  }

  function confirmAction() {
    if (!dialog) return;
    const { user, action } = dialog;
    if ((action === "suspend" || action === "ban") && !reason.trim()) {
      setDialogError("A reason is required.");
      return;
    }
    actionMutation.mutate({ user, action, reason: reason.trim() || undefined });
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Users</h1>
      <p className="text-sm text-gray-500 mb-6">Manage user accounts — suspend, reinstate, or permanently ban.</p>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_verification">Pending verification</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td>
              </tr>
            ) : !data?.users.length ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">No users found.</td>
              </tr>
            ) : data.users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize">{user.userType}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status]}`}>
                    {STATUS_LABEL[user.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <UserActions user={user} onAction={openDialog} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data?.total ?? 0)} of {data?.total} users
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Action Dialog */}
      {dialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {dialog.action === "suspend" && "Suspend account"}
              {dialog.action === "ban" && "Permanently ban account"}
              {dialog.action === "reinstate" && "Reinstate account"}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {dialog.action === "reinstate"
                ? `Reinstate ${dialog.user.firstName} ${dialog.user.lastName}'s account? They will regain access immediately.`
                : `This will ${dialog.action === "ban" ? "permanently ban" : "suspend"} ${dialog.user.firstName} ${dialog.user.lastName}'s account and revoke all active sessions.`}
            </p>

            {(dialog.action === "suspend" || dialog.action === "ban") && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  rows={3}
                  placeholder="Explain why this action is being taken…"
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setDialogError(null); }}
                />
              </div>
            )}

            {dialogError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{dialogError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDialog}
                disabled={actionMutation.isPending}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={actionMutation.isPending}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition disabled:opacity-50 ${
                  dialog.action === "ban" ? "bg-red-600 hover:bg-red-700" :
                  dialog.action === "suspend" ? "bg-orange-500 hover:bg-orange-600" :
                  "bg-primary hover:bg-primary-dark"
                }`}
              >
                {actionMutation.isPending ? "Processing…" : (
                  dialog.action === "suspend" ? "Suspend" :
                  dialog.action === "ban" ? "Permanently Ban" :
                  "Reinstate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserActions({ user, onAction }: { user: AdminUser; onAction: (u: AdminUser, a: Action) => void }) {
  if (user.status === "banned") {
    return <span className="text-xs text-gray-400">No actions available</span>;
  }
  if (user.status === "suspended") {
    return (
      <button
        onClick={() => onAction(user, "reinstate")}
        className="text-xs font-medium text-green-600 hover:text-green-700 mr-3"
      >
        Reinstate
      </button>
    );
  }
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onAction(user, "suspend")}
        className="text-xs font-medium text-orange-600 hover:text-orange-700"
      >
        Suspend
      </button>
      <button
        onClick={() => onAction(user, "ban")}
        className="text-xs font-medium text-red-600 hover:text-red-700"
      >
        Ban
      </button>
    </div>
  );
}
