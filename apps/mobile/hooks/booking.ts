import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";
import { paymentApi } from "../lib/payment-api";
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
  paymentDisplayId: (paymentId: string) => ["payments", "display-id", paymentId] as const,
};

// ── Booking detail ────────────────────────────────────────────────────────────

export function useBooking(id: string | undefined) {
  return useQuery<BookingDetail>({
    queryKey: BOOKING_QK.detail(id ?? ""),
    queryFn: async () => {
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
      const res = await listingApi.get<ApiResponse<Receipt>>(
        `/guests/me/bookings/${bookingId}/receipt`
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: Receipt }).data;
    },
    enabled: !!bookingId,
    staleTime: 5 * 60_000,
  });
}

// ── Payment display ID ────────────────────────────────────────────────────────
// The receipt endpoint (listing-service) only carries the raw payment UUID —
// the human-readable `PAYXXXXX-CC` reference lives in the payment-service DB,
// which listing-service has no access to. Web resolves it from the payment
// response at checkout time; on mobile we look it up from the booking's stored
// payment UUID instead, so receipts opened later still show it.
//
// Never surfaces an error: on any failure the caller falls back to the UUID.

export function usePaymentDisplayId(paymentId: string | null | undefined) {
  return useQuery<string | null>({
    queryKey: BOOKING_QK.paymentDisplayId(paymentId ?? ""),
    queryFn: async () => {
      try {
        const res = await paymentApi.get<ApiResponse<{ displayId: string | null }>>(
          `/payments/${paymentId}/status`
        );
        if (!res.data.success) return null;
        return (res.data as { success: true; data: { displayId: string | null } }).data.displayId ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!paymentId,
    staleTime: Infinity, // a payment's display ID never changes once assigned
    retry: false,
  });
}

// ── QR Code ───────────────────────────────────────────────────────────────────

export function useQRCode(bookingId: string | undefined) {
  return useQuery<QRCodeData>({
    queryKey: BOOKING_QK.qrCode(bookingId ?? ""),
    queryFn: async () => {
      const res = await listingApi.get<ApiResponse<QRCodeData>>(
        `/guests/me/bookings/${bookingId}/qr-code`
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: QRCodeData }).data;
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
      const res = await listingApi.get<ApiResponse<VoucherPdf>>(
        `/guests/me/bookings/${bookingId}/voucher-pdf`
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: VoucherPdf }).data;
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
      await listingApi.post(`/bookings/${bookingId}/cancel`, { reasonCode: reason ?? "guest_cancelled" });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: BOOKING_QK.detail(bookingId) });
      void qc.invalidateQueries({ queryKey: BOOKING_QK.all });
    },
  });
}

// ── Bind commission ───────────────────────────────────────────────────────────

export function useBindCommission(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commissionCode: string) => {
      await listingApi.patch(`/guests/me/bookings/${bookingId}/bind-commission`, {
        commissionCode,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: BOOKING_QK.detail(bookingId) });
    },
  });
}

// ── Lock release ──────────────────────────────────────────────────────────────

export function useReleaseLock() {
  return useMutation({
    mutationFn: async (lockToken: string) => {
      await listingApi.delete(`/bookings/lock/${lockToken}`);
    },
    onError: () => {
      // Lock release failure is non-critical — lock auto-expires in 5 min
    },
  });
}
