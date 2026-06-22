import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";
import type {
  BookingDetail,
  BookingsResponse,
  Receipt,
  QRCodeData,
  VoucherPdf,
} from "../lib/types/booking";
import type { ApiResponse } from "@zika/types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const BOOKING_QK = {
  all:       ["bookings"] as const,
  list:      (status: string, cursor: number) => ["bookings", "list", status, cursor] as const,
  detail:    (id: string) => ["bookings", "detail", id] as const,
  receipt:   (id: string) => ["bookings", "receipt", id] as const,
  qrCode:    (id: string) => ["bookings", "qr-code", id] as const,
  voucher:   (id: string) => ["bookings", "voucher", id] as const,
};

// ── Booking detail ────────────────────────────────────────────────────────────

export function useBooking(id: string | undefined) {
  return useQuery<BookingDetail>({
    queryKey: BOOKING_QK.detail(id ?? ""),
    queryFn: async () => {
      console.log("[BOOKING_HOOK] Fetching booking detail:", id);
      const res = await listingApi.get<ApiResponse<BookingDetail>>(
        `/guests/me/bookings/${id}`
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: BookingDetail }).data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Booking list ──────────────────────────────────────────────────────────────

export function useBookings(status: string, cursor = 0) {
  return useQuery<BookingsResponse>({
    queryKey: BOOKING_QK.list(status, cursor),
    queryFn: async () => {
      console.log("[BOOKING_HOOK] Fetching bookings list — status:", status, "cursor:", cursor);
      const res = await listingApi.get<ApiResponse<BookingsResponse>>(
        `/guests/me/bookings?status=${status}&cursor=${cursor}`
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: BookingsResponse }).data;
    },
    staleTime: 30_000,
  });
}

// ── Receipt ───────────────────────────────────────────────────────────────────

export function useReceipt(bookingId: string | undefined) {
  return useQuery<Receipt>({
    queryKey: BOOKING_QK.receipt(bookingId ?? ""),
    queryFn: async () => {
      console.log("[RECEIPT] Fetching receipt for booking:", bookingId);
      const res = await listingApi.get<ApiResponse<Receipt>>(
        `/guests/me/bookings/${bookingId}/receipt`
      );
      console.log("[RECEIPT] Raw HTTP status:", res.status);
      console.log("[RECEIPT] Raw response:", JSON.stringify(res.data, null, 2));
      if (!res.data.success) throw res.data;
      const receipt = (res.data as { success: true; data: Receipt }).data;
      console.log("[RECEIPT] Parsed receipt:", JSON.stringify(receipt, null, 2));
      return receipt;
    },
    enabled: !!bookingId,
    staleTime: 5 * 60_000,
  });
}

// ── QR Code ───────────────────────────────────────────────────────────────────

export function useQRCode(bookingId: string | undefined) {
  return useQuery<QRCodeData>({
    queryKey: BOOKING_QK.qrCode(bookingId ?? ""),
    queryFn: async () => {
      console.log("[QR_CODE] Fetching QR code for booking:", bookingId);
      const res = await listingApi.get<ApiResponse<QRCodeData>>(
        `/guests/me/bookings/${bookingId}/qr-code`
      );
      console.log("[QR_CODE] Raw HTTP status:", res.status);
      console.log("[QR_CODE] Raw response:", JSON.stringify(res.data, null, 2));
      if (!res.data.success) throw res.data;
      const qr = (res.data as { success: true; data: QRCodeData }).data;
      console.log("[QR_CODE] qrCodeUrl:", qr.qrCodeUrl);
      console.log("[QR_CODE] bookingReference:", qr.bookingReference);
      console.log("[QR_CODE] expiresAt:", qr.expiresAt);
      return qr;
    },
    enabled: !!bookingId,
    staleTime: 5 * 60_000,
  });
}

// ── Voucher PDF ───────────────────────────────────────────────────────────────

export function useVoucherPdf(bookingId: string | undefined) {
  return useQuery<VoucherPdf>({
    queryKey: BOOKING_QK.voucher(bookingId ?? ""),
    queryFn: async () => {
      console.log("[VOUCHER] Fetching voucher PDF for booking:", bookingId);
      const res = await listingApi.get<ApiResponse<VoucherPdf>>(
        `/guests/me/bookings/${bookingId}/voucher-pdf`
      );
      console.log("[VOUCHER] Raw HTTP status:", res.status);
      console.log("[VOUCHER] Raw response:", JSON.stringify(res.data, null, 2));
      if (!res.data.success) throw res.data;
      const voucher = (res.data as { success: true; data: VoucherPdf }).data;
      console.log("[VOUCHER] voucherPdfUrl:", voucher.voucherPdfUrl);
      console.log("[VOUCHER] expiresAt:", voucher.expiresAt);
      return voucher;
    },
    enabled: !!bookingId,
    staleTime: 5 * 60_000,
  });
}

// ── Cancel booking ────────────────────────────────────────────────────────────

export function useCancelBooking(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string) => {
      console.log("[BOOKING_HOOK] Cancelling booking:", bookingId);
      await listingApi.post(`/bookings/${bookingId}/cancel`, reason ? { reason } : {});
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: BOOKING_QK.detail(bookingId) });
      void qc.invalidateQueries({ queryKey: BOOKING_QK.all });
    },
  });
}

// ── Lock release ──────────────────────────────────────────────────────────────

export function useReleaseLock() {
  return useMutation({
    mutationFn: async (lockToken: string) => {
      console.log("[BOOKING_HOOK] Releasing lock:", lockToken);
      await listingApi.delete(`/bookings/lock/${lockToken}`);
    },
    onError: (err: unknown) => {
      // Lock release failure is non-critical — lock auto-expires in 5 min
      console.warn("[BOOKING_HOOK] Lock release failed (non-critical):", err);
    },
  });
}
