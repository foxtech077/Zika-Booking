import axios from "axios";

// In Next.js we proxy /api/* → auth service via next.config rewrites
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("zika:access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function storeToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem("zika:access_token", token);
}

export function clearToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem("zika:access_token");
}
