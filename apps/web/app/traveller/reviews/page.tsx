"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { RatingStars } from "@/components/charts/Charts";
import { cn, formatDate } from "@/lib/utils";
import {
  clearLatestReviewContext,
  fetchMyReviews,
  getApiErrorMessage,
  readLatestReviewContext,
  submitTravellerReview,
  TRAVELLER_REVIEW_RATING_MAX,
  TRAVELLER_REVIEW_RATING_MIN,
  type LatestReviewContext,
  type MyReview,
} from "@/services/traveller";
import { TravellerHeader } from "../components/TravellerHeader";

function shortId(value?: string | null) {
  return value ? value.replace(/-/g, "").slice(0, 8).toUpperCase() : "—";
}

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
} as const;

function ReviewSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyReviewsState({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
      <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Star className="h-7 w-7" />
        </div>
        <p className="mt-4 font-semibold text-slate-950">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>
      </div>
    </Card>
  );
}

function ReviewStarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: 5 }).map((_, index) => {
        const star = index + 1;
        const active = star <= value;

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            aria-label={`${star} star rating`}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border transition",
              active
                ? "border-amber-300 bg-amber-50 text-amber-400"
                : "border-slate-200 bg-white text-slate-300 hover:border-amber-200 hover:bg-amber-50",
            )}
          >
            <Star className={cn("h-5 w-5", active && "fill-current")} />
          </button>
        );
      })}
      <div className="ml-1">
        <p className="text-sm font-semibold text-slate-950">{RATING_LABELS[value as keyof typeof RATING_LABELS]}</p>
        <p className="text-xs text-slate-400">{value}/{TRAVELLER_REVIEW_RATING_MAX}</p>
      </div>
    </div>
  );
}

