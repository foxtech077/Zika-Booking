import axios from "axios";
import { useAuthStore } from "../store/auth";
import { payLog } from "./payment-logger";

const getPaymentBaseUrl = () => {
  const envUrl = process.env["EXPO_PUBLIC_PAYMENT_API_URL"];
  if (envUrl) return envUrl;
  return "https://api.kainook.com/payments";
};

const getAuthBaseUrl = () => {
  const envUrl = process.env["EXPO_PUBLIC_API_URL"];
  if (envUrl) return envUrl;
  return "https://api.kainook.com";
};

const PAYMENT_BASE_URL = getPaymentBaseUrl();
const AUTH_BASE_URL = getAuthBaseUrl();

export const paymentApi = axios.create({
  baseURL: PAYMENT_BASE_URL,
  timeout: 30_000,
});

paymentApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
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

    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      payLog("warn", "PAYMENT-API", "401 received — attempting token refresh");
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const res = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
            const token = (res.data as any).data.tokens.accessToken;
            const { user } = useAuthStore.getState();
            if (user) await useAuthStore.getState().setAuth(user, token);
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
