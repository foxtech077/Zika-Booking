"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, formatDate } from "@/lib/utils";
import { readLatestReviewContext, type LatestReviewContext } from "@/services/traveller";

interface GiveReviewEntryProps {
  listingId: string;
  listingName?: string;
  className?: string;
}

export function GiveReviewEntry({ listingId, listingName, className }: GiveReviewEntryProps) {
  const router = useRouter();
  const [context, setContext] = useState<LatestReviewContext | null>(null);

  useEffect(() => {
    setContext(readLatestReviewContext());
  }, [listingId]);

  if (!context || context.listingId !== listingId) {
    return null;
  }

  const resolvedListingName = listingName ?? context.listingName ?? "";
  const reviewUrl = `/traveller/reviews?bookingId=${encodeURIComponent(context.bookingId)}&listingId=${encodeURIComponent(listingId)}${resolvedListingName ? `&listingName=${encodeURIComponent(resolvedListingName)}` : ""}`;

  return (
    <Card
      padding="lg"
      className={cn(
        "border-emerald-200 bg-emerald-50/70 shadow-[0_12px_40px_rgba(16,185,129,0.08)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Star className="h-5 w-5 fill-current" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Ready to review</p>
              <h3 className="mt-1 text-sm font-bold text-slate-950">
                Share feedback for {resolvedListingName || "this listing"}
              </h3>
            </div>
            <Badge label="Eligible" variant="success" />
          </div>
          <p className="text-sm leading-6 text-slate-600">
            Your most recent completed booking is ready for feedback. This link only appears for the stay you just finished.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Booking {context.bookingId.slice(0, 8).toUpperCase()}</span>
            <span>·</span>
            <span>Completed {formatDate(context.completedAt)}</span>
          </div>
          <Button variant="success" className="w-full sm:w-auto" onClick={() => router.push(reviewUrl)}>
            Leave a review
          </Button>
        </div>
      </div>
    </Card>
  );
}