function MyReviewCard({ review }: { review: MyReview }) {
  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                label={review.isHidden ? "hidden" : "visible"}
                variant={review.isHidden ? "warning" : "success"}
              />
              {review.providerReply && <Badge label="provider replied" variant="info" />}
              <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
            </div>
            <h3 className="text-base font-bold text-slate-950">{review.listingName}</h3>
            <p className="text-xs text-slate-500">Booking {shortId(review.bookingId)}</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2">
            <RatingStars rating={review.rating} />
            <span className="text-sm font-semibold text-slate-950">{review.rating}/5</span>
          </div>
        </div>

        {review.title && <p className="text-sm font-semibold text-slate-950">{review.title}</p>}
        {review.body && (
          <p className={cn("text-sm leading-6 text-slate-600", !review.title && "pt-1")}>
            {review.body}
          </p>
        )}

        {review.providerReply && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Provider reply
              </p>
              <span className="text-[11px] text-emerald-700">
                {review.providerRepliedAt ? formatDate(review.providerRepliedAt) : "Replied"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-950">{review.providerReply}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function TravellerReviewsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [latestContext, setLatestContext] = useState<LatestReviewContext | null>(null);
  const [rating, setRating] = useState(TRAVELLER_REVIEW_RATING_MAX);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [queryContext, setQueryContext] = useState({
    bookingId: "",
    listingId: "",
    listingName: "",
  });

  const {
    data: reviews = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["traveller-my-reviews"],
    queryFn: fetchMyReviews,
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setQueryContext({
        bookingId: params.get("bookingId")?.trim() ?? "",
        listingId: params.get("listingId")?.trim() ?? "",
        listingName: params.get("listingName")?.trim() ?? "",
      });
    }
    setLatestContext(readLatestReviewContext());
  }, []);

  const bookingId = queryContext.bookingId || latestContext?.bookingId || "";
  const listingId = queryContext.listingId || latestContext?.listingId || "";
  const listingName = queryContext.listingName || latestContext?.listingName || "";
  const canReview = Boolean(bookingId);

  const submitMutation = useMutation({
    mutationFn: submitTravellerReview,
    onSuccess: (response) => {
      setSuccessMessage(response.message);
      setFormError(null);
      setRating(TRAVELLER_REVIEW_RATING_MAX);
      setTitle("");
      setBody("");
      setLatestContext(null);
      clearLatestReviewContext();
      queryClient.invalidateQueries({ queryKey: ["traveller-my-reviews"] });
      router.replace("/traveller/reviews", { scroll: false });
    },
    onError: (mutationError) => {
      setFormError(getApiErrorMessage(mutationError, "Unable to submit your review right now."));
    },
  });

  const sortedReviews = useMemo(
    () =>
      [...reviews].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [reviews],
  );

  const stats = useMemo(() => {
    const total = sortedReviews.length;
    const average = total > 0
      ? sortedReviews.reduce((sum, review) => sum + review.rating, 0) / total
      : 0;
    const replied = sortedReviews.filter((review) => review.providerReply).length;
    const hidden = sortedReviews.filter((review) => review.isHidden).length;

    return { total, average, replied, hidden };
  }, [sortedReviews]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canReview || submitMutation.isPending) return;

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (rating < TRAVELLER_REVIEW_RATING_MIN || rating > TRAVELLER_REVIEW_RATING_MAX) {
      setFormError("Please choose a rating between 1 and 5.");
      return;
    }

    submitMutation.mutate({
      bookingId,
      rating,
      title: trimmedTitle || undefined,
      body: trimmedBody || undefined,
    });
  };

  return (
    <>
      <TravellerHeader />
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#f3f7f2_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="mb-6 border-emerald-100 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur" padding="lg">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Traveller reviews</p>
            <h1 className="text-3xl font-bold text-slate-950">My Reviews</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Share feedback from your completed stays.
            </p>
          </div>
        </Card>

        {successMessage && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span>{successMessage}</span>
            </div>
            <button className="rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => setSuccessMessage(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <Card className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
            <SectionHeader
              title="Leave a review"
              subtitle="Completed bookings only, and the booking link is kept locally after checkout."
            />

            {canReview ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Booking</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{bookingId}</p>
                    </div>
                    <Badge label="eligible" variant="success" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {listingName && <span>{listingName}</span>}
                    {listingId && <span>· Listing {shortId(listingId)}</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Rating</p>
                  <ReviewStarPicker value={rating} onChange={setRating} />
                </div>

                <Input
                  label="Review title"
                  placeholder="A quick summary"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                  hint="Optional · 100 characters max"
                />

                <div className="space-y-1.5">
                  <Textarea
                    label="Review details"
                    placeholder="Tell future travellers what stood out, what felt special, or what could be better."
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={6}
                    maxLength={2000}
                  />
                  <p className="text-xs text-slate-400">Optional · {body.length}/2000 characters</p>
                </div>

                {formError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="success"
                  className="w-full"
                  loading={submitMutation.isPending}
                  disabled={!canReview || submitMutation.isPending}
                  icon={<Star />}
                >
                  Submit review
                </Button>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs leading-6 text-emerald-800">
                  Reviews are only accepted for completed bookings within the backend review window. If your booking is too old or already reviewed, the API will reject the submission.
                </div>
              </form>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <ArrowLeft className="h-7 w-7" />
                </div>
                <p className="mt-4 font-semibold text-slate-950">No review link available</p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  Open this page from a checkout confirmation or a review link from your most recent completed booking.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" onClick={() => router.push("/traveller")}>
                    Browse listings
                  </Button>
                  <Button variant="ghost" onClick={() => router.push("/traveller/messages")}>
                    Open messages
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
              <SectionHeader
                title="My reviews"
                subtitle={`${stats.total} submitted · ${stats.average ? stats.average.toFixed(1) : "0.0"} average rating`}
                action={
                  <Button
                    variant="outline"
                    icon={<RefreshCw />}
                    loading={isFetching && !isLoading}
                    onClick={() => refetch()}
                  >
                    Refresh
                  </Button>
                }
              />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Total</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{stats.total}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Average</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-2xl font-bold text-slate-950">{stats.average ? stats.average.toFixed(1) : "—"}</p>
                    <RatingStars rating={stats.average} />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Replies</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{stats.replied}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Hidden</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{stats.hidden}</p>
                </div>
              </div>
            </Card>

            {isLoading ? (
              <ReviewSkeleton />
            ) : isError ? (
              <EmptyReviewsState
                title="Unable to load your reviews"
                message={getApiErrorMessage(error, "Please try again in a moment.")}
              />
            ) : sortedReviews.length === 0 ? (
              <EmptyReviewsState
                title="No reviews yet"
                message="Once you submit your first completed-stay review, it will show up here."
              />
            ) : (
              <div className="space-y-4">
                {sortedReviews.map((review) => (
                  <MyReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
