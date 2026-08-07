import axios from "axios";
import { refreshAccessToken, clearAuthSession } from "@/lib/token-refresh";
import { getAnonymousToken, ensureAnonymousToken } from "@/lib/anonymous";

const TOKEN_KEY = "zika:access_token";

export const listingApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_LISTING_API_URL,
  withCredentials: true,
  timeout: 30_000,
});

// Attach token on every request — check sessionStorage first (fast path),
// then fall back to localStorage which persists across hard refresh / new tabs.
// When no account token exists, attach an anonymous checkout token if one has
// been minted (marked with _anon so the response interceptor never refreshes it).
listingApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token =
      sessionStorage.getItem(TOKEN_KEY) ??
      localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      const anon = getAnonymousToken();
      if (anon) {
        config.headers.Authorization = `Bearer ${anon}`;
        (config as any)._anon = true;
      }
    }
  }
  return config;
});

// Silent token refresh on 401.  Uses the shared singleton so concurrent 401s
// across all three axios instances trigger only one refresh request.
listingApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean; _anon?: boolean };

    if (err.response?.status === 401 && !original._retry && typeof window !== "undefined") {
      const hadAccountToken =
        sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);

      // Guest / anonymous-token request. The anonymous token is stateless with
      // no refresh cookie, and may be missing (a guest browsing before ever
      // starting a booking) or expired (30-min TTL). Re-mint it and retry once
      // so a stale anon token never surfaces as a hard 401 to the caller.
      if (!hadAccountToken || original._anon) {
        original._retry = true;
        const freshAnon = await ensureAnonymousToken();
        if (freshAnon) {
          original.headers = { ...original.headers, Authorization: `Bearer ${freshAnon}` };
          return listingApi(original);
        }
        return Promise.reject(err);
      }

      // Signed-in session: only a request that actually carried an account
      // token represents an expired session worth refreshing. Treating the
      // absence of a token as an expiry used to clear storage and hard-redirect
      // to /auth/login, which kicked logged-out visitors mid-browse.
      original._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return listingApi(original);
      }

      clearAuthSession();
    }

    return Promise.reject(err);
  },
);

export async function uploadToS3(presignedUrl: string, file: File): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
}
