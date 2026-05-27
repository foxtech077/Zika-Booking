"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, MessageSquare, Filter, TrendingUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modals/Modals";
import { RatingStars } from "@/components/charts/Charts";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { ProviderReview } from "@/types/provider";

const fetchReviews = (params: Record<string, string>) =>
  listingApi
    .get(`/provider/reviews?${new URLSearchParams(params)}`)
    .then((r) => r.data.data ?? r.data);

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [replied, setReplied] = useState("");
  const [rating, setRating] = useState("");
  const [replyModal, setReplyModal] = useState<ProviderReview | null>(null);
  const [replyText, setReplyText] = useState("");

  const params = { offset: String(offset), limit: "20", replied, rating };
  const { data, isLoading } = useQuery({
    queryKey: ["provider-reviews", params],
    queryFn:  () => fetchReviews(params),
  });

  const reviews: ProviderReview[] = data?.reviews ?? [];
  const total: number = data?.total ?? 0;
  const averageRating: number | null = data?.averageRating ?? null;
  const distribution: Array<{ rating: number; count: number }> = data?.distribution ?? [];

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      listingApi.post(`/reviews/${id}/reply`, { reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-reviews"] });
      setReplyModal(null);
      setReplyText("");
    },
  });

  const columns: Column<ProviderReview>[] = [
    {
      key: "guest",
      label: "Guest",
      width: "180px",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar name={r.guestName} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{r.guestName}</p>
            <p className="text-xs text-slate-400">{r.bookingReference}</p>
          </div>
        </div>
      ),
    },
    {
      key: "listing",
      label: "Listing",
      render: (r) => (
        <span className="text-xs text-slate-600 truncate max-w-[140px] block">{r.listingName ?? "—"}</span>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <RatingStars rating={r.rating} />
          <span className="text-xs font-semibold text-slate-700">{r.rating}/5</span>
        </div>
      ),
    },
    {
      key: "review",
      label: "Review",
      render: (r) => (
        <div>
          {r.title && <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">{r.title}</p>}
          {r.body && <p className="text-xs text-slate-500 truncate max-w-[200px]">{r.body}</p>}
        </div>
      ),
    },
    {
      key: "reply",
      label: "Your Reply",
      render: (r) => (
        r.providerReply
          ? <span className="text-xs text-success flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Replied</span>
          : <span className="text-xs text-slate-400">No reply</span>
      ),
    },
    {
      key: "date",
      label: "Posted",
      render: (r) => <span className="text-xs text-slate-400">{formatRelativeTime(r.createdAt)}</span>,
    },
    {
      key: "action",
      label: "",
      render: (r) => (
        <Button
          variant={r.providerReply ? "ghost" : "outline"}
          size="xs"
          onClick={() => { setReplyModal(r); setReplyText(r.providerReply ?? ""); }}
        >
          {r.providerReply ? "Edit Reply" : "Reply"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Reviews & Ratings"
        subtitle={`${total} review${total !== 1 ? "s" : ""}${averageRating ? ` · ${averageRating}★ average` : ""}`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card padding="sm" className="lg:col-span-2 flex items-center gap-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-amber-500">{averageRating ?? "—"}</p>
            {averageRating && <RatingStars rating={averageRating} size="md" />}
            <p className="text-xs text-slate-500 mt-1">{total} reviews</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((s) => {
              const count = distribution.find((d) => d.rating === s)?.count ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-3">{s}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding="sm" className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-success" />
          <div>
            <p className="text-xs text-slate-500">5-star reviews</p>
            <p className="font-bold text-slate-900">{distribution.find((d) => d.rating === 5)?.count ?? 0}</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs text-slate-500">Replied</p>
            <p className="font-bold text-slate-900">{reviews.filter((r) => r.providerReply).length}</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-danger" />
          <div>
            <p className="text-xs text-slate-500">Awaiting Reply</p>
            <p className="font-bold text-slate-900">{reviews.filter((r) => !r.providerReply).length}</p>
          </div>
        </Card>
      </div>

      {/* Reviews table */}
      <Card padding="none">
        <div className="p-4 border-b border-border">
          <FilterBar
            filters={[
              {
                key: "replied",
                value: replied,
                onChange: (v) => { setReplied(v); setOffset(0); },
                placeholder: "All reviews",
                options: [
                  { value: "yes", label: "Replied" },
                  { value: "no",  label: "Not replied" },
                ],
              },
              {
                key: "rating",
                value: rating,
                onChange: (v) => { setRating(v); setOffset(0); },
                placeholder: "All ratings",
                options: [5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} stars` })),
              },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={reviews}
          keyExtractor={(r) => r.id}
          loading={isLoading}
          emptyTitle="No reviews yet"
          emptyMessage="Guest reviews will appear here after completed bookings."
        />
        <Pagination total={total} limit={20} offset={offset} onOffsetChange={setOffset} />
      </Card>

      {/* Reply Modal */}
      <Modal
        open={!!replyModal}
        onClose={() => { setReplyModal(null); setReplyText(""); }}
        title="Reply to Review"
        subtitle={replyModal?.guestName}
        size="md"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setReplyModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={replyMutation.isPending}
              disabled={!replyText.trim()}
              onClick={() => {
                if (!replyModal) return;
                replyMutation.mutate({ id: replyModal.id, reply: replyText });
              }}
            >
              Submit Reply
            </Button>
          </div>
        }
      >
        {replyModal && (
          <div className="space-y-4">
            {/* Original review */}
            <div className="bg-surface-muted rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <RatingStars rating={replyModal.rating} />
                <span className="text-xs font-semibold text-slate-600">{replyModal.rating}/5</span>
              </div>
              {replyModal.title && <p className="text-sm font-semibold text-slate-900">{replyModal.title}</p>}
              {replyModal.body && <p className="text-sm text-slate-600 mt-1">{replyModal.body}</p>}
              <p className="text-xs text-slate-400 mt-2">{formatDate(replyModal.createdAt)}</p>
            </div>

            {/* Reply textarea */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Reply</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                maxLength={1000}
                placeholder="Thank you for your review! We're glad you..."
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{replyText.length}/1000</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
