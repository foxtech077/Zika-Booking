"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Star,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { listingApi } from "@/lib/listing-api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";

type ReplyFilter = "all" | "replied" | "not-replied";
type SortOption = "latest" | "highest" | "lowest";
type DateRange = "all" | "today" | "week" | "month";

interface ProviderReview {
  id: string;
  guestName: string;
  guestAvatar?: string;
  rating: number;
  title?: string;
  comment: string;
  listingId?: string;
  listingName: string;
  bookingId?: string;
  bookingDate?: string;
  stayDate?: string;
  createdAt: string;
  reply?: string;
  replyCreatedAt?: string;
}

interface ReviewStats {
  total: number;
  average: number;
  fiveStar: number;
  pendingReplies: number;
  breakdown: Record<number, number>;
}

const LIMIT = 8;
const MAX_REPLY_LENGTH = 1000;
const MIN_REPLY_LENGTH = 5;

const ratingOptions = [
  { value: "all", label: "All ratings" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
];

const replyOptions = [
  { value: "all", label: "All replies" },
  { value: "replied", label: "Replied" },
  { value: "not-replied", label: "Not replied" },
];

const sortOptions = [
  { value: "latest", label: "Latest" },
  { value: "highest", label: "Highest rating" },
  { value: "lowest", label: "Lowest rating" },
];

const dateOptions = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

function unwrapList(payload: unknown): unknown[] {
  const root = payload as Record<string, unknown>;
  const data = root?.data as Record<string, unknown> | undefined;
  for (const source of [data, root]) {
    if (!source) continue;
    for (const key of ["reviews", "listings", "items", "results", "data"]) {
      const value = source[key];
      if (Array.isArray(value)) return value;
    }
  }
  return Array.isArray(payload) ? payload : [];
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nestedName(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const obj = value as Record<string, unknown>;
  return readString(obj.name ?? obj.fullName ?? obj.title, fallback);
}

function normalizeReview(raw: unknown): ProviderReview {
  const item = raw as Record<string, unknown>;
  const guest = (item.guest ?? item.customer ?? item.user ?? {}) as Record<string, unknown>;
  const listing = (item.listing ?? item.property ?? {}) as Record<string, unknown>;
  const booking = (item.booking ?? {}) as Record<string, unknown>;
  const providerReply = item.providerReply ?? item.reply ?? item.response;
  const replyText = typeof providerReply === "object" && providerReply
    ? (providerReply as Record<string, unknown>).text ?? (providerReply as Record<string, unknown>).body
    : providerReply;

  return {
    id: readString(item.id ?? item._id ?? item.reviewId, crypto.randomUUID()),
    guestName: readString(item.guestName ?? item.customerName ?? guest.name ?? guest.fullName, "Guest"),
    guestAvatar: readString(item.guestAvatar ?? item.avatar ?? guest.avatar ?? guest.image),
    rating: Math.min(5, Math.max(1, Number(item.rating ?? item.stars ?? 0) || 0)),
    title: readString(item.title),
    comment: readString(item.comment ?? item.body ?? item.review ?? item.message, "No written comment provided."),
    listingId: readString(item.listingId ?? listing.id ?? listing._id),
    listingName: readString(item.listingName ?? item.propertyName, nestedName(listing, "Listing")),
    bookingId: readString(item.bookingId ?? item.bookingReference ?? booking.id ?? booking.reference),
    bookingDate: readString(item.bookingDate ?? booking.createdAt ?? booking.date),
    stayDate: readString(item.stayDate ?? item.checkIn ?? booking.checkIn ?? booking.startDate),
    createdAt: readString(item.createdAt ?? item.created_at, new Date().toISOString()),
    reply: readString(replyText),
    replyCreatedAt: readString(item.replyCreatedAt ?? item.repliedAt),
  };
}

function calculateStats(reviews: ProviderReview[]): ReviewStats {
  const breakdown = [1, 2, 3, 4, 5].reduce((acc, rating) => ({ ...acc, [rating]: 0 }), {} as Record<number, number>);
  reviews.forEach((review) => {
    breakdown[review.rating] = (breakdown[review.rating] ?? 0) + 1;
  });

  const total = reviews.length;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return {
    total,
    average: total ? Number((sum / total).toFixed(1)) : 0,
    fiveStar: breakdown[5] ?? 0,
    pendingReplies: reviews.filter((review) => !review.reply).length,
    breakdown,
  };
}

function dateMatchesRange(dateValue: string, range: DateRange) {
  if (range === "all") return true;
  const reviewDate = new Date(dateValue);
  if (Number.isNaN(reviewDate.getTime())) return true;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "today") return reviewDate >= start;
  if (range === "week") {
    start.setDate(now.getDate() - 7);
    return reviewDate >= start;
  }
  start.setMonth(now.getMonth() - 1);
  return reviewDate >= start;
}

function getStatsFromResponse(
  rawResponse: any,
  reviewsList: ProviderReview[],
  listingId: string
): ReviewStats {
  const data = rawResponse?.data ?? rawResponse ?? {};
  const total = Number(data.total ?? data.totalReviews ?? reviewsList.length);
  const average = Number(data.averageRating ?? 0);
  
  // Initialize breakdown
  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  if (listingId === "all" && Array.isArray(data.distribution)) {
    data.distribution.forEach((d: any) => {
      const r = Number(d.rating);
      if (r >= 1 && r <= 5) {
        breakdown[r] = Number(d.count ?? d._count?.rating ?? 0);
      }
    });
  } else {
    // If not "all", or no distribution returned, count from current list
    reviewsList.forEach((r) => {
      breakdown[r.rating] = (breakdown[r.rating] ?? 0) + 1;
    });
  }

  const pendingReplies = reviewsList.filter((review) => !review.reply).length;

  return {
    total,
    average,
    fiveStar: breakdown[5] ?? 0,
    pendingReplies,
    breakdown,
  };
}

async function fetchReviews(
  listingId: string,
  page: number,
  ratingFilter: string,
  replyFilter: string,
  listingsList: Array<{ id: string; name: string }>
) {
  try {
    const selectedListing = listingsList.find((l) => l.id === listingId);
    if (listingId === "all") {
      const params: Record<string, string> = {
        offset: String((page - 1) * LIMIT),
        limit: String(LIMIT),
      };
      if (ratingFilter !== "all") {
        params.rating = ratingFilter;
      }
      if (replyFilter !== "all") {
        params.replied = replyFilter === "replied" ? "yes" : "no";
      }
      const response = await listingApi.get("/provider/reviews", { params });
      const reviews = unwrapList(response.data).map((r) => normalizeReview(r));
      const stats = getStatsFromResponse(response.data, reviews, listingId);
      return { reviews, stats };
    } else {
      const params = { page: String(page), limit: String(LIMIT) };
      const response = await listingApi.get(`/listings/${listingId}/reviews`, { params });
      const reviews = unwrapList(response.data).map((r) => normalizeReview(r, listingId, selectedListing?.name));
      const stats = getStatsFromResponse(response.data, reviews, listingId);
      return { reviews, stats };
    }
  } catch {
    return {
      reviews: [],
      stats: { total: 0, average: 0, fiveStar: 0, pendingReplies: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    };
  }
}

async function submitReply(reviewId: string, reply: string) {
  return listingApi.post(`/reviews/${reviewId}/reply`, { reply });
}

function RatingStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            size === "md" ? "h-5 w-5" : "h-4 w-4",
            star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"
          )}
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card className="min-h-[108px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5", tone)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-slate-100" />
                <div className="h-3 w-20 rounded bg-slate-100" />
              </div>
            </div>
            <div className="h-4 w-3/4 rounded bg-slate-100" />
            <div className="h-16 rounded-xl bg-slate-100" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </div>
        <p className="mt-4 font-semibold text-slate-900">{title}</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      </div>
    </Card>
  );
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [listingId, setListingId] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>("all");
  const [sort, setSort] = useState<SortOption>("latest");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [search, setSearch] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: listingsList = [] } = useQuery({
    queryKey: ["provider-listings-for-reviews"],
    queryFn: async () => {
      try {
        const response = await listingApi.get("/listings", { params: { limit: 100 } });
        const raw = unwrapList(response.data) as any[];
        return raw.map((item) => ({
          id: item.id,
          name: item.name ?? item.title ?? "Listing",
        }));
      } catch {
        return [];
      }
    },
  });

  const {
    data: queryData = {
      reviews: [],
      stats: { total: 0, average: 0, fiveStar: 0, pendingReplies: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    },
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["provider-reviews-page", listingId, page, ratingFilter, replyFilter, listingsList.length],
    queryFn: () => fetchReviews(listingId, page, ratingFilter, replyFilter, listingsList),
    enabled: listingsList.length > 0 || listingId === "all",
  });

  const reviews = queryData.reviews;
  const stats = queryData.stats;

  const replyMutation = useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) => submitReply(reviewId, reply),
    onSuccess: (_, variables) => {
      setNotice("Reply saved successfully.");
      setEditingReplyId(null);
      setReplyDrafts((drafts) => ({ ...drafts, [variables.reviewId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["provider-reviews-page"] });
    },
  });

  const listingOptions = useMemo(() => {
    return [
      { value: "all", label: "All listings" },
      ...listingsList.map((l) => ({ value: l.id, label: l.name })),
    ];
  }, [listingsList]);

  const filteredReviews = useMemo(() => {
    const text = search.trim().toLowerCase();
    return reviews
      .filter((review) => {
        if (listingId !== "all") {
          if (ratingFilter !== "all" && review.rating !== Number(ratingFilter)) return false;
          if (replyFilter !== "all" && (replyFilter === "replied" ? !review.reply : !!review.reply)) return false;
        }
        return true;
      })
      .filter((review) => dateMatchesRange(review.createdAt, dateRange))
      .filter((review) => {
        if (!text) return true;
        return `${review.guestName} ${review.comment} ${review.title ?? ""} ${review.listingName}`.toLowerCase().includes(text);
      })
      .sort((a, b) => {
        if (sort === "highest") return b.rating - a.rating;
        if (sort === "lowest") return a.rating - b.rating;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [reviews, listingId, ratingFilter, replyFilter, dateRange, search, sort]);

  const totalPages = Math.max(1, Math.ceil(stats.total / LIMIT));
  const hasFilters = search || ratingFilter !== "all" || replyFilter !== "all" || dateRange !== "all";

  const handleReplyChange = (reviewId: string, value: string) => {
    setReplyDrafts((drafts) => ({ ...drafts, [reviewId]: value }));
  };

  const startReply = (review: ProviderReview) => {
    setEditingReplyId(review.id);
    setReplyDrafts((drafts) => ({ ...drafts, [review.id]: drafts[review.id] ?? review.reply ?? "" }));
  };

  const saveReply = (review: ProviderReview) => {
    const reply = (replyDrafts[review.id] ?? "").trim();
    if (reply.length < MIN_REPLY_LENGTH || reply.length > MAX_REPLY_LENGTH) return;
    replyMutation.mutate({ reviewId: review.id, reply });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Reviews & Ratings"
        subtitle="Monitor guest feedback, reply to reviews, and track listing reputation."
        action={
          <Button variant="outline" icon={<RefreshCw />} loading={isFetching && !isLoading} onClick={() => refetch()}>
            Retry
          </Button>
        }
      />

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {notice}
          </span>
          <button className="rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Reviews" value={stats.total} icon={<MessageSquare />} tone="bg-green-700 text-white" />
        <StatCard label="Average Rating" value={stats.average ? `${stats.average}/5` : "-"} icon={<Star />} tone="bg-green-700 text-white" />
        <StatCard label="5-star Reviews" value={stats.fiveStar} icon={<Star />} tone="bg-green-700 text-white" />
        <StatCard label="Pending Replies" value={stats.pendingReplies} icon={<Clock3 />} tone="bg-green-700 text-white" />
      </div>

      <Card>
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-amber-50">
              <p className="text-3xl font-bold text-amber-600">{stats.average || "-"}</p>
              <RatingStars rating={stats.average} />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Rating breakdown</p>
              <p className="mt-1 text-sm text-slate-500">{stats.total} guest review{stats.total === 1 ? "" : "s"}</p>
            </div>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.breakdown[rating] ?? 0;
              const percent = stats.total ? (count / stats.total) * 100 : 0;
              return (
                <div key={rating} className="grid grid-cols-[52px_1fr_36px] items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    {rating}
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-right text-xs font-medium text-slate-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          <Input
            label="Search"
            placeholder="Guest name or review text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leftIcon={<Search />}
          />
          <Select label="Listing" value={listingId} onChange={(event) => { setListingId(event.target.value); setPage(1); }} options={listingOptions} />
          <Select label="Rating" value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} options={ratingOptions} />
          <Select label="Reply Status" value={replyFilter} onChange={(event) => setReplyFilter(event.target.value as ReplyFilter)} options={replyOptions} />
          <Select label="Sort" value={sort} onChange={(event) => setSort(event.target.value as SortOption)} options={sortOptions} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
          <Select label="Date Range" value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} options={dateOptions} />
          <div className="flex items-end">
            <Button
              variant="ghost"
              icon={<Filter />}
              onClick={() => {
                setSearch("");
                setRatingFilter("all");
                setReplyFilter("all");
                setDateRange("all");
                setSort("latest");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <ReviewsSkeleton />
      ) : filteredReviews.length === 0 ? (
        <EmptyState
          title={reviews.length === 0 ? "No reviews yet" : hasFilters ? "No search results" : "No pending replies"}
          message={
            reviews.length === 0
              ? "Guest reviews will appear here after completed stays."
              : hasFilters
                ? "Try adjusting your search or filters to find more guest feedback."
                : "All visible reviews have already been handled."
          }
          icon={reviews.length === 0 ? <Star /> : <Search />}
        />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => {
            const isEditing = editingReplyId === review.id;
            const draft = replyDrafts[review.id] ?? review.reply ?? "";
            const draftLength = draft.trim().length;
            const isInvalid = draftLength > 0 && draftLength < MIN_REPLY_LENGTH;

            return (
              <Card key={review.id} hover>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    {review.guestAvatar ? (
                      <img src={review.guestAvatar} alt={review.guestName} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <Avatar name={review.guestName} size="md" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{review.guestName}</p>
                        <Badge label={review.reply ? "Replied" : "Awaiting Reply"} status={review.reply ? "confirmed" : "pending"} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatRelativeTime(review.createdAt)}</span>
                        {review.bookingId && <span>{review.bookingId}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <RatingStars rating={review.rating} size="md" />
                    <span className="text-sm font-bold text-slate-800">{review.rating}/5</span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  {review.title && <p className="mb-1 font-semibold text-slate-900">{review.title}</p>}
                  <p className="text-sm leading-6 text-slate-700">{review.comment}</p>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <Info label="Listing" value={review.listingName} />
                  <Info label="Stay Date" value={review.stayDate ? formatDate(review.stayDate) : "Not provided"} />
                  <Info label="Review Date" value={formatDate(review.createdAt)} />
                </div>

                <div className="mt-4 rounded-xl border border-border p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">Provider Reply</p>
                      {review.reply && !isEditing && (
                        <p className="text-xs text-slate-500">
                          {review.replyCreatedAt ? `Replied ${formatRelativeTime(review.replyCreatedAt)}` : "Reply visible to guest"}
                        </p>
                      )}
                    </div>
                    {!isEditing && (
                      <Button size="xs" variant={review.reply ? "outline" : "primary"} icon={review.reply ? <Edit3 /> : <MessageSquare />} onClick={() => startReply(review)}>
                        {review.reply ? "Edit Reply" : "Reply"}
                      </Button>
                    )}
                  </div>

                  {review.reply && !isEditing ? (
                    <p className="rounded-xl bg-primary-50 p-3 text-sm leading-6 text-slate-700">{review.reply}</p>
                  ) : isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={draft}
                        onChange={(event) => handleReplyChange(review.id, event.target.value)}
                        rows={4}
                        maxLength={MAX_REPLY_LENGTH}
                        placeholder="Thank the guest and address their feedback professionally."
                        className={cn(
                          "w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary",
                          isInvalid ? "border-red-300" : "border-border"
                        )}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className={cn("text-xs", isInvalid ? "text-red-500" : "text-slate-400")}>
                          {draft.length}/{MAX_REPLY_LENGTH}
                          {isInvalid ? ` · Minimum ${MIN_REPLY_LENGTH} characters` : ""}
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingReplyId(null)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            icon={<Send />}
                            loading={replyMutation.isPending}
                            disabled={draftLength < MIN_REPLY_LENGTH || draftLength > MAX_REPLY_LENGTH}
                            onClick={() => saveReply(review)}
                          >
                            Submit Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border p-3 text-sm text-slate-500">No reply yet.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page <span className="font-semibold text-slate-900">{page}</span> of <span className="font-semibold text-slate-900">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<ChevronLeft />}
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-900">{value}</p>
    </div>
  );
}
