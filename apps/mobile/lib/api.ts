import axios from "axios";
import type { PublicUser } from "@zika/types";
import { useAuthStore } from "../store/auth";

import { getAuthBaseUrl } from "./config";

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

// On 401, try to refresh then retry once.
// On 403 with account-revocation codes, clear auth immediately.
let refreshing: Promise<void> | null = null;
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
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const res = await axios.post(`${BASE_URL}auth/refresh`, {}, { withCredentials: true });
            const body = (res.data as {
              data: { tokens: { accessToken: string }; user?: PublicUser };
            }).data;
            const token = body.tokens.accessToken;
            // Prefer the user object the refresh returns. Reusing the cached
            // one kept server-side changes out of the app — hostStatus above
            // all, which is minted into the new token but would then disagree
            // with the stale copy in the store.
            const { user: cachedUser } = useAuthStore.getState();
            const nextUser = body.user ?? cachedUser;
            if (nextUser) await useAuthStore.getState().setAuth(nextUser, token);
          } catch {
            await useAuthStore.getState().clearAuth();
          } finally {
            refreshing = null;
          }
        })();
      }
      await refreshing;
      return api(original);
    }
    return Promise.reject(error);
  },
);
