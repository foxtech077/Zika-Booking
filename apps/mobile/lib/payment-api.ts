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
  return config;
});
