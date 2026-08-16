import axios from "axios";
import { useAuthStore } from "../store/auth";
import { getCachedAnonymousToken } from "./anonymous";
import { getListingBaseUrl, getAuthBaseUrl } from "./config";

const LISTING_BASE_URL = getListingBaseUrl();

export const listingApi = axios.create({
  baseURL: LISTING_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
});

// Endpoints that return localized prices when given a `currency` query param.
// Scoped deliberately: attaching it to every listing-service call would send a
// meaningless param to booking, provider and upload routes.
const LOCALIZED_PRICE_ENDPOINTS = /(^|\/)(search|listings\/[^/]+\/public|guests\/me\/favourites|guests\/me\/recently-viewed)(\?|$)/;

listingApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Anonymous checkout: only ever a fallback, so a signed-in user can never
    // have their account token displaced by a leftover anonymous one.
    const anon = getCachedAnonymousToken();
    if (anon) {
      config.headers.Authorization = `Bearer ${anon}`;
      (config as any)._anon = true;
    }
  }

  // Ask for prices in the guest's local currency. Several screens build their
  // URLs as template strings rather than a params object, so doing this here
  // covers search, browse, home carousels and listing detail in one place.
  const url = config.url ?? "";
  if ((config.method ?? "get").toLowerCase() === "get" && LOCALIZED_PRICE_ENDPOINTS.test(url)) {
    const currency = useAuthStore.getState().localCurrency;
    const alreadySet = url.includes("currency=") || (config.params as any)?.currency;
    if (currency && !alreadySet) {
      config.params = { ...(config.params ?? {}), currency };
    }
  }

  const fullUrl = `${config.baseURL ?? LISTING_BASE_URL}${config.url ?? ""}`;
  console.log(`[LISTING-API] ▶ ${(config.method ?? "GET").toUpperCase()} ${fullUrl}`);
  if (config.data) console.log("[LISTING-API] Request body:", JSON.stringify(config.data, null, 2));
  return config;
});

function _listingErrorLogger(error: any): void {
  const config = error.config ?? {};
  const fullUrl = `${config.baseURL ?? LISTING_BASE_URL}${config.url ?? ""}`;
  console.log(`[LISTING-API] ❌ ERROR on ${(config.method ?? "GET").toUpperCase()} ${fullUrl}`);
  console.log("[LISTING-API] HTTP status:", error?.response?.status);
  console.log("[LISTING-API] Response body:", JSON.stringify(error?.response?.data, null, 2));
  console.log("[LISTING-API] Error message:", error?.message);
}

const AUTH_BASE_URL = getAuthBaseUrl();

const ACCOUNT_CODES = ["ACCOUNT_BANNED", "ACCOUNT_SUSPENDED", "ACCOUNT_INACTIVE", "INVALID_SESSION", "SESSION_EXPIRED"];

function isAccountRevoked(error: unknown): boolean {
  const res = (error as any)?.response;
  if (!res) return false;
  const code: string = res.data?.error?.code ?? "";
  return res.status === 403 && ACCOUNT_CODES.includes(code);
}

let refreshing: Promise<void> | null = null;
listingApi.interceptors.response.use(
  (res) => {
    const fullUrl = `${res.config.baseURL ?? LISTING_BASE_URL}${res.config.url ?? ""}`;
    console.log(`[LISTING-API] ✅ ${res.status} ${fullUrl}`);
    return res;
  },
  async (error) => {
    _listingErrorLogger(error);

    if (isAccountRevoked(error)) {
      await useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    const original = error.config as (typeof error.config) & { _retry?: boolean; _anon?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      // Anonymous tokens are stateless with no refresh cookie, so refreshing is
      // guaranteed to fail — and the failure path calls clearAuth(), which
      // would wipe an unrelated signed-in session. Let the caller handle it.
      if (original._anon) return Promise.reject(error);
      original._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          try {
            // AUTH_BASE_URL ends with "/" — a leading slash here produced
            // ".../auth//auth/refresh", which the gateway 404s. That made every
            // expired token unrecoverable: refresh failed, clearAuth() logged
            // the user out, and the original request surfaced as a save error.
            const res = await axios.post(`${AUTH_BASE_URL}auth/refresh`, {}, { withCredentials: true });
            const token = (res.data as any).data.tokens.accessToken;
            // Prefer the refreshed user object; reusing the cached one keeps
            // server-side changes (hostStatus especially) out of the store.
            const refreshedUser = (res.data as any).data.user;
            const nextUser = refreshedUser ?? useAuthStore.getState().user;
            if (nextUser) await useAuthStore.getState().setAuth(nextUser, token);
          } catch {
            await useAuthStore.getState().clearAuth();
          } finally {
            refreshing = null;
          }
        })();
      }
      await refreshing;
      const newToken = useAuthStore.getState().accessToken;
      if (!newToken) return Promise.reject(error);
      original.headers.Authorization = `Bearer ${newToken}`;
      return listingApi(original);
    }
    return Promise.reject(error);
  },
);

// Upload a file directly to S3 using a presigned URL
export async function uploadToS3(presignedUrl: string, fileUri: string, contentType: string): Promise<void> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const upload = await fetch(presignedUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  if (!upload.ok) throw new Error(`S3 upload failed: ${upload.status}`);
}
