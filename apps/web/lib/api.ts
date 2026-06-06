import axios from "axios";

const TOKEN_KEY = "zika:access_token";

// In Next.js we proxy /api/* → auth service via next.config rewrites
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(err);
  },
);

export function storeToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}
