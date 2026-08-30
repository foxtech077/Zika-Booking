import axios from "axios";
import { useAuthStore } from "../store/auth";

import { getAuthBaseUrl } from "./config";
import { refreshAccessToken } from "./token-refresh";

export const BASE_URL = getAuthBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15_000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const fullUrl = `${config.baseURL ?? BASE_URL}${config.url ?? ""}`;
  console.log(`[AUTH-API] ▶ ${(config.method ?? "GET").toUpperCase()} ${fullUrl}`);
  if (config.data) console.log("[AUTH-API] Request body:", JSON.stringify(config.data, null, 2));
  return config;
});

const ACCOUNT_CODES = ["ACCOUNT_BANNED", "ACCOUNT_SUSPENDED", "ACCOUNT_INACTIVE", "INVALID_SESSION", "SESSION_EXPIRED"];

function isAccountRevoked(error: unknown): boolean {
  const res = (error as any)?.response;
  if (!res) return false;
  const code: string = res.data?.error?.code ?? "";
  return res.status === 403 && ACCOUNT_CODES.includes(code);
}

// On 401, try to refresh then retry once — via the shared singleton so that
// concurrent 401s across all three clients issue only ONE refresh request.
// On 403 with account-revocation codes, clear auth immediately.
api.interceptors.response.use(
  (res) => {
    const fullUrl = `${res.config.baseURL ?? BASE_URL}${res.config.url ?? ""}`;
    console.log(`[AUTH-API] ✅ ${res.status} ${fullUrl}`);
    return res;
  },
  async (error) => {
    const config = error.config ?? {};
    const fullUrl = `${config.baseURL ?? BASE_URL}${config.url ?? ""}`;
    console.log(`[AUTH-API] ❌ ERROR on ${(config.method ?? "GET").toUpperCase()} ${fullUrl}`);
    console.log("[AUTH-API] HTTP status:", error?.response?.status);
    console.log("[AUTH-API] Response body:", JSON.stringify(error?.response?.data, null, 2));
    console.log("[AUTH-API] Error message:", error?.message);

    if (isAccountRevoked(error)) {
      await useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (!newToken) return Promise.reject(error);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
    return Promise.reject(error);
  },
);
