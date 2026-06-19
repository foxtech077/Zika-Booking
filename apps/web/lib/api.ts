import axios from "axios";

const TOKEN_KEY = "zika:access_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 15_000,
});

// Attach the access token on every outgoing request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Silent token refresh on 401 — mirrors the same logic in listing-api.ts so
// both axios instances behave consistently and neither triggers a premature logout.
api.interceptors.response.use(
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
          // Persist to both storage locations
          sessionStorage.setItem(TOKEN_KEY, newToken);
          localStorage.setItem(TOKEN_KEY, newToken);

          // Keep Zustand store in sync
          const { useAuthStore } = await import("@/stores/auth");
          const user = useAuthStore.getState().user;
          if (user) useAuthStore.getState().setSession(newToken, user);

          // Retry the original request with the fresh token
          original.headers = {
            ...original.headers,
            Authorization: `Bearer ${newToken}`,
          };
          return api(original);
        }
      } catch {
        // Refresh failed — fall through to full logout below
      }

      // Both access token and refresh token expired — clear session and redirect.
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

export function storeToken(token: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}
