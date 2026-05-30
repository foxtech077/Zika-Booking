import axios from "axios";
import { useAuthStore } from "../store/auth";

const PAYMENT_BASE_URL = process.env["EXPO_PUBLIC_PAYMENT_API_URL"] ?? "https://kainook.duckdns.org/api/payments";

export const paymentApi = axios.create({
  baseURL: PAYMENT_BASE_URL,
  timeout: 30_000,
});

paymentApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
