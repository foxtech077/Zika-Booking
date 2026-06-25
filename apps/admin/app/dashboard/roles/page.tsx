"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, UserPlus, Trash2, Pencil, Users2,
  AlertCircle, CheckCircle, Clock, ChevronDown, Search
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, CustomDropdown } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import ReactSelect from "react-select";

// Register English locale for country names
countries.registerLocale(enLocale);
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { ActionModal, ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime, slugToLabel, cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { canAccess, getAllowedRolesToCreate } from "@/permissions/rbac";
import type { AdminRole } from "@/types/admin";
import { useAlert } from "@/hooks/useAlert";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Operator {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  countryScope: string[];
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const fetchOperators = (params: Record<string, string>) =>
  api.get(`/admin/operators?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

const createOperator = (body: any) =>
  api.post("/admin/operators", body).then((r) => r.data.data ?? r.data);

const deleteOperator = (id: string) =>
  api.delete(`/admin/operators/${id}`).then((r) => r.data.data ?? r.data);

const changeRole = ({ id, role, countryScope }: { id: string; role: string; countryScope?: string[] }) =>
  api.patch(`/admin/operators/${id}/role`, { role, countryScope }).then((r) => r.data.data ?? r.data);

// ── Constants ─────────────────────────────────────────────────────────────────

function codeToFlag(code: string) {
  return code.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTRY_OPTIONS = Object.keys(countries.getAlpha2Codes()).map((c) => ({
  value: c,
  label: `${codeToFlag(c)} ${countries.getName(c, "en")} (${c})`,
}));




const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "country_manager", label: "Country Manager" },
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "finance", label: "Finance" },
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "Full platform access including role management and settings.",
  admin: "Full operational access excluding role management.",
  country_manager: "Manages listings and accreditation for assigned countries.",
  sales: "Manages bookings and guest inquiries.",
  support: "Handles user support, bookings, and review moderation.",
  finance: "Access to financial reports, commission, and audit logs.",
};

const PERMISSION_MATRIX = [
  { module: "Dashboard",      super_admin: "✓",    admin: "✓",    country_manager: "✓",    sales: "✓",  support: "✓",  finance: "✓" },
  { module: "Users",          super_admin: "Full", admin: "Full", country_manager: "—",    sales: "—",  support: "View", finance: "—" },
  { module: "Accreditation",  super_admin: "Full", admin: "Full", country_manager: "Full", sales: "—",  support: "—",  finance: "—" },
  { module: "Listings",       super_admin: "Full", admin: "Full", country_manager: "Full", sales: "View", support: "View", finance: "—" },
  { module: "Bookings",       super_admin: "Full", admin: "Full", country_manager: "View", sales: "View", support: "Full", finance: "View" },
  { module: "Finance",        super_admin: "Full", admin: "View", country_manager: "View", sales: "—",  support: "—",  finance: "Full" },
  { module: "Commission",     super_admin: "Full", admin: "Full", country_manager: "—",    sales: "—", support: "—", finance: "Full" },
  { module: "Vouchers",       super_admin: "Full", admin: "Full", country_manager: "—",    sales: "—", support: "—", finance: "—" },
  { module: "Reviews",        super_admin: "Full", admin: "Full", country_manager: "View", sales: "—",  support: "Full", finance: "—" },
  { module: "Messaging",      super_admin: "View", admin: "View", country_manager: "View", sales: "—",  support: "View", finance: "—" },
  { module: "Audit",          super_admin: "✓",    admin: "✓",    country_manager: "—",    sales: "—",  support: "—",  finance: "✓" },
  { module: "Settings",       super_admin: "Full", admin: "View", country_manager: "—",    sales: "—",  support: "—",  finance: "—" },
  { module: "Roles & Admins", super_admin: "Full", admin: "View", country_manager: "—",    sales: "—",  support: "—",  finance: "—" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canManage = canAccess(user?.role, "manage_roles") || user?.role === "admin";
  const { showAlert } = useAlert();

  // Admin's own country scope (for restricting country picker)
  const adminCountries: string[] = user?.countryScope ?? [];
  const isScopedAdmin = user?.role === "admin" && adminCountries.length > 0;

  // List state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<Operator | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Operator | null>(null);

  const allowedRoles = getAllowedRolesToCreate(user?.role);
  const filteredRoleOptions = ROLE_OPTIONS.filter((opt) => allowedRoles.includes(opt.value));

  // Create form
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: (allowedRoles[0] ?? "admin") as AdminRole, countryScope: ""
  });
  const [createCountries, setCreateCountries] = useState<string[]>([]);

  // Edit form
  const [editRole, setEditRole] = useState<AdminRole>((allowedRoles[0] ?? "admin") as AdminRole);
  const [editCountries, setEditCountries] = useState<string[]>([]);

  const params = { q, ...(roleFilter ? { role: roleFilter } : {}), page: String(page), limit: String(limit) };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-operators", params],
    queryFn: () => fetchOperators(params),
  });

  const rawOperators: Operator[] = data?.operators ?? [];
  const operators: Operator[] = rawOperators.filter((op: Operator) => {
    if (user?.role !== "super_admin" && op.role === "super_admin") {
      return false;
    }
    return true;
  });
  const total: number = data?.total ? data.total - (rawOperators.length - operators.length) : operators.length;

  const createMut = useMutation({
    mutationFn: (body: any) => createOperator(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      setCreateModal(false);
      setForm({ name: "", email: "", password: "", role: (allowedRoles[0] ?? "admin") as AdminRole, countryScope: "" });
      setCreateCountries([]);
      showAlert({ type: "success", title: "Admin Created", message: "The new admin account is ready." });
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Create Failed", message: (err as any)?.response?.data?.error?.message ?? "Failed to create admin account." });
    },
  });

  const openCreateModal = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      role: (allowedRoles[0] ?? "admin") as AdminRole,
      countryScope: ""
    });
    setCreateCountries([]);
    setCreateModal(true);
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOperator(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      setDeleteConfirm(null);
      showAlert({ type: "success", title: "Admin Deleted", message: "The admin account has been removed." });
    },
    onError: () => {
      showAlert({ type: "error", title: "Delete Failed", message: "Unable to delete admin account. Please try again." });
    },
  });

  const editMut = useMutation({
    mutationFn: ({ id, role, countryScope }: any) => changeRole({ id, role, countryScope }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-operators"] });
      setEditModal(null);
      showAlert({ type: "success", title: "Role Updated", message: "Admin role has been changed successfully." });
    },
    onError: () => {
      showAlert({ type: "error", title: "Update Failed", message: "Unable to change admin role. Please try again." });
    },
  });

  const openEdit = (op: Operator) => {
    setEditRole(op.role);
    setEditCountries(op.countryScope ?? []);
    setEditModal(op);
  };

  const columns: Column<Operator>[] = [
    {
      key: "operator",
      label: "Admin",
      width: "260px",
      render: (op) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={op.name} size="sm" />
          <div className="min-w-0">
            <p className="font-medium text-sm text-slate-900 truncate">{op.name}</p>
            <p className="text-xs text-slate-500 truncate">{op.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (op) => <Badge label={slugToLabel(op.role)} status={op.role} />,
    },
    {
      key: "scope",
      label: "Country Scope",
      render: (op) => (
        <span className="text-xs text-slate-600">
          {op.countryScope?.length ? op.countryScope.join(", ") : "Global"}
        </span>
      ),
    },
    {
      key: "totp",
      label: "2FA",
      render: (op) => (
        <div className="flex items-center gap-1.5">
          {op.totpEnabled ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <Clock className="h-4 w-4 text-slate-300" />
          )}
          <span className={`text-xs font-medium ${op.totpEnabled ? "text-success-dark" : "text-slate-400"}`}>
            {op.totpEnabled ? "Enabled" : "Pending"}
          </span>
        </div>
      ),
    },
    {
      key: "created",
      label: "Created",
      render: (op) => <span className="text-xs text-slate-500">{formatDate(op.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (op) => (
        op.id === user?.id || op.role === "super_admin" ? (
          <span className="text-xs text-slate-300 px-2">—</span>
        ) : (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canManage && (
              <>
                <button
                  onClick={() => openEdit(op)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                  title="Change role"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(op)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
                  title="Delete admin"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-screen-xl">
      <SectionHeader
        title="Roles & Admins"
        description={`${total} admin account${total !== 1 ? "s" : ""}`}
        action={
          canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Create Admin
            </Button>
          )
        }
      />

      {/* Role overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[{ value: "super_admin" as const, label: "Super Admin" }, ...ROLE_OPTIONS].map((r) => (
          <Card key={r.value} hover className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <Badge label={r.label} status={r.value} size="sm" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">{r.label}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ROLE_DESCRIPTIONS[r.value]}</p>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1 pt-1">
              <Users2 className="h-3 w-3" />
              {operators.filter((op) => op.role === r.value).length} member{operators.filter((op) => op.role === r.value).length !== 1 ? "s" : ""}
            </div>
          </Card>
        ))}
      </div>

      {/* Admin users table */}
      <Card padding="none">
        <div className="p-5 border-b border-border">
          <CardHeader title="Admin Accounts" description="All admin panel users and their roles" />
        </div>
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search name or email…"
          filters={[
            {
              key: "role",
              label: "All Roles",
              value: roleFilter,
              onChange: (v) => { setRoleFilter(v); setPage(1); },
              options: [
                { value: "super_admin", label: "Super Admin" },
                ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label })),
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={operators}
          loading={isLoading}
          emptyTitle="No admin accounts found"
          emptyDescription="Create your first admin account using the button above."
          emptyIcon={<Users2 className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* ── Create Admin Modal ── */}
      <ActionModal
        open={createModal}
        onClose={() => { setCreateModal(false); createMut.reset(); }}
        title="Create Admin Account"
        description="Set up a new admin user. They can log in immediately with these credentials."
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={createMut.isPending}
              leftIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => createMut.mutate({
                name: form.name,
                email: form.email,
                password: form.password,
                role: form.role,
                countryScope: form.role === "country_manager" || form.role === "sales"
                  ? (isScopedAdmin ? createCountries : form.countryScope.split(",").map((s) => s.trim()).filter(Boolean))
                  : [],
              })}
              disabled={!form.name || !form.email || !form.password || form.password.length < 8}
            >
              Create Admin
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createMut.error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger-light border border-danger/20 p-3 text-sm text-danger-dark">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{(createMut.error as any)?.response?.data?.error?.message ?? "Failed to create admin."}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="admin-name"
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Jane Smith"
              required
            />
            <Input
              id="admin-email"
              label="Email Address"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jane@kainook.com"
              required
            />
            <Input
              id="admin-password"
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 8 characters"
              hint={form.password && form.password.length < 8 ? "Too short — min 8 characters" : undefined}
              required
            />
            <CustomDropdown
              id="admin-role"
              label="Role"
              placeholder="Select role..."
              options={filteredRoleOptions}
              value={form.role}
              onChange={(val: any) => setForm((f) => ({ ...f, role: val as AdminRole }))}
            />
          </div>

          {(form.role === "country_manager" || form.role === "sales") && (
            <CustomDropdown
              id="admin-country-scope"
              label="Country Scope"
              placeholder="Select countries..."
              isMulti
              options={COUNTRY_OPTIONS}
              value={createCountries}
              onChange={(val: any) => setCreateCountries(val)}
            />
          )}


          <div className="bg-surface-subtle border border-border rounded-lg p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{slugToLabel(form.role)}:</span>{" "}
            {ROLE_DESCRIPTIONS[form.role]}
          </div>
        </div>
      </ActionModal>

      {/* ── Edit Role Modal ── */}
      <ActionModal
        open={!!editModal}
        onClose={() => { setEditModal(null); editMut.reset(); }}
        title="Change Role"
        description={`Update the role for ${editModal?.name} (${editModal?.email})`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={editMut.isPending}
              onClick={() => editModal && editMut.mutate({
                id: editModal.id,
                role: editRole,
                countryScope: editCountries,
              })}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <CustomDropdown
            id="edit-role"
            label="New Role"
            placeholder="Select role..."
            options={filteredRoleOptions}
            value={editRole}
            onChange={(val: any) => setEditRole(val as AdminRole)}
          />
          {(editRole === "country_manager" || editRole === "sales") && (
            <CustomDropdown
              id="edit-country-scope"
              label="Country Scope"
              placeholder="Select countries..."
              isMulti
              options={COUNTRY_OPTIONS}
              value={editCountries}
              onChange={(val: any) => setEditCountries(val)}
            />
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            ⚠️ Their current session will be revoked and they must sign in again with the new role.
          </div>
          <div className="bg-surface-subtle border border-border rounded-lg p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{slugToLabel(editRole)}:</span>{" "}
            {ROLE_DESCRIPTIONS[editRole]}
          </div>
        </div>
      </ActionModal>

      {/* ── Delete Confirm ── */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
        loading={deleteMut.isPending}
        title="Delete admin account"
        description={`Permanently delete ${deleteConfirm?.name} (${deleteConfirm?.email})? Their sessions will be revoked immediately. This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete Admin"
      />
    </div>
  );
}
