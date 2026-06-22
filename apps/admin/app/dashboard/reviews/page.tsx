"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, EyeOff, Eye } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { ActionModal } from "@/components/modals/Modals";
import { formatDate, truncate } from "@/lib/utils";
import type { ListingReview, AdminRole } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";
import { canAccess } from "@/permissions/rbac";
import { AccessDenied } from "@/components/ui/AccessDenied";

const fetchReviews = (params: Record<string, string>) =>
  listingApi.get(`/admin/reviews?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { user, _hasHydrated } = useAuthStore();
  
  if (_hasHydrated && !canAccess(user?.role as any, "view_reviews")) {
    return <AccessDenied />;
  }

  const role = user?.role as AdminRole | undefined;
  const canManageReviews = canAccess(role, "manage_reviews");

  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [isHidden, setIsHidden] = useState("");
  const [rating, setRating] = useState("");
  const [hideModal, setHideModal] = useState<ListingReview | null>(null);
  const [hideReason, setHideReason] = useState("");

  const params = { q, ...(isHidden ? { isHidden } : {}), ...(rating ? { rating } : {}), page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews", params],
    queryFn: () => fetchReviews(params),
  });

  const reviews: ListingReview[] = data?.reviews ?? [];
  const total: number = data?.total ?? 0;

  const offset = (page - 1) * limit;
  const requestUrl = `/admin/reviews?${new URLSearchParams(params)}`;
  const responseCount = data?.reviews?.length ?? 0;
  const renderedRows = reviews.length;
  console.log("ReviewsPage Pagination Debug:", {
    page,
    limit,
    offset,
    params,
    queryKey: ["admin-reviews", params],
    requestUrl,
    responseCount,
    renderedRows,
  });

  const hideMut = useMutation({
    mutationFn: ({ id, hide, reason }: { id: string; hide: boolean; reason?: string }) =>
      listingApi.patch(`/reviews/${id}/hide`, { hidden: hide, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      setHideModal(null);
      setHideReason("");
    },
  });

  const columns: Column<ListingReview>[] = [
    {
      key: "listing",
      label: "Listing",
      width: "180px",
      render: (r) => (
        <div>
          <p className="font-medium text-sm text-slate-900 truncate">{r.listing?.name ?? r.listingId}</p>
          <p className="text-xs text-slate-500">Guest: {r.guestId.slice(0, 8)}…</p>
        </div>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <StarDisplay rating={r.rating} />
          <span className="text-sm font-semibold text-slate-900">{r.rating}</span>
        </div>
      ),
    },
    {
      key: "content",
      label: "Review",
      render: (r) => (
        <div>
          {r.title && <p className="text-sm font-medium text-slate-900">{r.title}</p>}
          {r.body && <p className="text-xs text-slate-500">{truncate(r.body, 80)}</p>}
        </div>
      ),
    },
    {
      key: "reply",
      label: "Provider Reply",
      render: (r) => (
        r.providerReply
          ? <span className="text-xs text-slate-600 italic">{truncate(r.providerReply, 60)}</span>
          : <span className="text-xs text-slate-300">No reply</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        r.isHidden
          ? <Badge label="Hidden" status="suspended" />
          : <Badge label="Visible" status="active" />
      ),
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {canManageReviews && (
            r.isHidden ? (
              <button
                onClick={() => hideMut.mutate({ id: r.id, hide: false })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-success hover:bg-success/5 transition-colors"
                title="Unhide"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setHideModal(r)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-warning hover:bg-warning/5 transition-colors"
                title="Hide review"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Reviews"
        description={`${total.toLocaleString()} platform reviews`}
      />

      <Card padding="none">
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search review content…"
          filters={[
            {
              key: "isHidden",
              label: "All Status",
              value: isHidden,
              onChange: (v) => { setIsHidden(v); setPage(1); },
              options: [
                { value: "false", label: "Visible" },
                { value: "true", label: "Hidden" },
              ],
            },
            {
              key: "rating",
              label: "All Ratings",
              value: rating,
              onChange: (v) => { setRating(v); setPage(1); },
              options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} Star${n > 1 ? "s" : ""}` })),
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={reviews}
          loading={isLoading}
          emptyTitle="No reviews found"
          emptyIcon={<Star className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Hide reason modal */}
      <ActionModal
        open={!!hideModal}
        onClose={() => { setHideModal(null); setHideReason(""); }}
        title="Hide review"
        description="This review will be removed from public view."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setHideModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={hideMut.isPending}
              onClick={() => hideModal && hideMut.mutate({ id: hideModal.id, hide: true, reason: hideReason })}
              leftIcon={<EyeOff className="h-4 w-4" />}
            >
              Hide Review
            </Button>
          </>
        }
      >
        <Textarea
          id="hide-reason"
          label="Reason for hiding"
          value={hideReason}
          onChange={(e) => setHideReason(e.target.value)}
          placeholder="e.g. Violates community guidelines, suspected fake review…"
          rows={3}
        />
      </ActionModal>
    </div>
  );
}
