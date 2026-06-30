"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star, AlertCircle, RefreshCw, X } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { RatingStars } from "@/components/charts/Charts";
import { cn, formatDate } from "@/lib/utils";
import {
  fetchListingReviews,
  getApiErrorMessage,
  readLatestReviewContext,
  submitTravellerReview,
  TRAVELLER_REVIEW_RATING_MIN,
  TRAVELLER_REVIEW_RATING_MAX,
} from "@/services/traveller";

interface PublicReviewsSectionProps {
  listingId: string;
}

function shortId(value: string) {
  return value.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function ReviewsSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-16 w-full" />
        </Card>
      ))}
    </div>
  );
}

function EmptyReviewsState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Star className="h-7 w-7" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">No public reviews yet</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Be the first to share your experience at this listing.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <AlertCircle className="h-7 w-7" />
      </div>
      <p className="mt-4 font-semibold text-slate-900">Unable to load reviews</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      <Button variant="outline" icon={<RefreshCw />} className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-all",
              star <= value
                ? "border-amber-400 bg-amber-50 text-amber-500 scale-105"
                : "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-400",
            )}
          >
            <Star className={cn("h-6 w-6", star <= value && "fill-current")} />
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-semibold text-slate-700">
          {["", "Poor", "Fair", "Good", "Very good", "Excellent"][value]}
        </span>
      )}
    </div>
  );
}

export function PublicReviewsSection({ listingId }: PublicReviewsSectionProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(TRAVELLER_REVIEW_RATING_MAX);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["traveller-listing-reviews", listingId, page],
    queryFn: () => fetchListingReviews(listingId, page, 4),
    enabled: !!listingId,
  });

  const submitMutation = useMutation({
    mutationFn: submitTravellerReview,
    onSuccess: (res) => {
      setSuccessMsg(res.message || "Review submitted! Thank you for your feedback.");
      setFormError(null);
      setReviewRating(TRAVELLER_REVIEW_RATING_MAX);
      setReviewTitle("");
      setReviewBody("");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["traveller-listing-reviews", listingId] });
      queryClient.invalidateQueries({ queryKey: ["traveller-my-reviews"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err) => {
      setFormError(getApiErrorMessage(err, "Unable to submit your review. Please try again."));
    },
  });

  const openModal = () => {
    setFormError(null);
    setReviewRating(TRAVELLER_REVIEW_RATING_MAX);
    setReviewTitle("");
    setReviewBody("");
    setModalOpen(true);
  };

  const handleReviewSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitMutation.isPending) return;
    if (reviewRating < TRAVELLER_REVIEW_RATING_MIN || reviewRating > TRAVELLER_REVIEW_RATING_MAX) {
      setFormError("Please select a rating between 1 and 5 stars.");
      return;
    }
    // Use bookingId from post-checkout session context if available; backend validates eligibility
    const ctx = readLatestReviewContext();
    submitMutation.mutate({
      bookingId: ctx?.bookingId,
      rating: reviewRating,
      title: reviewTitle.trim() || undefined,
      body: reviewBody.trim() || undefined,
    });
  };

  const reviews = data?.reviews ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const averageRating = data?.averageRating ?? null;

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
      <SectionHeader
        title="Guest Reviews"
        subtitle={
          total > 0
            ? `${total} review${total === 1 ? "" : "s"} from travellers`
            : "Public feedback from travellers"
        }
        action={
          <div className="flex items-center gap-2">
            {/* <Button variant="success" size="sm" icon={<Star />} onClick={openModal}>
              Write a Review
            </Button> */}
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw />}
              loading={isFetching && !isLoading}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {successMsg && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-current text-amber-400" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 hover:bg-emerald-100"
            onClick={() => setSuccessMsg(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <ReviewsSkeleton />
      ) : isError ? (
        <ErrorState
          message={getApiErrorMessage(error, "The reviews feed could not be loaded.")}
          onRetry={() => refetch()}
        />
      ) : reviews.length === 0 ? (
        <EmptyReviewsState />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Overall rating
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-950">
                    {averageRating == null ? "—" : averageRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-slate-500">/ 5</span>
                </div>
                {averageRating != null && <RatingStars rating={averageRating} size="md" />}
              </div>
            </div>
            <div className="text-sm text-slate-500">
              {total > 0 ? `Showing page ${page} of ${totalPages}` : "No reviews to show"}
            </div>
          </div>

          <div className="grid gap-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
                    {shortId(review.guestId).slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Reviewer {shortId(review.guestId)}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5">
                        <RatingStars rating={review.rating} />
                        <span className="text-xs font-semibold text-slate-700">
                          {review.rating}/5
                        </span>
                      </div>
                    </div>

                    {review.title && (
                      <p className="mt-3 text-sm font-semibold text-slate-900">{review.title}</p>
                    )}
                    {review.body && (
                      <p
                        className={cn(
                          "text-sm leading-6 text-slate-600",
                          review.title ? "mt-1" : "mt-3",
                        )}
                      >
                        {review.body}
                      </p>
                    )}

                    {review.providerReply && (
                      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Response from host
                        </p>
                        <p className="mt-1 text-sm leading-6 text-emerald-900">
                          {review.providerReply}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                Page{" "}
                <span className="font-semibold text-slate-900">{page}</span> of{" "}
                <span className="font-semibold text-slate-900">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  icon={<ChevronLeft />}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  icon={<ChevronRight />}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Write a Review</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Share your experience with future travellers
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 transition"
                onClick={() => setModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="px-6 py-5 space-y-5">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Your rating
                </p>
                <StarPicker value={reviewRating} onChange={setReviewRating} />
              </div>

              <Input
                label="Review title"
                placeholder="Summarise your stay in a few words (optional)"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                maxLength={100}
                hint={`${reviewTitle.length}/100 characters`}
              />

              <div className="space-y-1.5">
                <Textarea
                  label="Your review"
                  placeholder="What did you love? What could be better? Your honest feedback helps other travellers."
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-right text-xs text-slate-400">{reviewBody.length} / 2000</p>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalOpen(false)}
                  disabled={submitMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  icon={<Star />}
                  loading={submitMutation.isPending}
                  disabled={submitMutation.isPending}
                >
                  Submit review
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
