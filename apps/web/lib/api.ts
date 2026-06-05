import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

const TOKEN_KEY = "zika:access_token";
const AUTH_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.kainook.com";

function attachTokenInterceptor(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

function attachRefreshInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (r) => r,
    async (err) => {
      const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (err.response?.status === 401 && !original._retry && typeof window !== "undefined") {
        original._retry = true;

        try {
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
            const { useAuthStore } = await import("@/stores/auth");
            const user = useAuthStore.getState().user;
            if (user) useAuthStore.getState().setSession(newToken, user);

            original.headers = {
              ...original.headers,
              Authorization: `Bearer ${newToken}`,
            };
            return instance(original);
          }
        } catch {
          // refresh failed — fall through to clear session
        }

        sessionStorage.removeItem(TOKEN_KEY);
        try {
          const { useAuthStore } = await import("@/stores/auth");
          useAuthStore.getState().clearSession();
        } catch { /* ignore */ }

        setTimeout(() => { window.location.href = "/auth/login"; }, 100);
      }

      return Promise.reject(err);
    },
  );
}

function createClient(baseURL: string, timeout = 15_000): AxiosInstance {
  const instance = axios.create({ baseURL, withCredentials: true, timeout });
  attachTokenInterceptor(instance);
  attachRefreshInterceptor(instance);
  return instance;
}

// Auth service client
export const api = createClient(AUTH_BASE);

// Listing service client
export const listingApi = createClient(
  process.env.NEXT_PUBLIC_LISTING_API_URL || "https://api.kainook.com/listings",
  30_000,
);

// Payment service client
export const paymentApi = createClient(
  process.env.NEXT_PUBLIC_PAYMENT_API_URL || "https://api.kainook.com/payments",
  30_000,
);

export function storeToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}
