"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star, AlertCircle, RefreshCw } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { RatingStars } from "@/components/charts/Charts";
import { cn, formatDate } from "@/lib/utils";
import { fetchListingReviews, getApiErrorMessage } from "@/services/traveller";

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
    <Card>
      <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Star className="h-7 w-7" />
        </div>
        <p className="mt-4 font-semibold text-slate-900">No public reviews yet</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Travellers will see reviews here once guests start sharing their stay feedback.
        </p>
      </div>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
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
    </Card>
  );
}

export function PublicReviewsSection({ listingId }: PublicReviewsSectionProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [listingId]);

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

  const reviews = data?.reviews ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const averageRating = data?.averageRating ?? null;

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.06)]" padding="lg">
      <SectionHeader
        title="Guest Reviews"
        subtitle={total > 0 ? `${total} review${total === 1 ? "" : "s"} from travellers` : "Public feedback from travellers"}
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Average rating</p>
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
                  <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                          <Star className="h-5 w-5 fill-current" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <RatingStars rating={review.rating} />
                            <span className="text-sm font-semibold text-slate-900">{review.rating}/5</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">Reviewer {shortId(review.guestId)}</p>
                          <p className="text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {review.title && (
                      <p className="mt-4 text-sm font-semibold text-slate-900">{review.title}</p>
                    )}
                    {review.body && (
                      <p className={cn("mt-2 text-sm leading-6 text-slate-600", !review.title && "mt-3")}>
                        {review.body}
                      </p>
                    )}
                  </article>
                ))}
              </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
                <span className="font-semibold text-slate-900">{totalPages}</span>
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
                  icon={<ChevronRight />}
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
