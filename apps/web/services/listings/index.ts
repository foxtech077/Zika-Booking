import { listingApi } from "@/lib/listing-api";
import type { DashboardData } from "@/types/provider";

// ── Response types ─────────────────────────────────────────────────────────────

export interface PresignedUploadResult {
  uploadUrl: string;
  s3Key: string;
}

export interface PhotoResult {
  id: string;
  cdnUrl: string;
  thumbUrl?: string | null;
  position: number;
}

export interface ListingSummaryItem {
  id: string;
  name: string | null;
  category: string;
  status: string;
  bookingCount: number;
  totalRevenue: number;
  currency: string | null;
  averageRating: number | null;
  reviewCount: number;
}

export interface AvailabilityResult {
  listingId: string;
  bookedRanges: Array<{
    id: string;
    reference: string;
    start: string | null;
    end: string | null;
    status: string;
    guestName: string;
    type: "booking";
  }>;
  blockedRanges: Array<{
    id: string;
    start: string;
    end: string;
    summary: string | null;
    platform: string;
    type: "ical_block";
  }>;
}

// ── Service ────────────────────────────────────────────────────────────────────

export const listingsService = {
  // ── CRUD ────────────────────────────────────────────────────────────────────
  list: (params: Record<string, string>) =>
    listingApi
      .get(`/listings?${new URLSearchParams(params)}`)
      .then((r) => r.data.data ?? r.data),

  get: (id: string) =>
    listingApi.get(`/listings/${id}`).then((r) => r.data.data ?? r.data),

  create: (category: string): Promise<{ id: string; category: string; status: string }> =>
    listingApi
      .post("/listings", { category })
      .then((r) => r.data.data ?? r.data),

  update: (id: string, payload: Record<string, unknown>) =>
    listingApi
      .patch(`/listings/${id}`, payload)
      .then((r) => r.data.data ?? r.data),

  submit: (id: string) =>
    listingApi.post(`/listings/${id}/submit`).then((r) => r.data.data ?? r.data),

  activate: (id: string) =>
    listingApi.post(`/listings/${id}/activate`).then((r) => r.data.data ?? r.data),

  deactivate: (id: string) =>
    listingApi.post(`/listings/${id}/deactivate`).then((r) => r.data.data ?? r.data),

  reactivate: (id: string) =>
    listingApi.post(`/listings/${id}/reactivate`).then((r) => r.data.data ?? r.data),

  remove: (id: string) =>
    listingApi.delete(`/listings/${id}`).then((r) => r.data),

  // ── Photos ─────────────────────────────────────────────────────────────────
  presignPhoto: (
    listingId: string,
    contentType: string,
    filename: string,
    variant: "photo" | "thumbnail" = "photo",
    fileSize?: number,
  ): Promise<PresignedUploadResult> =>
    listingApi
      .post(`/listings/${listingId}/photos/presign`, { contentType, filename, variant, fileSize })
      .then((r) => r.data.data ?? r.data),

  confirmPhoto: (
    listingId: string,
    s3Key: string,
    thumbS3Key?: string,
  ): Promise<PhotoResult> =>
    listingApi
      .post(`/listings/${listingId}/photos/confirm`, { s3Key, thumbS3Key })
      .then((r) => r.data.data ?? r.data),

  deletePhoto: (listingId: string, photoId: string) =>
    listingApi
      .delete(`/listings/${listingId}/photos/${photoId}`)
      .then((r) => r.data),

  reorderPhotos: (listingId: string, order: string[]) =>
    listingApi
      .patch(`/listings/${listingId}/photos/reorder`, { order })
      .then((r) => r.data),

  // ── Documents ──────────────────────────────────────────────────────────────
  presignDocument: (
    listingId: string,
    contentType: string,
    documentType: string,
  ): Promise<PresignedUploadResult> =>
    listingApi
      .post(`/listings/${listingId}/documents/presign`, { contentType, documentType })
      .then((r) => r.data.data ?? r.data),

  confirmDocument: (
    listingId: string,
    s3Key: string,
    documentType: string,
    contentType: string,
  ) =>
    listingApi
      .post(`/listings/${listingId}/documents/confirm`, {
        s3Key,
        documentType,
        contentType,
      })
      .then((r) => r.data.data ?? r.data),

  // ── Provider analytics ─────────────────────────────────────────────────────
  getDashboard: (): Promise<DashboardData> =>
    listingApi.get("/provider/dashboard").then((r) => r.data.data ?? r.data),

  getSummary: (): Promise<{ listings: ListingSummaryItem[] }> =>
    listingApi.get("/provider/listings/summary").then((r) => r.data.data ?? r.data),

  getAvailability: (
    listingId: string,
    from?: string,
    to?: string,
  ): Promise<AvailabilityResult> => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return listingApi
      .get(`/provider/availability/${listingId}?${qs}`)
      .then((r) => r.data.data ?? r.data);
  },
};
