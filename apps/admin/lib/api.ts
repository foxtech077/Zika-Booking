import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15_000,
});

const TOKEN_KEY = "zika:admin_session";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function storeAdminToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
