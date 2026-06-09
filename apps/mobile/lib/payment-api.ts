import axios from "axios";
import { useAuthStore } from "../store/auth";

const getPaymentBaseUrl = () => {
  const envUrl = process.env["EXPO_PUBLIC_PAYMENT_API_URL"];
  if (envUrl) return envUrl;
  return "https://api.kainook.com/payments";
};

const PAYMENT_BASE_URL = getPaymentBaseUrl();

export const paymentApi = axios.create({
  baseURL: PAYMENT_BASE_URL,
  timeout: 30_000,
});

paymentApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const fullUrl = `${config.baseURL ?? PAYMENT_BASE_URL}${config.url ?? ""}`;
  console.log(`[PAYMENT-API] ▶ ${(config.method ?? "GET").toUpperCase()} ${fullUrl}`);
  if (config.data) console.log("[PAYMENT-API] Request body:", JSON.stringify(config.data, null, 2));
  return config;
});

paymentApi.interceptors.response.use(
  (res) => {
    const fullUrl = `${res.config.baseURL ?? PAYMENT_BASE_URL}${res.config.url ?? ""}`;
    console.log(`[PAYMENT-API] ✅ ${res.status} ${fullUrl}`);
    return res;
  },
  (error) => {
    const config = error.config ?? {};
    const fullUrl = `${config.baseURL ?? PAYMENT_BASE_URL}${config.url ?? ""}`;
    console.log(`[PAYMENT-API] ❌ ERROR on ${(config.method ?? "GET").toUpperCase()} ${fullUrl}`);
    console.log("[PAYMENT-API] HTTP status:", error?.response?.status);
    console.log("[PAYMENT-API] Response body:", JSON.stringify(error?.response?.data, null, 2));
    console.log("[PAYMENT-API] Error message:", error?.message);
    return Promise.reject(error);
  },
);
