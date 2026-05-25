import axios from "axios";

// Proxied through Next.js rewrites → auth-service (port 3001)
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15_000,
});

const TOKEN_KEY = "zika:provider_token";

export function getProviderToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getProviderToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      // Clear stale token — the auth guard will redirect
      sessionStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(err);
  },
);
