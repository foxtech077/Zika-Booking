import axios from "axios";
import { refreshAccessToken, clearAuthSession } from "@/lib/token-refresh";

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

// Silent token refresh on 401.  Uses the shared singleton so concurrent 401s
// across all three axios instances trigger only one refresh request.
paymentApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry && typeof window !== "undefined") {
      original._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return paymentApi(original);
      }

      clearAuthSession();
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
    payoutMethod: MerchantProfile["payoutMethod"];
    isVerified: boolean;
  };
}

export type PayoutStatus = Payout["status"];

export interface StripeConnectStatusResponse {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  payoutMethod: MerchantProfile["payoutMethod"];
}

export interface StripeConnectOnboardingResponse {
  onboardingUrl: string;
}

export interface ApiErrorResponse {
  message?: string;
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: ApiErrorResponse };
    message?: string;
  };

  return (
    err?.response?.data?.error?.message ??
    err?.response?.data?.message ??
    err?.message ??
    (error instanceof Error ? error.message : fallback)
  );
}

export function getStripeOnboardingUrl(response: { data?: { onboardingUrl?: unknown } } | null | undefined): string | null {
  const onboardingUrl = response?.data?.onboardingUrl;

  if (typeof onboardingUrl !== "string" || onboardingUrl.trim().length === 0) {
    return null;
  }

  try {
    return new URL(onboardingUrl).toString();
  } catch {
    return null;
  }
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

export async function getAllPayouts(params?: {
  status?: PayoutStatus;
  pageSize?: number;
}): Promise<Payout[]> {
  const limit = Math.max(1, Math.min(params?.pageSize ?? 100, 100));
  const firstPage = await getPayouts({
    page: 1,
    limit,
    ...(params?.status ? { status: params.status } : {}),
  });
  const payouts = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const nextPage = await getPayouts({
      page,
      limit,
      ...(params?.status ? { status: params.status } : {}),
    });
    payouts.push(...nextPage.data);
  }

  return payouts;
}

