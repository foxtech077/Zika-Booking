import axios from "axios";

export const listingApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_LISTING_API_URL ?? "",
  withCredentials: true,
  timeout: 15_000,
});

listingApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("zika:admin_session");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper: use raw ADMIN_JWT_SECRET for review hide/unhide
export function getAdminJwtSecret(): string {
  // In Next.js, this key is passed via the x-admin-key header on the review hide endpoint
  // The frontend sets this from env var (configured server-side via proxy)
  return process.env.NEXT_PUBLIC_ADMIN_KEY ?? "";
}
