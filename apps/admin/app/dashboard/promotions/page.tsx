"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, ToggleLeft, ToggleRight, Trash2, Edit2, Hotel, Car, Home } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, CustomDropdown, Textarea } from "@/components/ui/Input";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { ActionModal, ConfirmModal } from "@/components/modals/Modals";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { formatDate, formatCurrency, formatDateTime } from "@/lib/utils";
import type { Promotion } from "@/types/admin";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";

countries.registerLocale(enLocale);

function codeToFlag(code: string) {
  if (!code || code.toLowerCase() === "all") return "🌍";
  return code.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

const COUNTRY_OPTIONS = [
  { value: "all", label: "🌍 All Countries" },
  ...Object.keys(countries.getAlpha2Codes()).map((c) => ({
    value: c,
    label: `${codeToFlag(c)} ${countries.getName(c, "en")} (${c})`,
  })),
];

function CategoryIcon({ category }: { category: string }) {
  if (category === "hotel") return <Hotel className="w-4 h-4 text-blue-500" />;
  if (category === "car") return <Car className="w-4 h-4 text-amber-500" />;
  return <Home className="w-4 h-4 text-emerald-500" />;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Cookie Helpers ────────────────────────────────────────────────────────────
function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "; expires=" + date.toUTCString();
  document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
}

// ── Default Seed Data ─────────────────────────────────────────────────────────
const DEFAULT_PROMOTIONS = [
  {
    activity: "hotel",
    labelText: "30% OFF",
    labelColour: "#C84B2F",
    discountType: "percentage",
    discountValue: 30,
    validFrom: "2026-01-01",
    validUntil: "2027-12-31",
    applyToBooking: true,
    bannerTitle: "30% OFF HOTELS",
    bannerSubtitle: "Book your stay now and enjoy this exclusive activity offer!",
    status: "active",
    countryScope: "all"
  },
  {
    activity: "car",
    labelText: "15% OFF",
    labelColour: "#C84B2F",
    discountType: "percentage",
    discountValue: 15,
    validFrom: "2026-07-01",
    validUntil: "2026-08-31",
    applyToBooking: true,
    bannerTitle: "SUMMER CAR DISCOUNT",
    bannerSubtitle: "Drive around the island with 15% off all bookings this summer.",
    status: "scheduled",
    countryScope: "all"
  },
  {
    activity: "apartment",
    labelText: "WIFI",
    labelColour: "#1E3A8A",
    discountType: "label_only",
    discountValue: 0,
    validFrom: "2026-01-01",
    validUntil: "2026-12-31",
    applyToBooking: false,
    bannerTitle: "FREE HIGH-SPEED WIFI",
    bannerSubtitle: "Get complimentary ultra-fast internet on all direct apartment bookings.",
    status: "paused",
    countryScope: "MT"
  }
];

export default function PromotionsPage() {
  const qc = useQueryClient();
  const { user, token, _hasHydrated } = useAuthStore();
  const role = user?.role;
  const hasManagePermission = canAccess(role, "manage_promotions");

  const todayYMD = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusTab, setStatusTab] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Promotion | null>(null);
  const [selected, setSelected] = useState<Promotion | null>(null);

  // Form State
  const [form, setForm] = useState({
    id: "",
    activity: "hotel" as "hotel" | "apartment" | "car",
    labelText: "",
    labelColour: "#C84B2F",
    discountType: "percentage" as "percentage" | "fixed" | "label_only",
    discountValue: "",
    validFrom: "",
    validUntil: "",
    applyToBooking: true,
    bannerTitle: "",
    bannerSubtitle: "",
    status: "active" as Promotion["status"],
    countryScope: "all",
  });

  const [formError, setFormError] = useState("");

  // Fetch Promotions list from Backend API
  const { data, isLoading } = useQuery({
    queryKey: ["admin-promotions", page, limit, statusTab, categoryFilter, countryFilter],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        limit,
        status: statusTab === "all" ? undefined : statusTab,
        activity: categoryFilter === "" ? undefined : categoryFilter
      };

      const res = await listingApi.get("/admin/promotions", { params });
      const body = res.data?.data ?? res.data;
      const promotions = body?.promotions ?? [];
      const total = body?.pagination?.total ?? promotions.length;

      // Sync active promotions to the cookie
      const activePromos = promotions.filter((p: any) => p.status === "active");
      setCookie("zika_promotions", JSON.stringify(activePromos), 7);

      return { promotions, total };
    },
    enabled: !!token && _hasHydrated
  });

  const promotionsList: Promotion[] = data?.promotions ?? [];
  const total = data?.total ?? 0;

  // Mutations
  const createMut = useMutation({
    mutationFn: (body: any) => listingApi.post("/admin/promotions", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promotions"] });
      setAddModal(false);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.error?.message ?? err?.message ?? "Failed to create campaign");
    }
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      listingApi.patch(`/admin/promotions/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promotions"] });
      setEditModal(false);
      // Close detail drawer if updated
      setSelected(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.error?.message ?? err?.message ?? "Failed to update campaign");
    }
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => listingApi.delete(`/admin/promotions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promotions"] });
      setDeleteConfirm(null);
      setSelected(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message ?? err?.message ?? "Failed to delete campaign");
    }
  });



  // Form actions
  const openCreate = () => {
    setForm({
      id: "",
      activity: "hotel",
      labelText: "",
      labelColour: "#C84B2F",
      discountType: "percentage",
      discountValue: "",
      validFrom: "",
      validUntil: "",
      applyToBooking: true,
      bannerTitle: "",
      bannerSubtitle: "",
      status: "active",
      countryScope: "all",
    });
    setFormError("");
    setAddModal(true);
  };

  const openEdit = (p: Promotion, e: React.MouseEvent) => {
    e.stopPropagation();
    // Parse ISO dates back to YYYY-MM-DDTHH:mm local time
    const parseDateTimeLocal = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const min = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    };

    setForm({
      id: p.id,
      activity: p.activity,
      labelText: p.labelText,
      labelColour: p.labelColour || "#C84B2F",
      discountType: p.discountType,
      discountValue: String(p.discountValue || ""),
      validFrom: parseDateTimeLocal(p.validFrom),
      validUntil: parseDateTimeLocal(p.validUntil),
      applyToBooking: p.applyToBooking,
      bannerTitle: p.bannerTitle,
      bannerSubtitle: p.bannerSubtitle || "",
      status: p.status,
      countryScope: p.countryScope || "all",
    });
    setFormError("");
    setEditModal(true);
  };

  const validateForm = () => {
    if (!form.labelText || form.labelText.length > 6) {
      setFormError("Label Text is required and must not exceed 6 characters.");
      return false;
    }
    if (!form.bannerTitle || !form.bannerSubtitle) {
      setFormError("Banner Title and Subtitle are required.");
      return false;
    }
    if (!form.validFrom || !form.validUntil) {
      setFormError("Validity dates are required.");
      return false;
    }
    if (new Date(form.validUntil).getTime() <= new Date(form.validFrom).getTime()) {
      setFormError("Valid Until date must be after Valid From date.");
      return false;
    }
    if (form.discountType !== "label_only" && (!form.discountValue || parseFloat(form.discountValue) <= 0)) {
      setFormError("Discount Value must be greater than 0 unless 'Label Only' is selected.");
      return false;
    }
    return true;
  };

  const handleSave = (isEdit: boolean) => {
    if (!validateForm()) return;

    const payload = {
      activity: form.activity,
      labelText: form.labelText.toUpperCase(),
      labelColour: form.labelColour,
      discountType: form.discountType,
      discountValue: form.discountType === "label_only" ? null : parseFloat(form.discountValue),
      validFrom: new Date(form.validFrom).toISOString(),
      validUntil: new Date(form.validUntil).toISOString(),
      applyToBooking: form.discountType === "label_only" ? false : form.applyToBooking,
      bannerTitle: form.bannerTitle,
      bannerSubtitle: form.bannerSubtitle || null,
      status: form.status,
      countryScope: form.countryScope === "all" ? null : form.countryScope
    };

    if (isEdit) {
      updateMut.mutate({ id: form.id, body: payload });
    } else {
      // POST schema validation: status must be "active" or "scheduled" when creating
      const createPayload = {
        ...payload,
        status: form.status === "active" ? "active" : "scheduled"
      };
      createMut.mutate(createPayload);
    }
  };

  const toggleStatus = (p: Promotion, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasManagePermission) return;

    const nextStatusMap: Record<Promotion["status"], Promotion["status"]> = {
      active: "paused",
      paused: "active",
      scheduled: "active",
      expired: "active",
      superseded: "active",
    };

    const targetStatus = nextStatusMap[p.status] || "active";
    updateMut.mutate({ id: p.id, body: { status: targetStatus } });
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteMut.mutate(deleteConfirm.id);
  };

  // Columns definition
  const columns: Column<Promotion>[] = [
    {
      key: "activity",
      label: "Category",
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
            <CategoryIcon category={p.activity} />
          </div>
          <span className="text-sm font-semibold capitalize text-slate-800">{p.activity}s</span>
        </div>
      ),
    },
    {
      key: "labelText",
      label: "Card Badge Preview",
      render: (p) => (
        <div className="flex items-center">
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: p.labelColour || "#C84B2F" }}
          >
            {p.labelText}
          </span>
        </div>
      ),
    },
    {
      key: "discount",
      label: "Discount Type",
      render: (p) => (
        <div>
          <p className="text-sm font-medium text-slate-800">
            {p.discountType === "percentage" && `${p.discountValue}% Off`}
            {p.discountType === "fixed" && `${formatCurrency(p.discountValue ?? 0, "USD")} Off`}
            {p.discountType === "label_only" && "Label Only (No Checkout Discount)"}
          </p>
          {p.applyToBooking && p.discountType !== "label_only" && (
            <p className="text-[10px] text-emerald-600 font-medium">Applies at Checkout</p>
          )}
        </div>
      ),
    },
    {
      key: "bannerTitle",
      label: "Banner Title / Subtitle",
      render: (p) => (
        <div className="max-w-[280px]">
          <p className="text-sm font-semibold text-slate-800 truncate">{p.bannerTitle}</p>
          <p className="text-xs text-slate-500 truncate">{p.bannerSubtitle}</p>
        </div>
      ),
    },
    {
      key: "validity",
      label: "Validity Dates",
      render: (p) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <p><span className="text-slate-400">From:</span> {formatDateTime(p.validFrom)}</p>
          <p><span className="text-slate-400">Until:</span> {formatDateTime(p.validUntil)}</p>
        </div>
      ),
    },
    {
      key: "countryScope",
      label: "Country Scope",
      render: (p) => {
        if (!p.countryScope || p.countryScope === "all") return <span className="text-sm text-slate-600">🌍 All Countries</span>;
        const countryName = countries.getName(p.countryScope, "en");
        return (
          <span className="text-sm text-slate-600 flex items-center gap-1.5">
            <span>{codeToFlag(p.countryScope)}</span>
            <span>{countryName ? `${countryName} (${p.countryScope.toUpperCase()})` : p.countryScope.toUpperCase()}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (p) => <Badge label={p.status} status={p.status} />,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {hasManagePermission && (
            <>
              <button
                onClick={(e) => toggleStatus(p, e)}
                className={`p-1.5 rounded-lg transition-colors ${p.status === "active" ? "text-success hover:bg-success/5" : "text-slate-400 hover:bg-slate-100"
                  }`}
                title={p.status === "active" ? "Pause Promotion" : "Activate Promotion"}
              >
                {p.status === "active" ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <button
                onClick={(e) => openEdit(p, e)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors"
                title="Edit Configuration"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(p);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
                title="Delete Promotion"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Activity Promotions"
        description="Configure permanent category-specific discount banners and listing badges. Red banners take priority over vouchers."
        action={
          hasManagePermission && (
            <Button
              variant="primary"
              size="sm"
              onClick={openCreate}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Promotion
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-xl border">
        {["all", "active", "scheduled", "paused", "expired", "superseded"].map((status) => (
          <button
            key={status}
            onClick={() => {
              setStatusTab(status);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-all cursor-pointer ${statusTab === status
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            {status}
          </button>
        ))}
      </div>

      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "category",
              label: "All Categories",
              value: categoryFilter,
              onChange: (v) => {
                setCategoryFilter(v);
                setPage(1);
              },
              options: [
                { value: "hotel", label: "Hotels" },
                { value: "apartment", label: "Apartments" },
                { value: "car", label: "Cars" },
              ],
            },
            {
              key: "country",
              label: "All Countries",
              value: countryFilter,
              onChange: (v) => {
                setCountryFilter(v);
                setPage(1);
              },
              options: COUNTRY_OPTIONS,
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => {
            setLimit(newL);
            setPage(1);
          }}
        />
        <DataTable
          columns={columns}
          data={promotionsList}
          loading={isLoading}
          onRowClick={(p) => setSelected(p)}
          emptyTitle="No promotions configured"
          emptyDescription="Configure a category promotion campaign to display badges and active banners to guests."
          emptyIcon={<Tag className="h-10 w-10 text-slate-300" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Details Slide Drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Promotion Details`}
        description="Configuration and validity information"
        width="md"
      >
        {selected && (
          <div className="space-y-6">
            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Appearance Preview</h3>
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-semibold uppercase">Listing Card Badge</p>
                <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-slate-700">Listing Card Title</span>
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: selected.labelColour || "#C84B2F" }}
                  >
                    {selected.labelText}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <p className="text-xs text-slate-500 font-semibold uppercase">Permanent Category Banner</p>
                <div className="p-4 rounded-xl text-white shadow-md space-y-1" style={{ backgroundColor: "#C84B2F" }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded tracking-wide uppercase">
                      {selected.labelText} OFF {selected.activity}s
                    </span>
                    <span className="text-[10px] text-white/80 font-medium">Permanent Banner</span>
                  </div>
                  <h4 className="font-bold text-base leading-tight mt-1">{selected.bannerTitle}</h4>
                  <p className="text-xs text-white/90">{selected.bannerSubtitle}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Campaign Settings</h3>
              <InfoRow label="Activity Category" value={<span className="capitalize">{selected.activity}s</span>} />
              <InfoRow label="Country Scope" value={
                selected.countryScope === "all" || !selected.countryScope ? "🌍 All Countries" : `${codeToFlag(selected.countryScope)} ${countries.getName(selected.countryScope, "en")}`
              } />
              <InfoRow label="Discount Type" value={<span className="capitalize">{selected.discountType.replace("_", " ")}</span>} />
              <InfoRow label="Discount Value" value={
                selected.discountType === "percentage"
                  ? `${selected.discountValue}%`
                  : selected.discountType === "fixed"
                    ? formatCurrency(selected.discountValue ?? 0, "USD")
                    : "—"
              } />
              <InfoRow label="Apply at Checkout" value={selected.applyToBooking ? "Yes (Auto-Applied)" : "No (Label Only)"} />
              <InfoRow label="Status" value={<Badge label={selected.status} status={selected.status} />} />
            </div>

            <div className="bg-slate-50/60 rounded-xl p-5 border border-slate-100 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Validity & Audit</h3>
              <InfoRow label="Valid From" value={formatDateTime(selected.validFrom)} />
              <InfoRow label="Valid Until" value={formatDateTime(selected.validUntil)} />
              <InfoRow label="Created At" value={formatDate(selected.createdAt)} />
              <InfoRow label="Created By" value={selected.createdBy || "System"} />
            </div>
          </div>
        )}
      </SlideDrawer>

      {/* Create / Edit Promotion Modal */}
      <ActionModal
        open={addModal || editModal}
        onClose={() => {
          setAddModal(false);
          setEditModal(false);
        }}
        title={editModal ? "Edit Promotion" : "Create Activity Promotion"}
        description="Activity promotions display a permanent red banner and badge to guests browsing the selected category."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAddModal(false);
                setEditModal(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={createMut.isPending || updateMut.isPending}
              onClick={() => handleSave(editModal)}
            >
              {editModal ? "Save Changes" : "Create Campaign"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-danger-light text-danger-dark p-3 rounded-lg text-xs font-semibold">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <CustomDropdown
              id="promo-activity"
              label="Activity Category"
              options={[
                { value: "hotel", label: "Hotels" },
                { value: "apartment", label: "Apartments" },
                { value: "car", label: "Cars" },
              ]}
              value={form.activity}
              onChange={(val) => setForm((f) => ({ ...f, activity: val as any }))}
              disabled={editModal} // category cannot be changed after creation
            />

            <CustomDropdown
              id="promo-country"
              label="Country Scope"
              options={COUNTRY_OPTIONS}
              value={form.countryScope}
              onChange={(val) => setForm((f) => ({ ...f, countryScope: val as string }))}
            />

            <div className="col-span-2 grid grid-cols-2 gap-4 border border-slate-100 p-3 rounded-xl bg-slate-50/50">
              <Input
                id="promo-label-text"
                label="Label Text (max 6 chars)"
                placeholder="30% OFF"
                maxLength={6}
                value={form.labelText}
                onChange={(e) => setForm((f) => ({ ...f, labelText: e.target.value }))}
                required
              />
              <Input
                id="promo-label-colour"
                label="Badge background color (HEX)"
                placeholder="#C84B2F"
                value={form.labelColour}
                onChange={(e) => setForm((f) => ({ ...f, labelColour: e.target.value }))}
                type="color"
                className="h-[38px] px-1 py-1"
              />
            </div>

            <CustomDropdown
              id="promo-discount-type"
              label="Discount Type"
              options={[
                { value: "percentage", label: "Percentage (%)" },
                { value: "fixed", label: "Fixed Amount (USD)" },
                { value: "label_only", label: "Label Only (Informational)" },
              ]}
              value={form.discountType}
              onChange={(val) => setForm((f) => ({ ...f, discountType: val as any }))}
            />

            <Input
              id="promo-discount-value"
              label="Discount Value"
              type="number"
              placeholder="e.g. 30"
              disabled={form.discountType === "label_only"}
              value={form.discountType === "label_only" ? "0" : form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              required={form.discountType !== "label_only"}
            />

            <DatePicker
              id="promo-valid-from"
              label="Valid From"
              value={form.validFrom}
              onChange={(val) => setForm((f) => ({ ...f, validFrom: val }))}
              minDate={todayYMD}
              required
            />

            <DatePicker
              id="promo-valid-until"
              label="Valid Until"
              value={form.validUntil}
              onChange={(val) => setForm((f) => ({ ...f, validUntil: val }))}
              minDate={form.validFrom || todayYMD}
              required
            />

            <div className="col-span-2">
              <Input
                id="promo-banner-title"
                label="Banner Title"
                placeholder="30% OFF HOTELS THIS SUMMER!"
                value={form.bannerTitle}
                onChange={(e) => setForm((f) => ({ ...f, bannerTitle: e.target.value }))}
                required
              />
            </div>

            <div className="col-span-2">
              <Textarea
                id="promo-banner-subtitle"
                label="Banner Subtitle"
                placeholder="Book your stay now and get a premium category discount automatically applied."
                value={form.bannerSubtitle}
                onChange={(e) => setForm((f) => ({ ...f, bannerSubtitle: e.target.value }))}
                required
                rows={2}
              />
            </div>

            <CustomDropdown
              id="promo-status"
              label="Status"
              options={
                editModal
                  ? [
                    { value: "active", label: "Active" },
                    { value: "scheduled", label: "Scheduled" },
                    { value: "paused", label: "Paused" },
                    { value: "expired", label: "Expired" },
                    { value: "superseded", label: "Superseded" },
                  ]
                  : [
                    { value: "active", label: "Active" },
                    { value: "scheduled", label: "Scheduled" },
                  ]
              }
              value={form.status}
              onChange={(val) => setForm((f) => ({ ...f, status: val as any }))}
            />

            {form.discountType !== "label_only" && (
              <div className="flex items-center mt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.applyToBooking}
                    onChange={(e) => setForm((f) => ({ ...f, applyToBooking: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-slate-700">Apply discount at checkout</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </ActionModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Activity Promotion"
        description={`Are you sure you want to permanently delete the promotion "${deleteConfirm?.bannerTitle}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  );
}
