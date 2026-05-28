"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Eye, Edit3, Trash2, CheckCircle,
  XCircle, ArrowUpRight, Hotel, Car, Home,
} from "lucide-react";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { ConfirmModal } from "@/components/modals/Modals";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { formatDate, formatCurrency, slugToLabel } from "@/lib/utils";
import type { Listing, ListingCategory } from "@/types/provider";

const fetchListings = (params: Record<string, string>) =>
  listingApi
    .get(`/listings?${new URLSearchParams(params)}`)
    .then((r) => r.data.data ?? r.data);

function CategoryIcon({ category }: { category: ListingCategory }) {
  if (category === "hotel")     return <Hotel className="w-4 h-4 text-blue-500" />;
  if (category === "car")       return <Car className="w-4 h-4 text-amber-500" />;
  return <Home className="w-4 h-4 text-emerald-500" />;
}

function canSubmit(status: string)     { return ["draft", "rejected"].includes(status); }
function canActivate(status: string)   { return ["draft", "deactivated"].includes(status); }
function canDeactivate(status: string) { return ["active", "approved"].includes(status); }
function canDelete(status: string)     { return status === "draft"; }

export default function ListingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; listing: Listing } | null>(null);

  const params = { status, category, offset: String(offset), limit: "20" };
  const { data, isLoading } = useQuery({
    queryKey: ["provider-listings", params],
    queryFn:  () => fetchListings(params),
  });

  const listings: Listing[] = data?.listings ?? [];
  const total: number = data?.total ?? 0;

  const actionMutation = useMutation({
    mutationFn: ({ action, id }: { action: string; id: string }) =>
      listingApi.post(`/listings/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      qc.invalidateQueries({ queryKey: ["provider-dashboard"] });
      setConfirm(null);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listingApi.delete(`/listings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      setConfirm(null);
      setSelected(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (cat: ListingCategory) =>
      listingApi.post("/listings", { category: cat }).then((r) => r.data.data ?? r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      router.push(`/dashboard/listings/${data.id}/edit`);
    },
  });

  const columns: Column<Listing>[] = [
    {
      key: "listing",
      label: "Listing",
      width: "300px",
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
            {l.photos?.[0]?.cdnUrl ? (
              <img src={l.photos[0].cdnUrl} alt={l.name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <CategoryIcon category={l.category} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{l.name ?? "(Untitled)"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CategoryIcon category={l.category} />
              <span className="text-xs text-slate-500 capitalize">{l.category}</span>
              {l.town && <span className="text-xs text-slate-400">· {l.town}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (l) => <Badge label={l.status} status={l.status} dot />,
    },
    {
      key: "price",
      label: "Price / Night",
      render: (l) => (
        <span className="text-sm font-semibold text-slate-900">
          {l.pricePerNight ? formatCurrency(Number(l.pricePerNight), l.currency ?? "USD") : "—"}
        </span>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      render: (l) => (
        <span className="text-sm text-slate-600">
          {l.starRating ? `⭐ ${l.starRating}★` : l.claimedStarRating ? `${l.claimedStarRating}★ (claimed)` : "—"}
        </span>
      ),
    },
    {
      key: "updated",
      label: "Updated",
      render: (l) => <span className="text-xs text-slate-400">{formatDate(l.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (l) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelected(l)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface-muted hover:text-slate-700 transition-all"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {l.status !== "pending_review" && (
            <Link href={`/dashboard/listings/${l.id}/edit`}>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface-muted hover:text-slate-700 transition-all"
                title="Edit Listing"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </Link>
          )}
          {canDelete(l.status) && (
            <button
              onClick={() => setConfirm({ action: "delete", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-danger-light hover:text-danger transition-all"
              title="Delete Draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canActivate(l.status) && (
            <button
              onClick={() => setConfirm({ action: "activate", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-success-light hover:text-success transition-all"
              title="Activate"
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {canDeactivate(l.status) && (
            <button
              onClick={() => setConfirm({ action: "deactivate", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-warning-light hover:text-warning transition-all"
              title="Deactivate"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {canSubmit(l.status) && (
            <button
              onClick={() => setConfirm({ action: "submit", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-primary-50 hover:text-primary transition-all"
              title="Submit for review"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const isActing = actionMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="My Listings"
        subtitle={`${total} listing${total !== 1 ? "s" : ""} in your portfolio`}
        action={
          <div className="flex gap-2">
            {(["hotel", "apartment", "car"] as ListingCategory[]).map((cat) => (
              <Button
                key={cat}
                variant="outline"
                size="sm"
                onClick={() => createMutation.mutate(cat)}
                loading={createMutation.isPending}
                icon={<Plus />}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ))}
          </div>
        }
      />

      <Card padding="none">
        <div className="p-4 border-b border-border">
          <FilterBar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search listings…"
            filters={[
              {
                key: "status",
                value: status,
                onChange: setStatus,
                placeholder: "All statuses",
                options: [
                  { value: "draft",          label: "Draft" },
                  { value: "pending_review", label: "Pending Review" },
                  { value: "approved",       label: "Approved" },
                  { value: "active",         label: "Active" },
                  { value: "deactivated",    label: "Deactivated" },
                  { value: "rejected",       label: "Rejected" },
                  { value: "suspended",      label: "Suspended" },
                ],
              },
              {
                key: "category",
                value: category,
                onChange: setCategory,
                placeholder: "All categories",
                options: [
                  { value: "hotel",     label: "Hotel" },
                  { value: "apartment", label: "Apartment" },
                  { value: "car",       label: "Car" },
                ],
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={listings}
          keyExtractor={(l) => l.id}
          loading={isLoading}
          emptyTitle="No listings yet"
          emptyMessage="Create your first listing using the buttons above."
        />

        <Pagination
          total={total}
          limit={20}
          offset={offset}
          onOffsetChange={setOffset}
        />
      </Card>

      {/* Detail Drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Listing Details"}
        subtitle={selected ? `${slugToLabel(selected.category)} · ${slugToLabel(selected.status)}` : undefined}
        width="lg"
      >
        {selected && (
          <div className="space-y-5">
            {selected.photos?.[0]?.cdnUrl && (
              <img
                src={selected.photos[0].cdnUrl}
                alt={selected.name ?? ""}
                className="w-full h-48 object-cover rounded-xl"
              />
            )}

            <div className="flex items-center gap-3">
              <Badge label={selected.status} status={selected.status} dot />
              <Badge label={selected.category} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Price/Night",  value: selected.pricePerNight ? formatCurrency(Number(selected.pricePerNight), selected.currency ?? "USD") : "—" },
                { label: "Location",     value: [selected.town, selected.country].filter(Boolean).join(", ") || "—" },
                { label: "Min Stay",     value: selected.minStayNights ? `${selected.minStayNights} night(s)` : "—" },
                { label: "Cancellation", value: selected.cancellationPolicy ? slugToLabel(selected.cancellationPolicy) : "—" },
                { label: "Created",      value: formatDate(selected.createdAt) },
                { label: "Updated",      value: formatDate(selected.updatedAt) },
              ].map((d) => (
                <div key={d.label}>
                  <p className="text-xs text-slate-500 font-medium">{d.label}</p>
                  <p className="text-sm text-slate-900 font-semibold mt-0.5">{d.value}</p>
                </div>
              ))}
            </div>

            {selected.description && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{selected.description}</p>
              </div>
            )}

            {selected.rejectionReasons?.length > 0 && (
              <div className="bg-danger-light border border-danger/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-danger mb-1">Rejection Reasons</p>
                <ul className="list-disc pl-4 space-y-1">
                  {selected.rejectionReasons.map((r, i) => (
                    <li key={i} className="text-sm text-danger-dark">{r}</li>
                  ))}
                </ul>
                {selected.rejectionNote && (
                  <p className="text-xs text-danger-dark mt-2 border-t border-danger/20 pt-2">
                    {selected.rejectionNote}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {canSubmit(selected.status) && (
                <Button variant="primary" size="sm" onClick={() => setConfirm({ action: "submit", listing: selected })}>
                  Submit for Review
                </Button>
              )}
              {canActivate(selected.status) && (
                <Button variant="success" size="sm" onClick={() => setConfirm({ action: "activate", listing: selected })}>
                  Activate Listing
                </Button>
              )}
              {canDeactivate(selected.status) && (
                <Button variant="secondary" size="sm" onClick={() => setConfirm({ action: "deactivate", listing: selected })}>
                  Deactivate
                </Button>
              )}
              {canDelete(selected.status) && (
                <Button variant="danger" size="sm" onClick={() => setConfirm({ action: "delete", listing: selected })}>
                  Delete Draft
                </Button>
              )}
            </div>
          </div>
        )}
      </SlideDrawer>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "delete") {
            deleteMutation.mutate(confirm.listing.id);
          } else {
            actionMutation.mutate({ action: confirm.action, id: confirm.listing.id });
          }
        }}
        title={
          confirm?.action === "delete"     ? "Delete listing?" :
          confirm?.action === "submit"     ? "Submit for review?" :
          confirm?.action === "activate"   ? "Activate listing?" :
          "Deactivate listing?"
        }
        message={
          confirm?.action === "delete"
            ? `"${confirm.listing.name ?? "This draft"}" will be permanently deleted.`
            : confirm?.action === "submit"
            ? "Your listing will be sent to our team for review. This may take up to 48 hours."
            : confirm?.action === "activate"
            ? "This listing will go live and be visible to guests."
            : "This listing will be hidden from guests."
        }
        variant={confirm?.action === "delete" || confirm?.action === "deactivate" ? "danger" : "primary"}
        confirmLabel={
          confirm?.action === "delete"     ? "Delete" :
          confirm?.action === "submit"     ? "Submit" :
          confirm?.action === "activate"   ? "Activate" :
          "Deactivate"
        }
        loading={isActing}
      />
    </div>
  );
}
