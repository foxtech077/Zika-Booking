import axios from "axios";

const TOKEN_KEY = "zika:access_token";

export const paymentApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PAYMENT_API_URL,
  withCredentials: true,
  timeout: 30_000,
});

// Attach token on every request — checks sessionStorage first, then falls back to localStorage
paymentApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token =
      sessionStorage.getItem(TOKEN_KEY) ??
      localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Silent token refresh on 401 — retry the original request once with the new token
paymentApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry && typeof window !== "undefined") {
      original._retry = true;

      try {
        // POST /api/auth/refresh — refresh cookie is sent automatically (withCredentials)
        const refresh = await axios.post(
          `/api/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newToken: string | undefined =
          refresh.data?.data?.tokens?.accessToken ??
          refresh.data?.data?.accessToken ??
          refresh.data?.tokens?.accessToken ??
          refresh.data?.accessToken;

        if (newToken) {
          sessionStorage.setItem(TOKEN_KEY, newToken);
          localStorage.setItem(TOKEN_KEY, newToken);

          // Update Zustand store so the UI reflects the new session
          const { useAuthStore } = await import("@/stores/auth");
          const user = useAuthStore.getState().user;
          if (user) useAuthStore.getState().setSession(newToken, user);

          // Retry the original request with the fresh token
          original.headers = {
            ...original.headers,
            Authorization: `Bearer ${newToken}`,
          };
          return paymentApi(original);
        }
      } catch {
        // Refresh failed — fall through to clear session below
      }

      // Clear local session and redirect to login
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      try {
        const { useAuthStore } = await import("@/stores/auth");
        useAuthStore.getState().clearSession();
      } catch { /* store import failed */ }

      if (typeof window !== "undefined") {
        setTimeout(() => { window.location.href = "/auth/login"; }, 100);
      }
    }

    return Promise.reject(err);
  },
);

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName: string | null;
  country: string | null;
  payoutMethod: "stripe_connect" | "mobile_money" | "bank_transfer" | "manual";
  stripeConnectAccountId: string | null;
  mobileMoneyNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payout {
  id: string;
  merchantId: string;
  bookingId: string;
  providerId: string;
  amount: number | string;
  currency: string;
  status: "scheduled" | "processing" | "paid" | "failed" | "cancelled";
  scheduledAt: string;
  processedAt: string | null;
  providerPayoutId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  merchant?: {
    payoutMethod: string;
    isVerified: boolean;
  };
}

export interface StripeConnectStatusResponse {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  payoutMethod: string | null;
}

export interface StripeConnectOnboardingResponse {
  onboardingUrl: string;
}

export interface PayoutListResponse {
  success: boolean;
  data: Payout[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SinglePayoutResponse {
  success: boolean;
  data: Payout;
}

export interface MerchantProfileResponse {
  success: boolean;
  data: MerchantProfile;
}

// ─── API Helper Functions ────────────────────────────────────────────────────

export async function getMerchantProfile(): Promise<MerchantProfileResponse> {
  const res = await paymentApi.get<MerchantProfileResponse>("/merchant/me");
  return res.data;
}

export async function updateMerchantProfile(
  body: Partial<Pick<MerchantProfile, "businessName" | "country" | "payoutMethod" | "stripeConnectAccountId" | "mobileMoneyNumber" | "bankName" | "bankAccountNumber" | "bankAccountName">>
): Promise<MerchantProfileResponse> {
  const res = await paymentApi.patch<MerchantProfileResponse>("/merchant/me", body);
  return res.data;
}

export async function startStripeConnect(): Promise<{ success: boolean; data: StripeConnectOnboardingResponse }> {
  const res = await paymentApi.post<{ success: boolean; data: StripeConnectOnboardingResponse }>("/merchant/me/stripe/connect");
  return res.data;
}

export async function refreshStripeConnect(): Promise<{ success: boolean; data: StripeConnectOnboardingResponse }> {
  const res = await paymentApi.get<{ success: boolean; data: StripeConnectOnboardingResponse }>("/merchant/me/stripe/connect/refresh");
  return res.data;
}

export async function getStripeConnectStatus(): Promise<{ success: boolean; data: StripeConnectStatusResponse }> {
  const res = await paymentApi.get<{ success: boolean; data: StripeConnectStatusResponse }>("/merchant/me/stripe/connect/status");
  return res.data;
}

export async function getPayouts(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PayoutListResponse> {
  const res = await paymentApi.get<PayoutListResponse>("/provider/me/payouts", { params });
  return res.data;
}

export async function getPayoutDetail(id: string): Promise<SinglePayoutResponse> {
  const res = await paymentApi.get<SinglePayoutResponse>(`/provider/me/payouts/${id}`);
  return res.data;
}

