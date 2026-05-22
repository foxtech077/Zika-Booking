import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../store/auth";

const getPaymentBaseUrl = () => {
  // Prefer the Expo dev server host (auto-detected from the QR code) so any
  // phone on the same Wi-Fi can reach the API without hardcoded IP addresses.
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  const isIP = host && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  if (isIP && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:3004`;
  }
  const envUrl = process.env["EXPO_PUBLIC_PAYMENT_API_URL"];
  if (envUrl) return envUrl;
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
