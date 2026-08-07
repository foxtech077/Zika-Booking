import axios from "axios";
import { refreshAccessToken, clearAuthSession } from "@/lib/token-refresh";
import { clearAnonymousToken } from "@/lib/anonymous";

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

// Silent token refresh on 401.  Uses the shared singleton so concurrent 401s
// across all three axios instances trigger only one refresh request.
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry && typeof window !== "undefined") {
      original._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      }

      clearAuthSession();
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
    localStorage.removeItem("zika:web_auth");
    clearAnonymousToken();
  }
}

export async function logoutUser() {
  try {
    await api.post("/auth/logout");
  } catch (err) {
    console.error("Logout API failed:", err);
  }

  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("zika:web_auth");
    clearAnonymousToken();
  }

  try {
    const { useAuthStore } = await import("@/stores/auth");
    useAuthStore.getState().clearSession();
  } catch (e) {
    console.error("Failed to clear auth store:", e);
  }
}
