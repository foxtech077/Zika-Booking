"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ShieldOff, ShieldCheck, ChevronRight, Star } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal, ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime, formatCurrency } from "@/lib/utils";
import type { Listing } from "@/types/admin";

const fetchListings = (params: Record<string, string>) =>
  listingApi.get(`/admin/listings?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

export default function ListingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [suspendModal, setSuspendModal] = useState<Listing | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [reinstateConfirm, setReinstateConfirm] = useState<Listing | null>(null);
  const [starModal, setStarModal] = useState<Listing | null>(null);
  const [newStar, setNewStar] = useState("3");
  const [starReason, setStarReason] = useState("");

  const params = { q, status, category, country, page: String(page), limit: "20" };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-listings", params],
    queryFn: () => fetchListings(params),
  });

  const listings: Listing[] = data?.listings ?? [];
  const total: number = data?.total ?? 0;

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      listingApi.post(`/admin/listings/${id}/suspend`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); setSuspendModal(null); setSuspendReason(""); },
  });

  const reinstateMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/admin/listings/${id}/reinstate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); setReinstateConfirm(null); },
  });

  const starMut = useMutation({
    mutationFn: ({ id, starRating, reason }: any) =>
      listingApi.patch(`/admin/listings/${id}/star-rating`, { starRating: parseInt(starRating), reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); setStarModal(null); setStarReason(""); },
  });

  const columns: Column<Listing>[] = [
    {
      key: "name",
      label: "Listing",
      width: "240px",
      render: (l) => (
        <div>
          <p className="font-medium text-sm text-slate-900 truncate">{l.name ?? "—"}</p>
          <p className="text-xs text-slate-500">{l.town}, {l.country} · {l.category}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (l) => <Badge label={l.status} status={l.status} />,
    },
    {
      key: "stars",
      label: "Stars",
      render: (l) => (
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          <span className="text-sm text-slate-700">{l.starRating ?? l.claimedStarRating ?? "—"}</span>
          {l.starRating !== l.claimedStarRating && l.claimedStarRating && (
            <span className="text-xs text-slate-400">(claimed: {l.claimedStarRating})</span>
          )}
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      align: "right",
      render: (l) => (
        <span className="text-sm tabular">
          {l.pricePerNight ? formatCurrency(Number(l.pricePerNight), l.currency ?? "USD") : "—"}
        </span>
      ),
    },
    {
      key: "approved",
      label: "Approved",
      render: (l) => <span className="text-xs text-slate-500">{formatDate(l.approvedAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: "100px",
      render: (l) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {l.category === "hotel" && l.status === "approved" && (
            <button
              onClick={() => setStarModal(l)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
              title="Update star rating"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          {["approved", "active"].includes(l.status) && (
            <button
              onClick={() => setSuspendModal(l)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-warning hover:bg-warning/5 transition-colors"
              title="Suspend"
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </button>
          )}
          {l.status === "suspended" && (
            <button
              onClick={() => setReinstateConfirm(l)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-success hover:bg-success/5 transition-colors"
              title="Reinstate"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Listings"
        description={`${total.toLocaleString()} total listings`}
      />

      <Card padding="none">
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search name or town…"
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "draft", label: "Draft" },
                { value: "pending_review", label: "Pending Review" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
                { value: "auto_suspended", label: "Auto-Suspended" },
              ],
            },
            {
              key: "category",
              label: "All Categories",
              value: category,
              onChange: (v) => { setCategory(v); setPage(1); },
              options: [
                { value: "hotel", label: "Hotel" },
                { value: "apartment", label: "Apartment" },
                { value: "car", label: "Car" },
              ],
            },
          ]}
        />
        <DataTable
          columns={columns}
          data={listings}
          loading={isLoading}
          onRowClick={(l) => setSelected(l)}
          emptyTitle="No listings found"
          emptyDescription="Try adjusting your search or filters."
          emptyIcon={<Building2 className="h-10 w-10" />}
        />
        <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
      </Card>

      {/* Detail drawer */}
      <SlideDrawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? "Listing"} width="sm">
        {selected && (
          <dl className="space-y-3 text-sm">
            {[
              ["ID", selected.id],
              ["Category", selected.category],
              ["Status", selected.status],
              ["Country", selected.country ?? "—"],
              ["Town", selected.town ?? "—"],
              ["Star Rating", selected.starRating ?? "—"],
              ["Claimed Stars", selected.claimedStarRating ?? "—"],
              ["Price/Night", selected.pricePerNight ? formatCurrency(Number(selected.pricePerNight), selected.currency ?? "USD") : "—"],
              ["Submissions", selected.submissionCount],
              ["Provider ID", selected.providerId],
              ["Approved", formatDate(selected.approvedAt)],
              ["Rejected", formatDate(selected.rejectedAt)],
              ["Suspended", formatDate(selected.suspendedAt)],
              ["Created", formatDate(selected.createdAt)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4">
                <dt className="text-slate-500 flex-shrink-0">{k}</dt>
                <dd className="text-slate-900 font-medium text-right truncate">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </SlideDrawer>

      {/* Suspend modal */}
      <ActionModal
        open={!!suspendModal}
        onClose={() => { setSuspendModal(null); setSuspendReason(""); }}
        title="Suspend listing"
        description={`Suspend "${suspendModal?.name}"? This will remove it from search.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSuspendModal(null)}>Cancel</Button>
            <Button
              variant="danger" size="sm"
              loading={suspendMut.isPending}
              onClick={() => suspendModal && suspendMut.mutate({ id: suspendModal.id, reason: suspendReason })}
            >
              Suspend
            </Button>
          </>
        }
      >
        <Textarea
          id="suspend-reason"
          label="Suspension reason"
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
          placeholder="Describe the reason for suspension…"
          required
          rows={3}
        />
      </ActionModal>

      {/* Reinstate confirm */}
      <ConfirmModal
        open={!!reinstateConfirm}
        onClose={() => setReinstateConfirm(null)}
        onConfirm={() => reinstateConfirm && reinstateMut.mutate(reinstateConfirm.id)}
        loading={reinstateMut.isPending}
        title="Reinstate listing"
        description={`Restore "${reinstateConfirm?.name}" to live status?`}
        variant="info"
        confirmLabel="Reinstate"
      />

      {/* Star rating modal */}
      <ActionModal
        open={!!starModal}
        onClose={() => { setStarModal(null); setStarReason(""); }}
        title="Update star rating"
        description={`Update verified star rating for "${starModal?.name}"`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setStarModal(null)}>Cancel</Button>
            <Button
              variant="primary" size="sm"
              loading={starMut.isPending}
              onClick={() => starModal && starMut.mutate({ id: starModal.id, starRating: newStar, reason: starReason })}
            >
              Update Rating
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            id="new-star"
            label="New Star Rating"
            value={newStar}
            onChange={(e) => setNewStar(e.target.value)}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ★` }))}
          />
          <Textarea
            id="star-reason"
            label="Reason for change"
            value={starReason}
            onChange={(e) => setStarReason(e.target.value)}
            placeholder="e.g. Re-inspection confirmed downgrade…"
            required
          />
        </div>
      </ActionModal>
    </div>
  );
}
