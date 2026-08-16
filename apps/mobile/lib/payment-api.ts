import axios from "axios";
import { useAuthStore } from "../store/auth";
import { getCachedAnonymousToken } from "./anonymous";
import { payLog } from "./payment-logger";
import { getPaymentBaseUrl, getAuthBaseUrl } from "./config";

const PAYMENT_BASE_URL = getPaymentBaseUrl();
const AUTH_BASE_URL = getAuthBaseUrl();

export const paymentApi = axios.create({
  baseURL: PAYMENT_BASE_URL,
  timeout: 30_000,
});

paymentApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Anonymous checkout must be able to pay. Fallback only, so an account
    // token always wins.
    const anon = getCachedAnonymousToken();
    if (anon) {
      config.headers.Authorization = `Bearer ${anon}`;
      (config as any)._anon = true;
    }
  }
  const fullUrl = `${config.baseURL ?? PAYMENT_BASE_URL}${config.url ?? ""}`;
  const method = (config.method ?? "GET").toUpperCase();
  console.log(`[PAYMENT-API] ▶ ${method} ${fullUrl}`);
  if (config.data) console.log("[PAYMENT-API] Request body:", JSON.stringify(config.data, null, 2));
  payLog("info", "PAYMENT-API", `${method} ${fullUrl}`, config.data ?? undefined);
  return config;
});

const ACCOUNT_CODES = ["ACCOUNT_BANNED", "ACCOUNT_SUSPENDED", "ACCOUNT_INACTIVE", "INVALID_SESSION", "SESSION_EXPIRED"];

function isAccountRevoked(error: unknown): boolean {
  const res = (error as any)?.response;
  if (!res) return false;
  const code: string = res.data?.error?.code ?? "";
  return res.status === 403 && ACCOUNT_CODES.includes(code);
}

let refreshing: Promise<void> | null = null;

paymentApi.interceptors.response.use(
  (res) => {
    const fullUrl = `${res.config.baseURL ?? PAYMENT_BASE_URL}${res.config.url ?? ""}`;
    console.log(`[PAYMENT-API] ✅ ${res.status} ${fullUrl}`);
    payLog("success", "PAYMENT-API", `${res.status} ${fullUrl}`, res.data ?? undefined);
    return res;
  },
  async (error) => {
    const config = error.config ?? {};
    const fullUrl = `${config.baseURL ?? PAYMENT_BASE_URL}${config.url ?? ""}`;
    const method = (config.method ?? "GET").toUpperCase();
    const httpStatus: number | undefined = error?.response?.status;
    const responseBody = error?.response?.data;

    console.log(`[PAYMENT-API] ❌ ERROR on ${method} ${fullUrl}`);
    console.log("[PAYMENT-API] HTTP status:", httpStatus);
    console.log("[PAYMENT-API] Response body:", JSON.stringify(responseBody, null, 2));
    console.log("[PAYMENT-API] Error message:", error?.message);

    payLog("error", "PAYMENT-API", `${method} ${fullUrl} → HTTP ${httpStatus ?? "network_error"}`, {
      httpStatus,
      responseBody,
      errorMessage: error?.message,
    });

    if (isAccountRevoked(error)) {
      payLog("error", "PAYMENT-API", "Account revoked — clearing auth");
      await useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    const original = error.config as (typeof error.config) & { _retry?: boolean; _anon?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      // Anonymous sessions have no refresh cookie; refreshing always fails and
      // its failure path clears an unrelated account session.
      if (original._anon) return Promise.reject(error);
      original._retry = true;
      payLog("warn", "PAYMENT-API", "401 received — attempting token refresh");
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const res = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
            const token = (res.data as any).data.tokens.accessToken;
            // Prefer the refreshed user object; reusing the cached one keeps
            // server-side changes (hostStatus especially) out of the store.
            const refreshedUser = (res.data as any).data.user;
            const nextUser = refreshedUser ?? useAuthStore.getState().user;
            if (nextUser) await useAuthStore.getState().setAuth(nextUser, token);
            payLog("success", "PAYMENT-API", "Token refresh succeeded — retrying original request");
          } catch {
            payLog("error", "PAYMENT-API", "Token refresh FAILED — clearing auth");
            await useAuthStore.getState().clearAuth();
          } finally {
            refreshing = null;
          }
        })();
      }
      await refreshing;
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
      }
      return paymentApi(original);
    }

    return Promise.reject(error);
  },
);
