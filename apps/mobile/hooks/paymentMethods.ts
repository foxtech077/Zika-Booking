import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentApi } from "../lib/payment-api";
import type {
  SavedPaymentMethod,
  StripeSetupIntentResponse,
  StripeSetupConfirmPayload,
  AddTaraPayload,
} from "../lib/types/booking";
import type { ApiResponse } from "@zika/types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const PAYMENT_QK = {
  methods: ["payment-methods"] as const,
};

// ── Saved payment methods ─────────────────────────────────────────────────────

export function useSavedPaymentMethods() {
  return useQuery<SavedPaymentMethod[]>({
    queryKey: PAYMENT_QK.methods,
    queryFn: async () => {
      console.log("[PAYMENT_HOOK] Fetching saved payment methods");
      const res = await paymentApi.get<{ success: boolean; data: { paymentMethods: SavedPaymentMethod[] } }>(
        "/guests/me/payment-methods"
      );
      if (!res.data.success) throw res.data;
      return res.data.data.paymentMethods ?? [];
    },
    staleTime: 60_000,
  });
}

// ── Delete payment method ─────────────────────────────────────────────────────

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (methodId: string) => {
      console.log("[PAYMENT_HOOK] Deleting payment method:", methodId);
      await paymentApi.delete(`/guests/me/payment-methods/${methodId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAYMENT_QK.methods });
    },
  });
}

// ── Set default payment method ────────────────────────────────────────────────

export function useSetDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (methodId: string) => {
      console.log("[PAYMENT_HOOK] Setting default payment method:", methodId);
      await paymentApi.patch(`/guests/me/payment-methods/${methodId}`, {
        isDefault: true,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAYMENT_QK.methods });
    },
  });
}

// ── Stripe setup intent ───────────────────────────────────────────────────────

export function useStripeSetupIntent() {
  return useMutation({
    mutationFn: async (): Promise<StripeSetupIntentResponse> => {
      console.log("[PAYMENT_HOOK] Creating Stripe setup intent");
      const res = await paymentApi.post<ApiResponse<StripeSetupIntentResponse>>(
        "/guests/me/payment-methods/stripe/setup"
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: StripeSetupIntentResponse }).data;
    },
  });
}

// ── Stripe setup confirm ──────────────────────────────────────────────────────

export function useStripeSetupConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StripeSetupConfirmPayload): Promise<SavedPaymentMethod> => {
      console.log("[PAYMENT_HOOK] Confirming Stripe setup with paymentMethodId:", payload.paymentMethodId);
      const res = await paymentApi.post<ApiResponse<SavedPaymentMethod>>(
        "/guests/me/payment-methods/stripe/confirm",
        payload
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: SavedPaymentMethod }).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAYMENT_QK.methods });
    },
  });
}

// ── Add Tara account ──────────────────────────────────────────────────────────

export function useAddTaraAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddTaraPayload): Promise<SavedPaymentMethod> => {
      console.log("[PAYMENT_HOOK] Adding Tara account:", payload.mobileNumber);
      const res = await paymentApi.post<ApiResponse<SavedPaymentMethod>>(
        "/guests/me/payment-methods/tara",
        payload
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: SavedPaymentMethod }).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAYMENT_QK.methods });
    },
  });
}
