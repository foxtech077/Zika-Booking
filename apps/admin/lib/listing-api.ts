import axios from "axios";
import { getAdminToken } from "@/lib/api";

// Proxied via Next.js rewrites: /listing-api/* → listing-service
export const listingApi = axios.create({
  baseURL: "/listing-api",
  withCredentials: true,
  timeout: 30_000,
});

listingApi.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
