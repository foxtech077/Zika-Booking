import axios from "axios";
import { useAuthStore } from "../store/auth";

const getListingBaseUrl = () => {
  const envUrl = process.env["EXPO_PUBLIC_LISTING_API_URL"];
  if (envUrl) return envUrl;
  return "https://api.kainook.com/listings";
};

const LISTING_BASE_URL = getListingBaseUrl();

export const listingApi = axios.create({
  baseURL: LISTING_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
});

// Endpoints that return localized prices when given a `currency` query param.
// Scoped deliberately: attaching it to every listing-service call would send a
// meaningless param to booking, provider and upload routes.
const LOCALIZED_PRICE_ENDPOINTS = /(^|\/)(search|listings\/[^/]+\/public)(\?|$)/;

listingApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;

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

const getAuthBaseUrl = () => {
  const envUrl = process.env["EXPO_PUBLIC_AUTH_API_URL"];
  if (envUrl) return envUrl;
  return "https://api.kainook.com/auth";
};

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

    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const res = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
            const token = (res.data as any).data.tokens.accessToken;
            const { user } = useAuthStore.getState();
            if (user) await useAuthStore.getState().setAuth(user, token);
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
