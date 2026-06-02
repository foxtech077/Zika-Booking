import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../store/auth";

const getPaymentBaseUrl = () => {
  // Prefer explicit env var (hosted or tunnel backend) over auto-detected LAN IP.
  const envUrl = process.env["EXPO_PUBLIC_PAYMENT_API_URL"];
  if (envUrl) return envUrl;
  // Fall back to Expo dev server host for pure local dev (no .env set).
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  const isIP = host && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  if (isIP && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:3004`;
  }
  return "http://localhost:3004";
};

const PAYMENT_BASE_URL = getPaymentBaseUrl();

export const paymentApi = axios.create({
  baseURL: PAYMENT_BASE_URL,
  timeout: 30_000,
});

paymentApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
