import axios from "axios";

const TOKEN_KEY = "zika:access_token";

export const listingApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_LISTING_API_URL || "https://api.kainook.com/listings",
  withCredentials: true,
  timeout: 30_000,
});

// Attach token on every request
listingApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Silent token refresh on 401 — retry the original request once with the new token.
// The refresh token is stored as an HTTP-only cookie (sent automatically via withCredentials).
listingApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry && typeof window !== "undefined") {
      original._retry = true;

      try {
        const AUTH_BASE =
          process.env.NEXT_PUBLIC_API_URL || "https://api.kainook.com";

        // POST /auth/refresh — refresh cookie is sent automatically (withCredentials)
        const refresh = await axios.post(
          `${AUTH_BASE}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newToken: string | undefined =
          refresh.data?.data?.tokens?.accessToken ??
          refresh.data?.data?.accessToken;

        if (newToken) {
          sessionStorage.setItem(TOKEN_KEY, newToken);
          // Update Zustand store so the UI reflects the new session
          const { useAuthStore } = await import("@/stores/auth");
          const user = useAuthStore.getState().user;
          if (user) useAuthStore.getState().setSession(newToken, user);

          // Retry the original request with the fresh token
          original.headers = {
            ...original.headers,
            Authorization: `Bearer ${newToken}`,
          };
          return listingApi(original);
        }
      } catch {
        // Refresh failed — clear session and let the caller handle the 401
      }

      // Both access token and refresh token expired — full session gone.
      // Clear local session and redirect to login so the user re-authenticates.
      sessionStorage.removeItem(TOKEN_KEY);
      try {
        const { useAuthStore } = await import("@/stores/auth");
        useAuthStore.getState().clearSession();
      } catch { /* store import failed — session storage already cleared */ }

      if (typeof window !== "undefined") {
        // Small delay so any in-flight state updates can complete
        setTimeout(() => { window.location.href = "/auth/login"; }, 100);
      }
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
