import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../store/auth";

const getPaymentBaseUrl = () => {
  const envUrl = process.env["EXPO_PUBLIC_PAYMENT_API_URL"];
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1") && !envUrl.includes("10.249.75.161")) {
    return envUrl;
  }
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) {
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
