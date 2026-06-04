import axios from "axios";

const TOKEN_KEY = "zika:access_token";

export const paymentApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PAYMENT_API_URL || "https://api.kainook.com/payments",
  withCredentials: true,
  timeout: 30_000,
});

paymentApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
