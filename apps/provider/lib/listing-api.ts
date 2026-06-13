import axios from "axios";

// Proxied through Next.js rewrites → listing-service (port 3003)
export const listingApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_LISTING_API_URL,
  withCredentials: true,
  timeout: 15_000,
});

const TOKEN_KEY = "zika:provider_token";

listingApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

listingApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(err);
  },
);
