import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";
import type { ApiResponse } from "@zika/types";

// ── Shared query keys ──────────────────────────────────────────────────────────

export const REVIEW_QK = {
  listing: (listingId: string) => ["reviews", "listing", listingId] as const,
  listingInfinite: (listingId: string) => ["reviews", "listing-infinite", listingId] as const,
  me: ["reviews", "me"] as const,
  provider: (filters: ProviderReviewFilters) => ["reviews", "provider", filters] as const,
};

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  return anyErr?.response?.data?.error?.message ?? anyErr?.message ?? fallback;
}

// ── GET /listings/:id/reviews — public, paginated ──────────────────────────────
// Note: this endpoint only returns `guestId` (no name/avatar) — the reviewer's
// real name/photo simply isn't part of this API's response.

export interface ListingReview {
  id: string;
  guestId: string;
  rating: number;
  title: string | null;
  body: string | null;
  providerReply: string | null;
  providerRepliedAt: string | null;
  createdAt: string;
}

export interface ListingReviewsPage {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  averageRating: number | null;
  reviews: ListingReview[];
}

async function fetchListingReviews(listingId: string, page: number, limit: number): Promise<ListingReviewsPage> {
  const res = await listingApi.get<ApiResponse<ListingReviewsPage>>(`/listings/${listingId}/reviews`, {
    params: { page, limit },
  });
  if (!res.data.success) throw res.data;
  return res.data.data;
}

// Single page — used for the "latest 3 reviews" preview on a listing's detail page.
export function useListingReviews(listingId: string | null | undefined, limit = 3) {
  return useQuery<ListingReviewsPage>({
    queryKey: [...REVIEW_QK.listing(listingId ?? ""), limit],
    queryFn: () => fetchListingReviews(listingId as string, 1, limit),
    enabled: !!listingId,
    staleTime: 60_000,
  });
}

// Infinite/paginated — used by the dedicated "View All Reviews" screen.
export function useListingReviewsInfinite(listingId: string | null | undefined, pageSize = 10) {
  return useInfiniteQuery<ListingReviewsPage>({
    queryKey: REVIEW_QK.listingInfinite(listingId ?? ""),
    queryFn: ({ pageParam }) => fetchListingReviews(listingId as string, pageParam as number, pageSize),
    enabled: !!listingId,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 60_000,
  });
}

// ── GET /reviews/me — the guest's own submitted reviews ────────────────────────

export interface MyReview {
  id: string;
  listingId: string;
  listingName: string;
  bookingId: string;
  rating: number;
  title: string | null;
  body: string | null;
  providerReply: string | null;
  providerRepliedAt: string | null;
  isHidden: boolean;
  createdAt: string;
}

export function useMyReviews(enabled = true) {
  return useQuery<MyReview[]>({
    queryKey: REVIEW_QK.me,
    queryFn: async () => {
      const res = await listingApi.get<ApiResponse<{ reviews: MyReview[] }>>("/reviews/me");
      if (!res.data.success) throw res.data;
      return res.data.data.reviews;
    },
    enabled,
    staleTime: 30_000,
  });
}

// The booking-detail endpoint (GET /guests/me/bookings/:id) doesn't actually
// return a hasReview/reviewId flag, so "has this booking already been
// reviewed?" is derived here from the guest's own review list instead.
// Reviews are account-scoped, so pass enabled={false} for anonymous sessions.
export function useReviewedBookingIds(enabled = true): Set<string> {
  const { data } = useMyReviews(enabled);
  return new Set((data ?? []).map((r) => r.bookingId));
}

// ── POST /reviews — submit a review for a completed booking ───────────────────

export interface SubmitReviewPayload {
  bookingId: string;
  rating: number;
  title?: string;
  body?: string;
}

export function useSubmitReview(listingId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SubmitReviewPayload) => {
      const res = await listingApi.post<ApiResponse<{ reviewId: string; message: string }>>("/reviews", payload);
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: (_result, payload) => {
      void qc.invalidateQueries({ queryKey: REVIEW_QK.me });
      void qc.invalidateQueries({ queryKey: ["booking", payload.bookingId] });
      if (listingId) {
        void qc.invalidateQueries({ queryKey: REVIEW_QK.listing(listingId) });
        void qc.invalidateQueries({ queryKey: REVIEW_QK.listingInfinite(listingId) });
      }
    },
  });
}

// ── GET /provider/reviews — provider-wide reviews inbox ────────────────────────

export interface ProviderReview {
  id: string;
  listingId: string;
  listingName: string;
  listingCategory: string;
  bookingReference: string;
  guestName: string;
  rating: number;
  title: string | null;
  body: string | null;
  providerReply: string | null;
  providerRepliedAt: string | null;
  createdAt: string;
}

export interface ProviderReviewDistributionRow {
  rating: number;
  count: number;
}

export interface ProviderReviewsResponse {
  total: number;
  offset: number;
  limit: number;
  averageRating: number | null;
  totalReviews: number;
  distribution: ProviderReviewDistributionRow[];
  reviews: ProviderReview[];
}

export interface ProviderReviewFilters {
  offset?: number;
  limit?: number;
  rating?: number;
  replied?: "yes" | "no";
}

export function useProviderReviews(filters: ProviderReviewFilters = {}) {
  return useQuery<ProviderReviewsResponse>({
    queryKey: REVIEW_QK.provider(filters),
    queryFn: async () => {
      const res = await listingApi.get<ApiResponse<ProviderReviewsResponse>>("/provider/reviews", {
        params: filters,
      });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

// ── POST /reviews/:id/reply — provider replies to a review ────────────────────
// The backend only returns { message } — no updated review — so callers merge
// the reply into their own cache optimistically after success.

export function useReplyToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      const res = await listingApi.post<ApiResponse<{ message: string }>>(`/reviews/${reviewId}/reply`, { reply });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    // Optimistically patch every cached review list (provider inbox + any
    // listing review pages) so the reply shows immediately, since the API
    // only returns { message } — no updated review to swap in from the response.
    onMutate: async ({ reviewId, reply }) => {
      await qc.cancelQueries({ queryKey: ["reviews"] });
      const snapshots = qc.getQueriesData<any>({ queryKey: ["reviews"] });
      const now = new Date().toISOString();

      const patchReview = (r: any) =>
        r?.id === reviewId ? { ...r, providerReply: reply, providerRepliedAt: now } : r;

      for (const [key, data] of snapshots) {
        if (!data) continue;
        if (Array.isArray(data.reviews)) {
          qc.setQueryData(key, { ...data, reviews: data.reviews.map(patchReview) });
        } else if (Array.isArray(data.pages)) {
          qc.setQueryData(key, {
            ...data,
            pages: data.pages.map((p: any) => ({ ...p, reviews: p.reviews?.map(patchReview) })),
          });
        } else if (Array.isArray(data)) {
          qc.setQueryData(key, data.map(patchReview));
        }
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([key, data]: [readonly unknown[], unknown]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}

export { extractErrorMessage as extractReviewErrorMessage };
